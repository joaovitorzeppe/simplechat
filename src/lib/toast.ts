import { useSyncExternalStore } from "react";
import type { MessageKey } from "../i18n/locales";

let current: MessageKey | null = null;
let timer = 0;
const listeners = new Set<() => void>();

const emit = () => {
  for (const listener of listeners) listener();
};

export const subscribeToast = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const getToast = () => current;

export const showToast = (key: MessageKey, ms = 4500) => {
  window.clearTimeout(timer);
  current = key;
  emit();
  timer = window.setTimeout(() => {
    current = null;
    emit();
  }, ms);
};

export const useToast = () => {
  return useSyncExternalStore(subscribeToast, getToast, getToast);
};
