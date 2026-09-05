import { describe, expect, it } from "vitest";
import { screenStageKind } from "@libs/screen-layout";

describe("screenStageKind", () => {
  it("só câmeras sem compartilhamento", () => {
    expect(screenStageKind(0, false, false)).toBe("cameras");
    expect(screenStageKind(0, true, true)).toBe("cameras");
  });

  it("telas dividem o espaço quando ninguém fixou", () => {
    expect(screenStageKind(1, false, false)).toBe("split");
    expect(screenStageKind(2, false, true)).toBe("split");
  });

  it("fixado com câmeras ocultas esconde as outras telas", () => {
    expect(screenStageKind(2, true, false)).toBe("pinned-solo");
  });

  it("fixado com câmeras visíveis mantém faixa das outras telas", () => {
    expect(screenStageKind(2, true, true)).toBe("pinned-strip");
  });
});
