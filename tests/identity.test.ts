import { beforeEach, describe, expect, it } from "vitest";
import {
  clearIdentity,
  createIdentity,
  createPeerId,
  createRoomSecret,
  loadIdentity,
  loadRoomSecret,
  persistIdentity,
  rotateRoomSecret,
} from "@libs/identity";

const KEY = "simplechat.identity";

beforeEach(() => {
  localStorage.clear();
});

describe("peerId opaco", () => {
  it("não deixa vestígio do nome", () => {
    const id = createPeerId();
    expect(createIdentity("Ana Souza", id).peerId).toBe(id);
    expect(id).not.toContain("ana");
    expect(createPeerId()).toMatch(/^[0-9a-z]{25}$/);
  });

  it("gera chaves distintas a cada chamada", () => {
    const ids = new Set(Array.from({ length: 500 }, () => createPeerId()));
    expect(ids.size).toBe(500);
  });

  it("createIdentity gera a chave sozinho, sem receber o nome", () => {
    const identity = createIdentity("田中太郎");
    expect(identity.displayName).toBe("田中太郎");
    expect(identity.peerId).toMatch(/^[0-9a-z]{25}$/);
  });
});

describe("migração das chaves antigas", () => {
  it("troca chave que embutia o primeiro nome", () => {
    localStorage.setItem(
      KEY,
      JSON.stringify({
        displayName: "Ana Souza",
        peerId: "ana-8f14e45f-1700000000000",
      }),
    );
    const loaded = loadIdentity();
    expect(loaded?.displayName).toBe("Ana Souza");
    expect(loaded?.peerId).toMatch(/^[0-9a-z]{25}$/);
  });

  it("persiste a troca para não gerar chave nova a cada visita", () => {
    localStorage.setItem(
      KEY,
      JSON.stringify({ displayName: "Ana", peerId: "ana-abc-123" }),
    );
    const first = loadIdentity();
    const second = loadIdentity();
    expect(first?.peerId).toBe(second?.peerId);
  });

  it("mantém a chave que já está no formato novo", () => {
    const identity = createIdentity("Ana");
    persistIdentity(identity);
    expect(loadIdentity()).toEqual(identity);
  });
});

describe("segredo da sala", () => {
  it("é estável entre leituras", () => {
    expect(loadRoomSecret()).toBe(loadRoomSecret());
  });

  it("muda ao girar", () => {
    const before = loadRoomSecret();
    expect(rotateRoomSecret()).not.toBe(before);
    expect(loadRoomSecret()).not.toBe(before);
  });

  it("tem formato previsível e é sempre diferente", () => {
    const secrets = new Set(Array.from({ length: 500 }, createRoomSecret));
    expect(secrets.size).toBe(500);
    expect(createRoomSecret()).toMatch(/^[0-9a-z]{16}$/);
  });

  it("trocar de identidade também descarta o segredo", () => {
    const before = loadRoomSecret();
    clearIdentity();
    expect(loadRoomSecret()).not.toBe(before);
  });
});
