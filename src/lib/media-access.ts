export type MediaFallback = "none" | "audio" | "video" | "listen";

export type AcquiredMedia = {
  stream: MediaStream;
  cameraOff: boolean;
  muted: boolean;
  fallback: MediaFallback;
};

/** Sem `getDisplayMedia` (comum em mobile) o botão de tela não serve. */
export const canShareScreen = (
  devices:
    | Pick<MediaDevices, "getDisplayMedia">
    | null
    | undefined = typeof navigator !== "undefined"
    ? navigator.mediaDevices
    : undefined,
) => typeof devices?.getDisplayMedia === "function";

type VideoDevice = Pick<MediaDeviceInfo, "kind" | "deviceId" | "label">;

export type CameraFlip =
  | { facingMode: "user" | "environment" }
  | { deviceId: string };

export const facingFromLabel = (label: string) => {
  const l = label.toLowerCase();
  if (/front|facetime|\buser\b|frontal/.test(l)) {
    return "user" as const;
  }
  if (/back|rear|environment|traseir/.test(l)) {
    return "environment" as const;
  }
  return undefined;
};

/** Frente ↔ uma traseira. Não cicla ultra-wide/tele. Desktop sem facing: cicla id. */
export const nextCameraFlip = (
  devices: readonly VideoDevice[],
  current: { deviceId?: string; facingMode?: string },
): CameraFlip | null => {
  const cams = devices.filter((d) => d.kind === "videoinput");
  if (cams.length < 2) {
    return null;
  }

  const currentLabel =
    cams.find((d) => d.deviceId && d.deviceId === current.deviceId)?.label ??
    "";
  const from =
    current.facingMode === "user" || current.facingMode === "environment"
      ? current.facingMode
      : facingFromLabel(currentLabel);

  if (from) {
    return { facingMode: from === "user" ? "environment" : "user" };
  }

  const withId = cams.filter((d) => d.deviceId);
  if (withId.length < 2) {
    return null;
  }
  const idx = withId.findIndex((d) => d.deviceId === current.deviceId);
  const next = withId[(idx < 0 ? 1 : idx + 1) % withId.length];
  return next?.deviceId ? { deviceId: next.deviceId } : null;
};

/** `exact` + tamanho no gum quebra tablet. deviceId primeiro; facingMode só fallback. */
export const cameraFlipConstraints = (
  flip: CameraFlip,
  devices: readonly VideoDevice[] = [],
): MediaTrackConstraints[] => {
  if ("deviceId" in flip) {
    return [{ deviceId: { exact: flip.deviceId } }];
  }
  const match = devices.find(
    (device) =>
      device.kind === "videoinput" &&
      facingFromLabel(device.label) === flip.facingMode,
  );
  const next: MediaTrackConstraints[] = [];
  if (match?.deviceId) {
    next.push({ deviceId: { exact: match.deviceId } });
  }
  next.push({ facingMode: { ideal: flip.facingMode } });
  return next;
};

type GetUserMedia = (
  constraints: MediaStreamConstraints,
) => Promise<MediaStream>;

const placeholderPins = new WeakMap<MediaStreamTrack, HTMLCanvasElement>();

/**
 * Faixa preta só para o SDP: sem m-line de vídeo, religar a câmera depois
 * não chega nos outros (PeerJS não renegocia `addTrack`).
 */
export const placeholderVideoTrack = (): MediaStreamTrack | null => {
  if (typeof document === "undefined") {
    return null;
  }
  const canvas = document.createElement("canvas");
  canvas.width = 2;
  canvas.height = 2;
  if (typeof canvas.captureStream !== "function") {
    return null;
  }
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return null;
  }
  ctx.fillRect(0, 0, 2, 2);
  const track = canvas.captureStream(1).getVideoTracks()[0];
  if (!track) {
    return null;
  }
  placeholderPins.set(track, canvas);
  return track;
};

export const mediaStreamOf = (tracks: MediaStreamTrack[]): MediaStream => {
  if (typeof MediaStream === "function") {
    try {
      return new MediaStream(tracks);
    } catch {
      // tracks falsos nos testes não passam no construtor nativo
    }
  }
  const partial = {
    getTracks: () => tracks,
    getAudioTracks: () => tracks.filter((track) => track.kind === "audio"),
    getVideoTracks: () => tracks.filter((track) => track.kind === "video"),
  };
  // Só o que a sessão usa de um MediaStream; cobre ambientes sem o construtor.
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion
  return partial as unknown as MediaStream;
};

const listenOnly = (): AcquiredMedia => ({
  stream: mediaStreamOf([]),
  cameraOff: true,
  muted: true,
  fallback: "listen",
});

const isPermissionDenied = (error: unknown) => {
  if (!error || typeof error !== "object" || !("name" in error)) {
    return false;
  }
  const name = String((error).name);
  return name === "NotAllowedError" || name === "PermissionDeniedError";
};

type TryResult = AcquiredMedia | "denied" | null;

const tryGetUserMedia = async (
  getUserMedia: GetUserMedia,
  constraints: MediaStreamConstraints,
): Promise<TryResult> => {
  try {
    const stream = await getUserMedia(constraints);
    const media = fromStream(stream);
    return media.fallback === "listen" ? null : media;
  } catch (error) {
    if (isPermissionDenied(error)) {
      return "denied";
    }
    return null;
  }
};

const fromStream = (stream: MediaStream): AcquiredMedia => {
  const audio = stream.getAudioTracks();
  const video = stream.getVideoTracks();
  const hasAudio = audio.length > 0;
  const hasVideo = video.length > 0;
  if (hasAudio && hasVideo) {
    return { stream, cameraOff: false, muted: false, fallback: "none" };
  }
  if (hasAudio) {
    video.forEach((track) => track.stop());
    return {
      stream: mediaStreamOf(audio),
      cameraOff: true,
      muted: false,
      fallback: "audio",
    };
  }
  if (hasVideo) {
    return { stream, cameraOff: false, muted: true, fallback: "video" };
  }
  return listenOnly();
};

/**
 * Sobe o que o dispositivo e a permissão deixarem: os dois, só áudio, só
 * vídeo ou nenhum (ouvir e chat). Nunca rejeita — quem entra sem tracks
 * continua na sala. Permissão negada para de tentar na hora.
 */
export const acquireLocalMedia = async (
  getUserMedia: GetUserMedia | undefined,
  preferred: MediaStreamConstraints,
): Promise<AcquiredMedia> => {
  if (!getUserMedia) {
    return listenOnly();
  }

  const attempts = [
    preferred,
    { audio: true, video: true },
    { audio: true, video: false },
    { audio: false, video: true },
  ] as const;

  for (const constraints of attempts) {
    // Fallback em ordem: cada tentativa só roda se a anterior falhou.
    // oxlint-disable-next-line no-await-in-loop
    const result = await tryGetUserMedia(getUserMedia, constraints);
    if (result === "denied") {
      return listenOnly();
    }
    if (result) {
      return result;
    }
  }
  return listenOnly();
};
