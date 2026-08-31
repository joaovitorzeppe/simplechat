import { useSyncExternalStore } from "react";
import { session } from "./session";

export function useSession() {
  const state = useSyncExternalStore(
    session.subscribe,
    session.getState,
    session.getState,
  );
  return { state, session };
}
