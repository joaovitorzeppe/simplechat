import { useSyncExternalStore } from "react";
import { getTheme, subscribe } from "./theme";

export const useTheme = () => {
  return useSyncExternalStore(subscribe, getTheme, getTheme);
};
