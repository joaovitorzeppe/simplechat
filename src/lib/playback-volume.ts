const volumes = new Map<string, number>();
const listeners = new Set<() => void>();

/** Câmera e tela do mesmo peer têm volumes independentes. */
export const playbackKey = (peerId: string, screen: boolean) => {
  return `${peerId}:${screen ? "screen" : "camera"}`;
};

export const getPlaybackVolume = (key: string) => {
  return volumes.get(key) ?? 1;
};

export const setPlaybackVolume = (key: string, value: number) => {
  const next = Math.min(1, Math.max(0, value));
  if (volumes.get(key) === next) {
    return;
  }
  volumes.set(key, next);
  for (const listener of listeners) {
    listener();
  }
};

export const subscribePlaybackVolume = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};
