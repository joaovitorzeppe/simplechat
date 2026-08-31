import { dictionaries, type MessageKey } from "./locales";

export type Locale = "pt" | "en" | "es";

const KEY = "simplechat.locale";
const LOCALES: Locale[] = ["pt", "en", "es"];

export const localeNames: Record<Locale, MessageKey> = {
  pt: "language.pt",
  en: "language.en",
  es: "language.es",
};

export const localeTags: Record<Locale, string> = {
  pt: "pt-BR",
  en: "en",
  es: "es",
};

function isLocale(value: string): value is Locale {
  return LOCALES.includes(value as Locale);
}

export function detectLocale(): Locale {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved && isLocale(saved)) return saved;
  } catch {
    // ignore
  }
  const lang = (navigator.language || "en").toLowerCase();
  if (lang.startsWith("pt")) return "pt";
  if (lang.startsWith("es")) return "es";
  return "en";
}

let locale: Locale = detectLocale();
const listeners = new Set<() => void>();

function applyDocument(next: Locale) {
  document.documentElement.lang = localeTags[next];
  const meta = document.querySelector('meta[name="description"]');
  if (meta) meta.setAttribute("content", translate(next, "meta.description"));
}

export function getLocale() {
  return locale;
}

export function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function setLocale(next: Locale) {
  if (locale === next) return;
  locale = next;
  try {
    localStorage.setItem(KEY, next);
  } catch {
    // ignore
  }
  applyDocument(next);
  for (const listener of listeners) listener();
}

export function translate(
  current: Locale,
  key: MessageKey,
  vars?: Record<string, string | number>,
) {
  let text = dictionaries[current][key] ?? dictionaries.pt[key];
  if (vars) {
    for (const [name, value] of Object.entries(vars)) {
      text = text.replaceAll(`{${name}}`, String(value));
    }
  }
  return text;
}

export function t(key: MessageKey, vars?: Record<string, string | number>) {
  return translate(locale, key, vars);
}

applyDocument(locale);
