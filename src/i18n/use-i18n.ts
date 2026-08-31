import { useSyncExternalStore } from "react";
import {
  getLocale,
  setLocale,
  subscribe,
  translate,
  type Locale,
} from "./i18n";
import type { MessageKey } from "./locales";

export function useI18n() {
  const locale = useSyncExternalStore(subscribe, getLocale, getLocale);
  return {
    locale,
    setLocale,
    t: (key: MessageKey, vars?: Record<string, string | number>) =>
      translate(locale, key, vars),
  };
}

export type { Locale, MessageKey };
