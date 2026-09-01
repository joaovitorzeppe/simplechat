import { describe, expect, it } from "vitest";
import {
  categoryToAlpha,
  confidenceToAlpha,
  fillWhiteAlpha,
  personConfidence,
} from "@libs/mask-composite";

describe("mask-composite", () => {
  it("usa o canal 1 quando o modelo emite fundo e pessoa", () => {
    const background = new Float32Array([0.9, 0.1]);
    const person = new Float32Array([0.1, 0.9]);
    expect(personConfidence([background, person])).toBe(person);
  });

  it("usa o único canal como probabilidade da pessoa", () => {
    const person = new Float32Array([0.2, 0.8]);
    expect(personConfidence([person])).toBe(person);
  });

  it("escala confiança para 0–255", () => {
    const alpha = confidenceToAlpha(new Float32Array([0, 0.5, 1]));
    expect([...alpha]).toEqual([0, 127, 255]);
  });

  it("categoria: 0 é fundo e 1 é pessoa", () => {
    const alpha = categoryToAlpha(new Uint8Array([0, 1, 0, 1]));
    expect([...alpha]).toEqual([0, 255, 0, 255]);
  });

  it("categoria: valores não-zero (ex. 255) também são pessoa", () => {
    const alpha = categoryToAlpha(new Uint8Array([0, 255]));
    expect([...alpha]).toEqual([0, 255]);
  });

  it("preenche RGBA branco com o alpha", () => {
    const pixels = new Uint8ClampedArray(8);
    fillWhiteAlpha(pixels, new Uint8ClampedArray([0, 200]));
    expect([...pixels]).toEqual([255, 255, 255, 0, 255, 255, 255, 200]);
  });
});
