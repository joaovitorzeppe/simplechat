import { dictionaries, type MessageKey } from "./locales";

export type Locale = keyof typeof dictionaries;

const KEY = "simplechat.locale";

export const isLocale = (value: string): value is Locale => {
  return value in dictionaries;
};

export const supportedLocales = Object.keys(dictionaries).filter(isLocale);

export const localeNames: Record<Locale, MessageKey> = {
  pt: "language.pt",
  en: "language.en",
  es: "language.es",
  fr: "language.fr",
  it: "language.it",
};

export const localeTags: Record<Locale, string> = {
  pt: "pt-BR",
  en: "en",
  es: "es",
  fr: "fr",
  it: "it",
};

export const detectLocale = (): Locale => {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved && isLocale(saved)) {
      return saved;
    }
  } catch {
    // ignore
  }
  const candidates = [navigator.language, ...(navigator.languages ?? [])]
    .filter(Boolean)
    .map((lang) => lang.toLowerCase());
  for (const lang of candidates) {
    const hit = supportedLocales.find((code) => lang.startsWith(code));
    if (hit) {
      return hit;
    }
  }
  return "en";
};

let locale: Locale = detectLocale();
const listeners = new Set<() => void>();

export const translate = (
  current: Locale,
  key: MessageKey,
  vars?: Record<string, string | number>,
) => {
  let text = dictionaries[current][key] ?? dictionaries.en[key];
  if (vars) {
    for (const [name, value] of Object.entries(vars)) {
      text = text.replaceAll(`{${name}}`, String(value));
    }
  }
  return text;
};

const applyDocument = (next: Locale) => {
  document.documentElement.lang = localeTags[next];
  const meta = document.querySelector('meta[name="description"]');
  if (meta) {
    meta.setAttribute("content", translate(next, "meta.description"));
  }
};

export const getLocale = () => {
  return locale;
};

export const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const setLocale = (next: Locale) => {
  if (locale === next) {
    return;
  }
  locale = next;
  try {
    localStorage.setItem(KEY, next);
  } catch {
    // ignore
  }
  applyDocument(next);
  for (const listener of listeners) {
    listener();
  }
};

export const t = (key: MessageKey, vars?: Record<string, string | number>) => {
  return translate(locale, key, vars);
};

applyDocument(locale);
