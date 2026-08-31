import { describe, expect, it } from "vitest";
import { invitePeerId, parseInvite } from "../src/lib/invite";

describe("parseInvite", () => {
  it("aceita a chave crua", () => {
    expect(parseInvite("ana-123-456")).toEqual({ peerId: "ana-123-456" });
  });

  it("extrai da query string do link", () => {
    expect(parseInvite("https://simplechat.app/?room=ana-123")).toEqual({
      peerId: "ana-123",
    });
  });

  it("ainda lê o parâmetro antigo call", () => {
    expect(parseInvite("https://simplechat.app/?call=ana-123")).toEqual({
      peerId: "ana-123",
    });
  });

  it("lê a chave do hash", () => {
    expect(parseInvite("https://simplechat.app/#/?room=ana-123")).toEqual({
      peerId: "ana-123",
    });
  });

  it("remove aspas e sinais de colagem", () => {
    expect(parseInvite('"ana-123"')).toEqual({ peerId: "ana-123" });
    expect(parseInvite("<https://simplechat.app/?room=ana-123>")).toEqual({
      peerId: "ana-123",
    });
  });

  it("decodifica valor escapado", () => {
    expect(parseInvite("?room=ana%2D123")).toEqual({ peerId: "ana-123" });
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
