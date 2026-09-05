export type MediaKind = "camera" | "screen";

export type MediaLimits = {
  width: number;
  height: number;
  frameRate: number;
  maxBitrate: number;
};

/** Limites únicos do app. */
export const LIMITS: Record<MediaKind, MediaLimits> = {
  camera: { width: 1280, height: 720, frameRate: 30, maxBitrate: 2_500_000 },
  screen: { width: 1920, height: 1080, frameRate: 30, maxBitrate: 4_000_000 },
};

export const MAX_PARTICIPANTS = 12;
export const MAX_FILE_BYTES = 100 * 1024 * 1024;

export const maxParticipants = () => MAX_PARTICIPANTS;
export const maxFileBytes = () => MAX_FILE_BYTES;

export const getCameraConstraints = (): MediaStreamConstraints => {
  const t = LIMITS.camera;
  return {
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
    },
    video: {
      width: { ideal: t.width },
      height: { ideal: t.height },
      frameRate: { ideal: t.frameRate, max: t.frameRate },
    },
  };
};

export const getDisplayConstraints = (): DisplayMediaStreamOptions => {
  const t = LIMITS.screen;
  return {
    audio: false,
    video: {
      width: { ideal: t.width },
      height: { ideal: t.height },
      frameRate: { ideal: t.frameRate, max: t.frameRate },
    },
  };
};

export const applyTrackConstraints = async (
  stream: MediaStream,
  kind: MediaKind,
) => {
  const t = LIMITS[kind];
  const video = stream.getVideoTracks()[0];
  if (!video) return;
  try {
    await video.applyConstraints({
      width: { ideal: t.width },
      height: { ideal: t.height },
      frameRate: { ideal: t.frameRate, max: t.frameRate },
    });
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
    await sender.setParameters(params);
  } catch {
    // alguns browsers só aceitam setParameters depois da negociação
  }
};
