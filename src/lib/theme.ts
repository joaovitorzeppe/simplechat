export type Theme = "dark" | "light";

const KEY = "simplechat.theme";
const CANVAS: Record<Theme, string> = {
  dark: "#070708",
  light: "#f4f4f5",
};

const isTheme = (value: string): value is Theme => {
  return value === "dark" || value === "light";
};

const prefersLight = () => {
  try {
    return window.matchMedia("(prefers-color-scheme: light)").matches;
  } catch {
    return false;
  }
};

const savedTheme = (): Theme | null => {
  try {
    const saved = localStorage.getItem(KEY);
    if (saved && isTheme(saved)) {
      return saved;
    }
  } catch {
    // ignore
  }
  return null;
};

export const detectTheme = (): Theme => {
  return savedTheme() ?? (prefersLight() ? "light" : "dark");
};

let theme: Theme = detectTheme();
const listeners = new Set<() => void>();

const applyDocument = (next: Theme) => {
  document.documentElement.classList.toggle("light", next === "light");
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) {
    meta.setAttribute("content", CANVAS[next]);
  }
  const status = document.querySelector(
    'meta[name="apple-mobile-web-app-status-bar-style"]',
  );
  if (status) {
    status.setAttribute(
      "content",
      next === "light" ? "default" : "black-translucent",
    );
  }
};

export const getTheme = () => {
  return theme;
};

export const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const setTheme = (next: Theme, options?: { persist?: boolean }) => {
  if (theme !== next) {
    theme = next;
    for (const listener of listeners) {
      listener();
    }
  }
  if (options?.persist !== false) {
    try {
      localStorage.setItem(KEY, next);
    } catch {
      // ignore
    }
  }
  applyDocument(next);
};

export const toggleTheme = () => {
  setTheme(theme === "light" ? "dark" : "light");
};

applyDocument(theme);

try {
  window
    .matchMedia("(prefers-color-scheme: light)")
    .addEventListener("change", () => {
      if (savedTheme()) {
        return;
      }
      setTheme(prefersLight() ? "light" : "dark", { persist: false });
    });
} catch {
  // ignore
}
