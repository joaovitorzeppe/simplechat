import { useSyncExternalStore } from "react";
import type { MessageKey } from "@i18n/locales";

export type ToastState = {
  key: MessageKey;
  vars?: Record<string, string | number>;
};

let current: ToastState | null = null;
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

export const showToast = (
  key: MessageKey,
  vars?: Record<string, string | number>,
  ms = 4500,
) => {
  window.clearTimeout(timer);
  current = { key, vars };
  emit();
  timer = window.setTimeout(() => {
    current = null;
    emit();
  }, ms);
};

export const useToast = () => {
  return useSyncExternalStore(subscribeToast, getToast, getToast);
};
