import { useCallback, useSyncExternalStore } from "react";

/**
 * O progresso muda várias vezes por segundo. Mantê-lo fora do array de
 * mensagens faz cada atualização re-renderizar só o cartão do arquivo, em vez
 * da conversa inteira.
 */
const values = new Map<string, number>();
const listeners = new Map<string, Set<() => void>>();

export const setFileProgress = (id: string, value: number) => {
  // Quantizar em passos de 1% limita a no máximo cem renders por transferência,
  // em vez de um por pedaço de 16 KB.
  const quantized = Math.round(Math.min(1, Math.max(0, value)) * 100) / 100;
  if (values.get(id) === quantized) return;
  values.set(id, quantized);
  const subscribers = listeners.get(id);
  if (subscribers) for (const listener of subscribers) listener();
};

export const getFileProgress = (id: string) => values.get(id) ?? 0;

export const clearFileProgress = (id: string) => {
  values.delete(id);
};

export const clearAllFileProgress = () => {
  values.clear();
};

const subscribe = (id: string, listener: () => void) => {
  let subscribers = listeners.get(id);
  if (!subscribers) {
    subscribers = new Set();
    listeners.set(id, subscribers);
  }
  subscribers.add(listener);
  return () => {
    subscribers.delete(listener);
    if (subscribers.size === 0) listeners.delete(id);
  };
};

export const useFileProgress = (id: string) => {
  return useSyncExternalStore(
    useCallback((listener: () => void) => subscribe(id, listener), [id]),
    () => getFileProgress(id),
    () => getFileProgress(id),
  );
};
