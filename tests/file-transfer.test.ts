import { describe, expect, it } from "vitest";
import { IncomingBuffer, MAX_INCOMING_BYTES } from "@libs/file-assembly";
import { FileBridge } from "@libs/file-transfer";

const meta = (size: number, peerId = "peer-1") => ({
  peerId,
  remoteId: "r1",
  localId: "l1",
  mime: "text/plain",
  size,
});

describe("IncomingBuffer", () => {
  it("monta o blob quando os bytes batem o tamanho", async () => {
    const incoming = new IncomingBuffer(meta(5));
    const ok = await incoming.push(new TextEncoder().encode("hello").buffer, 0);
    expect(ok).toBe(true);
    const blob = await incoming.finish();
    expect(blob).not.toBeNull();
    expect(await blob?.text()).toBe("hello");
  });

  it("recusa o que passa do tamanho anunciado", async () => {
    const incoming = new IncomingBuffer(meta(3));
    expect(await incoming.push(new Uint8Array([1, 2, 3, 4]).buffer, 0)).toBe(
      false,
    );
  });

  it("recusa o que estoura o teto global", async () => {
    const incoming = new IncomingBuffer(meta(MAX_INCOMING_BYTES + 1));
    expect(
      await incoming.push(new Uint8Array([1]).buffer, MAX_INCOMING_BYTES),
    ).toBe(false);
  });

  it("devolve nulo se terminar incompleto", async () => {
    const incoming = new IncomingBuffer(meta(4));
    await incoming.push(new Uint8Array([1, 2]).buffer, 0);
    expect(await incoming.finish()).toBeNull();
  });
});

describe("FileBridge sem worker", () => {
  it("fatiar o arquivo devolve o pedaço certo", async () => {
    const bridge = new FileBridge();
    const file = new File(["abcdefghij"], "a.txt", { type: "text/plain" });
    await bridge.openSend("f1", file);
    const first = await bridge.readSlice("f1", 0, 4);
    const second = await bridge.readSlice("f1", 4, 4);
    expect(new TextDecoder().decode(first)).toBe("abcd");
    expect(new TextDecoder().decode(second)).toBe("efgh");
    await bridge.closeSend("f1");
  });

  it("recebe e devolve o blob no finish", async () => {
    const bridge = new FileBridge();
    await bridge.openReceive(meta(4));
    expect(await bridge.push("peer-1", new Uint8Array([1, 2]).buffer)).toBe(2);
    expect(await bridge.push("peer-1", new Uint8Array([3, 4]).buffer)).toBe(4);
    const blob = await bridge.finish("peer-1");
    expect(blob).not.toBeNull();
    expect(new Uint8Array(await blob!.arrayBuffer())).toEqual(
      new Uint8Array([1, 2, 3, 4]),
    );
  });

  it("abort descarta o que estava no meio", async () => {
    const bridge = new FileBridge();
    await bridge.openReceive(meta(4));
    await bridge.push("peer-1", new Uint8Array([1, 2]).buffer);
    await bridge.abort("peer-1");
    expect(await bridge.finish("peer-1")).toBeNull();
  });
});
