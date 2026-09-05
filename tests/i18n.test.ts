import { afterEach, describe, expect, it, vi } from "vitest";
import { detectLocale } from "@i18n/i18n";

describe("detectLocale", () => {
  afterEach(() => {
    localStorage.clear();
    vi.unstubAllGlobals();
  });

  it("usa inglês quando o idioma do navegador não é suportado", () => {
    localStorage.clear();
    vi.stubGlobal("navigator", {
      language: "de-DE",
      languages: ["de-DE", "de"],
    });
    expect(detectLocale()).toBe("en");
  });

  it("escolhe o primeiro idioma suportado da lista do navegador", () => {
    localStorage.clear();
    vi.stubGlobal("navigator", {
      language: "ja-JP",
      languages: ["ja-JP", "pt-BR", "en-US"],
    });
    expect(detectLocale()).toBe("pt");
  });
});
