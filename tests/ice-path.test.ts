import { describe, expect, it } from "vitest";
import { iceGaveUpKind } from "../src/lib/ice-path";

describe("iceGaveUpKind", () => {
  it("trata falha sem nunca conectar como bloqueio de caminho", () => {
    expect(iceGaveUpKind(false)).toBe("path");
  });

  it("trata falha depois de conectar como queda do peer", () => {
    expect(iceGaveUpKind(true)).toBe("drop");
  });
});
