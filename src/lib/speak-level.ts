/** Abaixo disso é ruído de fundo, não fala. */
export const SPEAK_GATE = 0.016;
/** Fala em volume normal já chega perto do máximo. */
const SPEAK_PEAK = 0.1;

export const rmsFromTimeDomain = (samples: Uint8Array): number => {
  if (samples.length === 0) return 0;
  let sum = 0;
  for (const sample of samples) {
    const value = (sample - 128) / 128;
    sum += value * value;
  }
  return Math.sqrt(sum / samples.length);
};

export const intensityFromRms = (rms: number): number => {
  if (rms <= SPEAK_GATE) return 0;
  const linear = Math.min(1, (rms - SPEAK_GATE) / (SPEAK_PEAK - SPEAK_GATE));
  return Math.sqrt(linear);
};

/** Sobe rápido com a voz e some devagar, para a borda não piscar. */
export const smoothSpeak = (rms: number, prev: number): number => {
  const target = intensityFromRms(rms);
  const next =
    target > prev ? prev * 0.12 + target * 0.88 : prev * 0.82 + target * 0.18;
  return next < 0.02 ? 0 : next;
};
