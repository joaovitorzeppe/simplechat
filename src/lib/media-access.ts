export type MediaFallback = "none" | "audio" | "video" | "listen";

export type AcquiredMedia = {
  stream: MediaStream;
  cameraOff: boolean;
  muted: boolean;
  fallback: MediaFallback;
};

type GetUserMedia = (
  constraints: MediaStreamConstraints,
) => Promise<MediaStream>;

export const mediaStreamOf = (tracks: MediaStreamTrack[]): MediaStream => {
  if (typeof MediaStream === "function") {
    try {
      return new MediaStream(tracks);
    } catch {
      // tracks falsos nos testes não passam no construtor nativo
    }
  }
  return {
    getTracks: () => tracks,
    getAudioTracks: () => tracks.filter((track) => track.kind === "audio"),
    getVideoTracks: () => tracks.filter((track) => track.kind === "video"),
  } as unknown as MediaStream;
};

const listenOnly = (): AcquiredMedia => ({
  stream: mediaStreamOf([]),
  cameraOff: true,
  muted: true,
  fallback: "listen",
});

const isPermissionDenied = (error: unknown) => {
  if (!error || typeof error !== "object" || !("name" in error)) return false;
  const name = String((error as { name: unknown }).name);
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
    if (isPermissionDenied(error)) return "denied";
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
  if (!getUserMedia) return listenOnly();

  const attempts = [
    preferred,
    { audio: true, video: true },
    { audio: true, video: false },
    { audio: false, video: true },
  ] as const;

  for (const constraints of attempts) {
    const result = await tryGetUserMedia(getUserMedia, constraints);
    if (result === "denied") return listenOnly();
    if (result) return result;
  }
  return listenOnly();
};
