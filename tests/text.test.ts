import { describe, expect, it } from "vitest";
import { firstGrapheme, graphemes, truncateText } from "../src/lib/text";
import { safeFileName } from "../src/lib/chat";
import {
  clampChatText,
  clampDisplayName,
  MAX_CHAT_TEXT,
  MAX_DISPLAY_NAME,
  parseWire,
} from "../src/lib/wire-guard";

const JAPANESE = "田中太郎";
const HINDI = "अजय कुमार";
const TAMIL = "தமிழ்";
const KOREAN = "김민준";
const ARABIC = "محمد عبد الله";
const EMOJI = "👨‍👩‍👧‍👦🎉";

/** Metade de par substituto solta, o resíduo típico de um slice por índice. */
const LONE_SURROGATE =
  /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/;

describe("grafemas", () => {
  it("conta cluster índico como um caractere só", () => {
    // क + ् + ष + ि é um único cluster visível
    expect(graphemes("क्षि")).toHaveLength(1);
  });

  it("mantém família com ZWJ inteira", () => {
    expect(graphemes("👨‍👩‍👧‍👦")).toHaveLength(1);
  });

  it("pega a inicial sem partir par substituto", () => {
    expect(firstGrapheme("🎉festa")).toBe("🎉");
    expect(firstGrapheme(JAPANESE)).toBe("田");
    expect(firstGrapheme(TAMIL)).toBe("த");
  });

  it("devolve string vazia para nome vazio", () => {
    expect(firstGrapheme("")).toBe("");
  });
});

describe("truncateText", () => {
  it("nunca deixa substituto órfão", () => {
    expect(LONE_SURROGATE.test("👨👩👧👦".slice(0, 3))).toBe(true);
    const cut = truncateText("👨👩👧👦", 3);
    expect(LONE_SURROGATE.test(cut)).toBe(false);
    expect(cut).toBe("👨");
  });

  it("respeita o teto em unidades UTF-16", () => {
    expect(truncateText(EMOJI, 4).length).toBeLessThanOrEqual(4);
    expect(truncateText(JAPANESE, 2)).toBe("田中");
  });

  it("não corta o que já cabe", () => {
    expect(truncateText(HINDI, 100)).toBe(HINDI);
    expect(truncateText(ARABIC, 100)).toBe(ARABIC);
  });
});

describe("limites de nome e chat com scripts não latinos", () => {
  it("aceita 100 caracteres de qualquer script", () => {
    const long = JAPANESE.repeat(25);
    expect(long.length).toBe(100);
    expect(clampDisplayName(long)).toBe(long);
  });

  it("corta acima de 100 sem quebrar grafema", () => {
    const clamped = clampDisplayName("🎉".repeat(80));
    expect(clamped.length).toBeLessThanOrEqual(MAX_DISPLAY_NAME);
    expect(graphemes(clamped).every((g) => g === "🎉")).toBe(true);
  });

  /**
   * O corte precisa caber na mesma régua que o validador do outro lado usa,
   * senão a própria mensagem seria recusada ao chegar no destino.
   */
  it("o que o clamp produz passa pelo parseWire", () => {
    const name = clampDisplayName("🎉".repeat(200));
    const text = clampChatText("अजय".repeat(3000));
    const parsed = parseWire({
      type: "chat",
      id: "abc",
      text,
      fromPeerId: "peer-1",
      fromName: name,
      at: Date.now(),
    });
    expect(parsed).not.toBeNull();
    expect(text.length).toBeLessThanOrEqual(MAX_CHAT_TEXT);
  });

  it("preserva nomes coreanos e árabes na íntegra", () => {
    expect(clampDisplayName(KOREAN)).toBe(KOREAN);
    expect(clampDisplayName(ARABIC)).toBe(ARABIC);
  });
});

describe("nomes de arquivo não latinos", () => {
  it("mantém o nome quando é seguro", () => {
    expect(safeFileName("報告書.pdf")).toBe("報告書.pdf");
    expect(safeFileName("रिपोर्ट.pdf")).toBe("रिपोर्ट.pdf");
  });

  it("corta nome gigante sem deixar substituto órfão", () => {
    const cut = safeFileName(`${"🎉".repeat(200)}.png`);
    expect(cut.length).toBeLessThanOrEqual(180);
    expect(LONE_SURROGATE.test(cut)).toBe(false);
  });
});
