import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const KEY = "simplechat.theme";

const mockMatchMedia = (matches: boolean) => {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: query.includes("light") ? matches : !matches,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
};

beforeEach(() => {
  localStorage.clear();
  document.documentElement.classList.remove("light");
  mockMatchMedia(false);
});

afterEach(() => {
  vi.resetModules();
});

describe("theme", () => {
  it("usa o tema salvo", async () => {
    localStorage.setItem(KEY, "light");
    const { detectTheme, setTheme } = await import("@libs/theme");
    expect(detectTheme()).toBe("light");
    setTheme("light");
    expect(document.documentElement.classList.contains("light")).toBe(true);
  });

  it("segue o sistema quando não há preferência", async () => {
    mockMatchMedia(true);
    const { detectTheme } = await import("@libs/theme");
    expect(detectTheme()).toBe("light");
  });

  it("persiste a troca e aplica a classe no html", async () => {
    const { setTheme, getTheme } = await import("@libs/theme");
    setTheme("light");
    expect(getTheme()).toBe("light");
    expect(localStorage.getItem(KEY)).toBe("light");
    expect(document.documentElement.classList.contains("light")).toBe(true);

    setTheme("dark");
    expect(getTheme()).toBe("dark");
    expect(localStorage.getItem(KEY)).toBe("dark");
    expect(document.documentElement.classList.contains("light")).toBe(false);
  });

  it("não grava no storage quando a troca vem do sistema", async () => {
    const { setTheme, getTheme } = await import("@libs/theme");
    setTheme("light", { persist: false });
    expect(getTheme()).toBe("light");
    expect(localStorage.getItem(KEY)).toBeNull();
    expect(document.documentElement.classList.contains("light")).toBe(true);
  });
});
