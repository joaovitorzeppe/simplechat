import { beforeEach, describe, expect, it } from "vitest";
import {
  forgetPeer,
  loadRecents,
  rememberPeer,
} from "@libs/recents";

beforeEach(() => {
  localStorage.clear();
});

describe("recents", () => {
  it("guarda o mais recente na frente", () => {
    rememberPeer("aaa", "Ana");
    rememberPeer("bbb", "Bia");
    expect(loadRecents().map((entry) => entry.peerId)).toEqual(["bbb", "aaa"]);
  });

  it("atualiza o nome e sobe quem já estava na lista", () => {
    rememberPeer("aaa", "Ana");
    rememberPeer("bbb", "Bia");
    rememberPeer("aaa", "Ana Clara");
    const recents = loadRecents();
    expect(recents[0]).toMatchObject({ peerId: "aaa", displayName: "Ana Clara" });
    expect(recents).toHaveLength(2);
  });

  it("limita a oito entradas", () => {
    for (let i = 0; i < 12; i += 1) rememberPeer(`p${i}`, `Nome ${i}`);
    expect(loadRecents()).toHaveLength(8);
    expect(loadRecents()[0]?.peerId).toBe("p11");
  });

  it("esquece um peer", () => {
    rememberPeer("aaa", "Ana");
    rememberPeer("bbb", "Bia");
    forgetPeer("aaa");
    expect(loadRecents().map((entry) => entry.peerId)).toEqual(["bbb"]);
  });

  it("ignora nome vazio e peerId longo demais", () => {
    rememberPeer("aaa", "   ");
    rememberPeer("x".repeat(300), "Ana");
    expect(loadRecents()).toHaveLength(0);
  });
});
