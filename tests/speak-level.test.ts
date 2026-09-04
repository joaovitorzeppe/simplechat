import { describe, expect, it } from "vitest";
import {
  intensityFromRms,
  rmsFromTimeDomain,
  SPEAK_GATE,
  smoothSpeak,
} from "@libs/speak-level";

const silence = (length = 128) => Uint8Array.from({ length }, () => 128);

const loud = (length = 128) =>
  Uint8Array.from({ length }, (_, i) => (i % 2 === 0 ? 255 : 1));

describe("nível de fala", () => {
  it("silêncio absoluto tem RMS zero", () => {
    expect(rmsFromTimeDomain(silence())).toBe(0);
  });

  it("onda forte fica bem acima do limiar", () => {
    expect(rmsFromTimeDomain(loud())).toBeGreaterThan(SPEAK_GATE);
    expect(intensityFromRms(rmsFromTimeDomain(loud()))).toBe(1);
  });

  it("fala em volume normal já acende forte", () => {
    expect(intensityFromRms(0.05)).toBeGreaterThan(0.55);
  });

  it("ruído abaixo do limiar não acende a borda", () => {
    expect(intensityFromRms(SPEAK_GATE)).toBe(0);
    expect(intensityFromRms(SPEAK_GATE / 2)).toBe(0);
  });

  it("sobe rápido com a voz e some devagar", () => {
    let level = 0;
    level = smoothSpeak(0.4, level);
    expect(level).toBeGreaterThan(0.4);
    const peak = level;
    level = smoothSpeak(0, level);
    expect(level).toBeLessThan(peak);
    expect(level).toBeGreaterThan(0);
  });
});
