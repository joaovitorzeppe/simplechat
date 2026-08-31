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

const tryGetUserMedia = async (
  getUserMedia: GetUserMedia,
  constraints: MediaStreamConstraints,
) => {
  try {
    return await getUserMedia(constraints);
  } catch {
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
 * continua na sala.
 */
export const acquireLocalMedia = async (
  getUserMedia: GetUserMedia | undefined,
  preferred: MediaStreamConstraints,
): Promise<AcquiredMedia> => {
  if (!getUserMedia) return listenOnly();

  const tryOnce = async (constraints: MediaStreamConstraints) => {
    const stream = await tryGetUserMedia(getUserMedia, constraints);
    if (!stream) return null;
    const media = fromStream(stream);
    return media.fallback === "listen" ? null : media;
  };

  return (
    (await tryOnce(preferred)) ??
    (await tryOnce({ audio: true, video: true })) ??
    (await tryOnce({ audio: true, video: false })) ??
    (await tryOnce({ audio: false, video: true })) ??
    listenOnly()
  );
};
