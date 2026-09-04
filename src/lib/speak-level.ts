/** Abaixo disso é ruído de fundo, não fala. */
export const SPEAK_GATE = 0.045;
/** RMS típico de fala próxima do microfone; acima disso a borda fica no máximo. */
const SPEAK_PEAK = 0.3;

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
  return Math.min(1, (rms - SPEAK_GATE) / (SPEAK_PEAK - SPEAK_GATE));
};

/** Sobe rápido com a voz e some devagar, para a borda não piscar. */
export const smoothSpeak = (rms: number, prev: number): number => {
  const target = intensityFromRms(rms);
  const next =
    target > prev ? prev * 0.35 + target * 0.65 : prev * 0.86 + target * 0.14;
  return next < 0.02 ? 0 : next;
};
