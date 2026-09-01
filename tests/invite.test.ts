import { describe, expect, it } from "vitest";
import { deepLinkJoinArg, inviteJoinArg, inviteLink, invitePeerId, parseInvite } from "../src/lib/invite";

describe("parseInvite", () => {
  it("aceita a chave crua", () => {
    expect(parseInvite("ana-123-456")).toEqual({ peerId: "ana-123-456", secret: null });
  });

  it("extrai da query string do link", () => {
    expect(parseInvite("https://simplechat.app/?room=ana-123")).toEqual({
      peerId: "ana-123",
      secret: null,
    });
  });

  it("ainda lê o parâmetro antigo call", () => {
    expect(parseInvite("https://simplechat.app/?call=ana-123")).toEqual({
      peerId: "ana-123",
      secret: null,
    });
  });

  it("lê a chave do hash", () => {
    expect(parseInvite("https://simplechat.app/#/?room=ana-123")).toEqual({
      peerId: "ana-123",
      secret: null,
    });
  });

  it("remove aspas e sinais de colagem", () => {
    expect(parseInvite('"ana-123"')).toEqual({ peerId: "ana-123", secret: null });
    expect(parseInvite("<https://simplechat.app/?room=ana-123>")).toEqual({
      peerId: "ana-123",
      secret: null,
    });
  });

  it("decodifica valor escapado", () => {
    expect(parseInvite("?room=ana%2D123")).toEqual({ peerId: "ana-123", secret: null });
  });

  it("devolve nulo para texto vazio", () => {
    expect(parseInvite("   ")).toBeNull();
  });

  it("devolve nulo para link sem chave", () => {
    expect(parseInvite("https://simplechat.app/")).toBeNull();
  });

  it("invitePeerId devolve string vazia quando não há convite", () => {
    expect(invitePeerId("https://simplechat.app/")).toBe("");
  });
});

describe("segredo da sala no fragmento", () => {
  it("lê o segredo do link completo", () => {
    expect(parseInvite("https://simplechat.app/?room=ana-123#k=abc123")).toEqual(
      { peerId: "ana-123", secret: "abc123" },
    );
  });

  it("lê o segredo da forma curta chave#k=segredo", () => {
    expect(parseInvite("ana-123#k=abc123")).toEqual({
      peerId: "ana-123",
      secret: "abc123",
    });
  });

  it("não confunde o fragmento com parte da chave", () => {
    expect(parseInvite("ana-123#k=abc123")?.peerId).toBe("ana-123");
  });

  it("monta o link com o segredo no fragmento, fora da query", () => {
    const link = inviteLink("ana-123", "abc123");
    expect(link).toContain("?room=ana-123");
    expect(link.split("#")[1]).toBe("k=abc123");
  });

  it("omite o fragmento quando não há segredo", () => {
    expect(inviteLink("ana-123", null)).not.toContain("#");
  });

  it("fecha o ciclo: o que monta é o que o parser lê", () => {
    const parsed = parseInvite(inviteLink("ana-123", "abc123"));
    expect(parsed).toEqual({ peerId: "ana-123", secret: "abc123" });
  });
});

describe("deep link para join automático", () => {
  it("monta a forma curta com segredo", () => {
    expect(inviteJoinArg({ peerId: "ana-123", secret: "abc" })).toBe(
      "ana-123#k=abc",
    );
  });

  it("ignora o próprio peerId", () => {
    expect(
      deepLinkJoinArg("https://simplechat.app/?room=me-1#k=abc", "me-1"),
    ).toBeNull();
  });

  it("devolve o convite de outra pessoa", () => {
    expect(
      deepLinkJoinArg("https://simplechat.app/?room=host-1#k=abc", "me-1"),
    ).toBe("host-1#k=abc");
  });

  it("devolve nulo sem room na URL", () => {
    expect(deepLinkJoinArg("https://simplechat.app/", "me-1")).toBeNull();
  });
});
