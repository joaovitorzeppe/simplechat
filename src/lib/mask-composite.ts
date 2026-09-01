/** Média dos quatro cantos — no selfie o fundo costuma estar aí. */
export const cornerMean = (
  data: ArrayLike<number>,
  width: number,
  height: number,
): number => {
  const lastRow = (height - 1) * width;
  return (
    (data[0] +
      data[width - 1] +
      data[lastRow] +
      data[lastRow + width - 1]) /
    4
  );
};

/**
 * Confiança alta = pessoa. Se os cantos vierem altos, a máscara está invertida.
 */
export const confidenceToAlpha = (
  values: Float32Array,
  invert: boolean,
): Uint8ClampedArray => {
  const out = new Uint8ClampedArray(values.length);
  for (let i = 0; i < values.length; i++) {
    const raw = invert ? 1 - values[i] : values[i];
    out[i] = raw <= 0 ? 0 : raw >= 1 ? 255 : (raw * 255) | 0;
  }
  return out;
};

export const categoryToAlpha = (
  values: Uint8Array,
  invert: boolean,
): Uint8ClampedArray => {
  const out = new Uint8ClampedArray(values.length);
  for (let i = 0; i < values.length; i++) {
    const person = invert ? values[i] < 128 : values[i] >= 128;
    out[i] = person ? 255 : 0;
  }
  return out;
};

/** Escolhe a máscara de confiança cujo canto é mais “fundo” (valor menor). */
export const pickPersonConfidence = (
  masks: Float32Array[],
  width: number,
  height: number,
): Float32Array => {
  if (masks.length === 0) return new Float32Array(0);
  let best = masks[0];
  let bestMean = cornerMean(best, width, height);
  for (let i = 1; i < masks.length; i++) {
    const mean = cornerMean(masks[i], width, height);
    if (mean < bestMean) {
      best = masks[i];
      bestMean = mean;
    }
  }
  return best;
};

export const personAlphaFromConfidence = (
  values: Float32Array,
  width: number,
  height: number,
): Uint8ClampedArray => {
  const invert = cornerMean(values, width, height) > 0.5;
  return confidenceToAlpha(values, invert);
};

export const personAlphaFromCategory = (
  values: Uint8Array,
  width: number,
  height: number,
): Uint8ClampedArray => {
  const invert = cornerMean(values, width, height) > 127;
  return categoryToAlpha(values, invert);
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
