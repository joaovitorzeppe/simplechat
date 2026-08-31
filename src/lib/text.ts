/**
 * Cortar string por índice parte pares substitutos (emoji vira "\ud83d") e
 * separa marcas combinantes do caractere base, o que estraga devanágari,
 * tâmil, hangul decomposto e acentos. Tudo aqui trabalha em grafemas.
 */
const segmenter =
  typeof Intl !== "undefined" && "Segmenter" in Intl
    ? new Intl.Segmenter(undefined, { granularity: "grapheme" })
    : null;

export const graphemes = (value: string): string[] => {
  if (!segmenter) return [...value];
  return [...segmenter.segment(value)].map((part) => part.segment);
};

/**
 * Limita a `maxUnits` unidades UTF-16 sem partir um grafema. A unidade é a
 * mesma que `maxLength` do input e que a validação do wire usam, então o que
 * a interface deixa digitar é exatamente o que passa na outra ponta.
 */
export const truncateText = (value: string, maxUnits: number) => {
  if (value.length <= maxUnits) return value;
  let out = "";
  for (const grapheme of graphemes(value)) {
    if (out.length + grapheme.length > maxUnits) break;
    out += grapheme;
  }
  return out;
};

export const firstGrapheme = (value: string) => graphemes(value)[0] ?? "";
