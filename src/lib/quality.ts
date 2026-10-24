export type MediaKind = "camera" | "screen";

export type MediaLimits = {
  width?: number;
  height?: number;
  frameRate: number;
  maxBitrate: number;
};

/** Limites únicos do app. Tela nítida: captura nativa a 30 fps. */
export const LIMITS: Record<MediaKind, MediaLimits> = {
  camera: { width: 1280, height: 720, frameRate: 30, maxBitrate: 2_500_000 },
  screen: { frameRate: 30, maxBitrate: 8_000_000 },
};

/** Nítido = tela cheia a 30 fps. Fluido = teto 1080p a 60 fps. */
export type ScreenPreset = "sharp" | "smooth";

export const SCREEN_PRESETS: Record<ScreenPreset, MediaLimits> = {
  sharp: LIMITS.screen,
  smooth: { width: 1920, height: 1080, frameRate: 60, maxBitrate: 8_000_000 },
};

export const MAX_PARTICIPANTS = 12;
export const MAX_FILE_BYTES = 100 * 1024 * 1024;

export const maxParticipants = () => MAX_PARTICIPANTS;
export const maxFileBytes = () => MAX_FILE_BYTES;

/** Um único remoto (a dupla). Três ou mais dividem a base de hoje. */
const PAIR_BITRATE: Record<MediaKind, number> = {
  camera: 4_000_000,
  screen: 12_000_000,
};

const FLOOR_BITRATE: Record<MediaKind, number> = {
  camera: 400_000,
  screen: 1_000_000,
};

export const videoBitrate = (kind: MediaKind, peers = 1) => {
  const links = Math.max(1, peers);
  if (links <= 1) {
    return PAIR_BITRATE[kind];
  }
  const base = kind === "screen" ? LIMITS.screen.maxBitrate : LIMITS.camera.maxBitrate;
  return Math.max(FLOOR_BITRATE[kind], Math.round(base / links));
};

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

/** `systemAudio` é do Chrome: checkbox de áudio do sistema na janela/tela. */
type DisplayCaptureOptions = DisplayMediaStreamOptions & {
  systemAudio?: "include" | "exclude";
};

export const getDisplayConstraints = (
  preset: ScreenPreset = "sharp",
): DisplayCaptureOptions => ({
  audio: true,
  video: sizeConstraints(SCREEN_PRESETS[preset]),
  systemAudio: "include",
});

export const applyTrackConstraints = async (
  stream: MediaStream,
  kind: MediaKind,
  preset: ScreenPreset = "sharp",
) => {
  const video = stream.getVideoTracks()[0];
  if (!video) {
    return;
  }
  const limits = kind === "screen" ? SCREEN_PRESETS[preset] : LIMITS.camera;
  if (kind === "screen") {
    video.contentHint = preset === "smooth" ? "motion" : "detail";
  }
  try {
    await video.applyConstraints(sizeConstraints(limits));
  } catch {
    // o dispositivo pode ignorar o teto; o bitrate ainda limita o envio
  }
};

export const applySenderLimits = async (
  sender: RTCRtpSender,
  kind: MediaKind,
  preset: ScreenPreset = "sharp",
  peers = 1,
) => {
  if (sender.track?.kind !== "video") {
    return;
  }
  const limits = kind === "screen" ? SCREEN_PRESETS[preset] : LIMITS.camera;
  try {
    const params = sender.getParameters();
    if (!params.encodings || params.encodings.length === 0) {
      params.encodings = [{}];
    }
    const encoding = params.encodings[0];
    encoding.maxBitrate = videoBitrate(kind, peers);
    if (kind === "screen") {
      encoding.maxFramerate = limits.frameRate;
      const width = sender.track.getSettings?.().width;
      const cap = limits.width;
      if (width && cap && width > cap) {
        encoding.scaleResolutionDownBy = width / cap;
      }
      params.degradationPreference =
        preset === "smooth" ? "maintain-framerate" : "maintain-resolution";
    }
    await sender.setParameters(params);
  } catch {
    // alguns browsers só aceitam setParameters depois da negociação
  }
};
