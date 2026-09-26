/**
 * Selfie Segmenter: canal 0 = fundo, canal 1 = pessoa.
 * Um único canal de confiança é probabilidade da pessoa.
 */
export const personConfidence = (masks: Float32Array[]): Float32Array => {
  if (masks.length === 0) {
    return new Float32Array(0);
  }
  return masks.length > 1 ? masks[1] : masks[0];
};

export const confidenceToAlpha = (
  values: Float32Array,
): Uint8ClampedArray => {
  const out = new Uint8ClampedArray(values.length);
  for (let i = 0; i < values.length; i++) {
    const raw = values[i];
    out[i] = raw <= 0 ? 0 : raw >= 1 ? 255 : (raw * 255) | 0;
  }
  return out;
};

/** Category mask: índice 0 = fundo; qualquer outro valor é pessoa (1 ou 255). */
export const categoryToAlpha = (values: Uint8Array): Uint8ClampedArray => {
  const out = new Uint8ClampedArray(values.length);
  for (let i = 0; i < values.length; i++) {
    out[i] = values[i] === 0 ? 0 : 255;
  }
  return out;
};

/** RGBA branco com o alpha da pessoa, para `destination-in`. */
export const fillWhiteAlpha = (
  pixels: Uint8ClampedArray,
  alpha: Uint8ClampedArray,
) => {
  for (let i = 0; i < alpha.length; i++) {
    const o = i * 4;
    pixels[o] = 255;
    pixels[o + 1] = 255;
    pixels[o + 2] = 255;
    pixels[o + 3] = alpha[i];
  }
};
