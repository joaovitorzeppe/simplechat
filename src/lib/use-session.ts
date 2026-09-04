import { useRef, useSyncExternalStore } from "react";
import { session, type SessionState } from "./session";

export const useSession = () => {
  const state = useSyncExternalStore(
    session.subscribe,
    session.getState,
    session.getState,
  );
  return { state, session };
};

/**
 * Só re-renderiza quando o pedaço selecionado muda (Object.is por padrão).
 * Evita que mute/chat/ICE redesenhem a árvore inteira da chamada.
 */
export const useSessionSelector = <T,>(
  select: (state: SessionState) => T,
  isEqual: (a: T, b: T) => boolean = Object.is,
): T => {
  const cache = useRef<{ value: T } | null>(null);
  return useSyncExternalStore(
    session.subscribe,
    () => {
      const next = select(session.getState());
      const prev = cache.current;
      if (prev && isEqual(prev.value, next)) return prev.value;
      cache.current = { value: next };
      return next;
    },
    () => select(session.getState()),
  );
};
