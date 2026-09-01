import { describe, expect, it } from "vitest";
import {
  categoryToAlpha,
  confidenceToAlpha,
  cornerMean,
  fillWhiteAlpha,
  personAlphaFromCategory,
  personAlphaFromConfidence,
  pickPersonConfidence,
} from "@libs/mask-composite";

describe("mask-composite", () => {
  it("média dos quatro cantos", () => {
    const data = new Float32Array([1, 0, 9, 0, 0, 0, 3, 0, 7]);
    expect(cornerMean(data, 3, 3)).toBe((1 + 9 + 3 + 7) / 4);
  });

  it("inverte confiança quando o canto parece pessoa", () => {
    const values = new Float32Array([0.95, 0.1, 0.2, 0.9]);
    const alpha = personAlphaFromConfidence(values, 2, 2);
    expect(alpha[0]).toBeLessThan(40);
    expect(alpha[1]).toBeGreaterThan(200);
  });

  it("não inverte confiança quando o canto é fundo", () => {
    const values = new Float32Array([0.05, 0.95, 0.9, 0.1]);
    const alpha = personAlphaFromConfidence(values, 2, 2);
    expect(alpha[0]).toBeLessThan(40);
    expect(alpha[1]).toBeGreaterThan(200);
  });

  it("escala confiança para 0–255", () => {
    const alpha = confidenceToAlpha(new Float32Array([0, 0.5, 1]), false);
    expect([...alpha]).toEqual([0, 127, 255]);
  });

  it("categoria: cantos altos significam 0 = pessoa", () => {
    const mask = new Uint8Array([255, 0, 0, 255]);
    const alpha = personAlphaFromCategory(mask, 2, 2);
    expect(alpha[0]).toBe(0);
    expect(alpha[1]).toBe(255);
  });

  it("categoria sem inverter", () => {
    const alpha = categoryToAlpha(new Uint8Array([0, 200]), false);
    expect([...alpha]).toEqual([0, 255]);
  });

  it("escolhe a máscara com canto mais baixo", () => {
    const bg = new Float32Array([0.9, 0.9, 0.9, 0.9]);
    const person = new Float32Array([0.1, 0.8, 0.7, 0.1]);
    const picked = pickPersonConfidence([bg, person], 2, 2);
    expect(picked).toBe(person);
  });

  it("preenche RGBA branco com o alpha", () => {
    const pixels = new Uint8ClampedArray(8);
    fillWhiteAlpha(pixels, new Uint8ClampedArray([0, 200]));
    expect([...pixels]).toEqual([255, 255, 255, 0, 255, 255, 255, 200]);
  });
});
