import { describe, expect, it } from "vitest";
import { MAX_FILE_BYTES } from "@libs/quality";
import {
  MAX_CHAT_TEXT,
  MAX_DISPLAY_NAME,
  MAX_PEERS,
  clampChatText,
  clampDisplayName,
  parseWire,
} from "@libs/wire-guard";

const chat = (overrides: Record<string, unknown> = {}) => ({
  type: "chat",
  id: "abc",
  text: "oi",
  fromPeerId: "ana-1",
  fromName: "Ana",
  at: 1700000000000,
  ...overrides,
});

const hello = (displayName: string) => ({
  type: "hello",
  displayName,
  peerId: "ana-1",
  kind: "room-join",
});

const peers = (count: number) =>
  Array.from({ length: count }, (_, index) => ({
    peerId: `peer-${index}`,
    displayName: `Peer ${index}`,
  }));

const fileStart = (size: unknown) => ({
  type: "file-start",
  id: "f1",
  name: "foto.png",
  mime: "image/png",
  size,
  fromPeerId: "ana-1",
  fromName: "Ana",
  at: 1700000000000,
});

describe("parseWire", () => {
  it("rejeita valores que nem são objeto", () => {
    expect(parseWire(null)).toBeNull();
    expect(parseWire("chat")).toBeNull();
    expect(parseWire(42)).toBeNull();
    expect(parseWire([])).toBeNull();
  });

  it("rejeita tipo desconhecido", () => {
    expect(parseWire({ type: "drop-database" })).toBeNull();
  });

  it("aceita um chat bem formado", () => {
    expect(parseWire(chat())).toEqual(chat());
  });

  it("aceita menções válidas e rejeita o resto", () => {
    expect(parseWire(chat({ mentions: ["all", "peer-1"] }))).toEqual(
      chat({ mentions: ["all", "peer-1"] }),
    );
    expect(parseWire(chat({ mentions: [] }))).toEqual(chat());
    expect(parseWire(chat({ mentions: ["all", 1] }))).toBeNull();
    expect(parseWire(chat({ mentions: "all" }))).toBeNull();
  });

  it("rejeita chat com texto que não é string", () => {
    expect(parseWire(chat({ text: { toString: 1 } }))).toBeNull();
    expect(parseWire(chat({ text: 123 }))).toBeNull();
    expect(parseWire(chat({ text: "" }))).toBeNull();
  });

  it("rejeita chat acima do teto de texto", () => {
    expect(parseWire(chat({ text: "a".repeat(MAX_CHAT_TEXT) }))).not.toBeNull();
    expect(parseWire(chat({ text: "a".repeat(MAX_CHAT_TEXT + 1) }))).toBeNull();
  });

  it("rejeita chat com data inválida", () => {
    expect(parseWire(chat({ at: Number.NaN }))).toBeNull();
    expect(parseWire(chat({ at: -1 }))).toBeNull();
    expect(parseWire(chat({ at: "ontem" }))).toBeNull();
  });

  it("rejeita nome de exibição gigante no hello", () => {
    expect(parseWire(hello("a".repeat(MAX_DISPLAY_NAME)))).not.toBeNull();
    expect(parseWire(hello("a".repeat(MAX_DISPLAY_NAME + 1)))).toBeNull();
  });

  it("rejeita hello com kind fora do contrato", () => {
    expect(
      parseWire({
        type: "hello",
        displayName: "Ana",
        peerId: "ana-1",
        kind: "admin",
      }),
    ).toBeNull();
  });

  it("limita o tamanho da lista de peers", () => {
    expect(
      parseWire({ type: "room-peers", peers: peers(MAX_PEERS) }),
    ).not.toBeNull();
    expect(
      parseWire({ type: "room-peers", peers: peers(MAX_PEERS + 1) }),
    ).toBeNull();
  });

  it("rejeita lista de peers com entrada malformada", () => {
    expect(
      parseWire({ type: "room-peers", peers: [{ peerId: "a" }] }),
    ).toBeNull();
    expect(parseWire({ type: "room-peers", peers: ["a"] })).toBeNull();
    expect(parseWire({ type: "room-peers", peers: "todos" })).toBeNull();
  });

  it("rejeita file-start acima do teto absoluto", () => {
    expect(parseWire(fileStart(MAX_FILE_BYTES.pro))).not.toBeNull();
    expect(parseWire(fileStart(MAX_FILE_BYTES.pro + 1))).toBeNull();
    expect(parseWire(fileStart(0))).toBeNull();
    expect(parseWire(fileStart(-5))).toBeNull();
    expect(parseWire(fileStart(1.5))).toBeNull();
    expect(parseWire(fileStart(Number.POSITIVE_INFINITY))).toBeNull();
  });

  it("aceita media-meta parcial e rejeita valor não booleano", () => {
    expect(parseWire({ type: "media-meta", cameraOff: true })).toEqual({
      type: "media-meta",
      cameraOff: true,
    });
    expect(parseWire({ type: "media-meta" })).toEqual({ type: "media-meta" });
    expect(parseWire({ type: "media-meta", cameraOff: "sim" })).toBeNull();
  });

  it("aceita room-mute parcial e rejeita o resto", () => {
    expect(
      parseWire({ type: "room-mute", peerId: "ana-1", audio: true }),
    ).toEqual({
      type: "room-mute",
      peerId: "ana-1",
      audio: true,
    });
    expect(
      parseWire({ type: "room-mute", peerId: "ana-1", video: false }),
    ).toEqual({ type: "room-mute", peerId: "ana-1", video: false });
    expect(parseWire({ type: "room-mute", peerId: "ana-1" })).toBeNull();
    expect(
      parseWire({ type: "room-mute", peerId: "ana-1", audio: "sim" }),
    ).toBeNull();
  });

  it("aceita mutes no room-peers e rejeita entrada malformada", () => {
    const base = { type: "room-peers", peers: peers(1) };
    expect(
      parseWire({
        ...base,
        mutes: [{ peerId: "ana-1", audio: true, video: false }],
      }),
    ).toMatchObject({
      mutes: [{ peerId: "ana-1", audio: true, video: false }],
    });
    expect(parseWire({ ...base, mutes: [] })).toEqual({
      ...base,
      mutes: [],
    });
    expect(
      parseWire({ ...base, mutes: [{ peerId: "ana-1", audio: true }] }),
    ).toBeNull();
    expect(parseWire({ ...base, mutes: "todos" })).toBeNull();
  });

  it("aceita as mensagens de controle sem corpo", () => {
    expect(parseWire({ type: "room-ended" })).toEqual({ type: "room-ended" });
    expect(parseWire({ type: "room-full" })).toEqual({ type: "room-full" });
    expect(parseWire({ type: "hangup" })).toEqual({ type: "hangup" });
  });
});

describe("clamps", () => {
  it("corta e apara o nome de exibição", () => {
    expect(clampDisplayName("  Ana  ")).toBe("Ana");
    expect(clampDisplayName("a".repeat(200))).toHaveLength(MAX_DISPLAY_NAME);
  });

  it("corta o texto do chat no teto", () => {
    expect(clampChatText("a".repeat(9000))).toHaveLength(MAX_CHAT_TEXT);
  });
});
