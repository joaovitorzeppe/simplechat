export type MediaKind = "camera" | "screen";

export type MediaLimits = {
  width?: number;
  height?: number;
  frameRate: number;
  maxBitrate: number;
};

/** Limites únicos do app. Tela: captura nativa; 30 fps (60 em 4K mesh queima CPU). */
export const LIMITS: Record<MediaKind, MediaLimits> = {
  camera: { width: 1280, height: 720, frameRate: 30, maxBitrate: 2_500_000 },
  screen: { frameRate: 30, maxBitrate: 8_000_000 },
};

export const MAX_PARTICIPANTS = 12;
export const MAX_FILE_BYTES = 100 * 1024 * 1024;

export const maxParticipants = () => MAX_PARTICIPANTS;
export const maxFileBytes = () => MAX_FILE_BYTES;

const sizeConstraints = (t: MediaLimits): MediaTrackConstraints => {
  const video: MediaTrackConstraints = {
    frameRate: { ideal: t.frameRate, max: t.frameRate },
  };
  if (t.width && t.height) {
    video.width = { ideal: t.width };
    video.height = { ideal: t.height };
  }
  return video;
};

export const getCameraConstraints = (): MediaStreamConstraints => ({
  audio: {
    echoCancellation: true,
    noiseSuppression: true,
  },
  video: sizeConstraints(LIMITS.camera),
});

export const getDisplayConstraints = (): DisplayMediaStreamOptions => ({
  audio: false,
  video: sizeConstraints(LIMITS.screen),
});

export const applyTrackConstraints = async (
  stream: MediaStream,
  kind: MediaKind,
) => {
  const video = stream.getVideoTracks()[0];
  if (!video) return;
  if (kind === "screen") video.contentHint = "detail";
  try {
    await video.applyConstraints(sizeConstraints(LIMITS[kind]));
  } catch {
    // o dispositivo pode ignorar o teto; o bitrate ainda limita o envio
  }
};

export const applySenderLimits = async (
  sender: RTCRtpSender,
  kind: MediaKind,
) => {
  if (sender.track?.kind !== "video") return;
  const bitrate = LIMITS[kind].maxBitrate;
  try {
    const params = sender.getParameters();
    if (!params.encodings || params.encodings.length === 0) {
      params.encodings = [{}];
    }
    params.encodings[0].maxBitrate = bitrate;
    if (kind === "screen") params.degradationPreference = "maintain-resolution";
    await sender.setParameters(params);
  } catch {
    // alguns browsers só aceitam setParameters depois da negociação
  }
};
