import { describe, expect, it } from "vitest";
import {
  CHAT_GROUP_MS,
  groupChatMessages,
  hrefForLabel,
  isPreviewableImage,
  safeFileName,
  splitMessageText,
} from "../src/lib/chat";
import type { ChatMessage } from "../src/lib/types";

const message = (overrides: Partial<ChatMessage> = {}): ChatMessage => ({
  id: crypto.randomUUID(),
  fromPeerId: "ana",
  fromName: "Ana",
  text: "oi",
  at: 1_700_000_000_000,
  ...overrides,
});

describe("hrefForLabel", () => {
  it("aceita http e https", () => {
    expect(hrefForLabel("https://exemplo.com")).toBe("https://exemplo.com/");
    expect(hrefForLabel("http://exemplo.com")).toBe("http://exemplo.com/");
  });

  it("assume https quando não há esquema", () => {
    expect(hrefForLabel("exemplo.com")).toBe("https://exemplo.com/");
  });

  it("recusa esquemas perigosos", () => {
    expect(hrefForLabel("javascript:alert(1)")).toBeNull();
    expect(hrefForLabel("data:text/html,<script>")).toBeNull();
    expect(hrefForLabel("file:///etc/passwd")).toBeNull();
  });
});

describe("splitMessageText", () => {
  it("separa texto e link", () => {
    expect(splitMessageText("veja https://exemplo.com agora")).toEqual([
      { type: "text", value: "veja " },
      {
        type: "link",
        href: "https://exemplo.com/",
        label: "https://exemplo.com",
      },
      { type: "text", value: " agora" },
    ]);
  });

  it("não engole a pontuação final na URL", () => {
    const parts = splitMessageText("entra em www.exemplo.com.");
    expect(parts.at(-1)).toEqual({ type: "text", value: "." });
  });

  it("não linkifica domínio solto sem www nem esquema", () => {
    expect(splitMessageText("entra em exemplo.com")).toEqual([
      { type: "text", value: "entra em exemplo.com" },
    ]);
  });

  it("devolve texto puro quando não há link", () => {
    expect(splitMessageText("bom dia")).toEqual([
      { type: "text", value: "bom dia" },
    ]);
  });
});

describe("safeFileName", () => {
  it("neutraliza separadores de caminho", () => {
    expect(safeFileName("../../etc/passwd")).not.toMatch(/[\\/]/);
    expect(safeFileName("pasta\\arquivo.txt")).toBe("pasta_arquivo.txt");
  });

  it("descarta pontos iniciais", () => {
    expect(safeFileName(".bashrc")).toBe("bashrc");
    expect(safeFileName("../../etc/passwd").startsWith(".")).toBe(false);
  });

  it("remove controles e marcas de direção usadas para disfarçar extensão", () => {
    expect(safeFileName("nota\u202egpj.exe")).toBe("notagpj.exe");
    expect(safeFileName("re\u0000latorio.pdf")).toBe("relatorio.pdf");
  });

  it("limita o comprimento e nunca devolve vazio", () => {
    expect(safeFileName("a".repeat(500))).toHaveLength(180);
    expect(safeFileName("...")).toBe("file");
    expect(safeFileName("   ")).toBe("file");
  });
});

describe("isPreviewableImage", () => {
  it("aceita só os formatos de imagem previstos", () => {
    expect(isPreviewableImage("image/png")).toBe(true);
    expect(isPreviewableImage("image/webp")).toBe(true);
    expect(isPreviewableImage("image/svg+xml")).toBe(false);
    expect(isPreviewableImage("text/html")).toBe(false);
  });
});

describe("groupChatMessages", () => {
  it("agrupa mensagens seguidas do mesmo remetente", () => {
    const groups = groupChatMessages([
      message({ at: 1000 }),
      message({ at: 2000 }),
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0].messages).toHaveLength(2);
  });

  it("quebra o grupo quando passa a janela de tempo", () => {
    const groups = groupChatMessages([
      message({ at: 1000 }),
      message({ at: 1000 + CHAT_GROUP_MS + 1 }),
    ]);
    expect(groups).toHaveLength(2);
  });

  it("quebra o grupo quando troca o remetente", () => {
    const groups = groupChatMessages([
      message({ fromPeerId: "ana" }),
      message({ fromPeerId: "bruno" }),
    ]);
    expect(groups).toHaveLength(2);
  });

  it("mantém avisos de sistema isolados", () => {
    const groups = groupChatMessages([
      message({ at: 1000 }),
      message({ at: 1100, system: "left" }),
      message({ at: 1200 }),
    ]);
    expect(groups).toHaveLength(3);
  });
});
