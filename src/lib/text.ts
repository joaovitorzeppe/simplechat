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
  if (!segmenter) {
    return [...value];
  }
  return [...segmenter.segment(value)].map((part) => part.segment);
};

/**
 * Limita a `maxUnits` unidades UTF-16 sem partir um grafema. A unidade é a
 * mesma que `maxLength` do input e que a validação do wire usam, então o que
 * a interface deixa digitar é exatamente o que passa na outra ponta.
 */
export const truncateText = (value: string, maxUnits: number) => {
  if (value.length <= maxUnits) {
    return value;
  }
  let out = "";
  for (const grapheme of graphemes(value)) {
    if (out.length + grapheme.length > maxUnits) {
      break;
    }
    out += grapheme;
  }
  return out;
};

export const firstGrapheme = (value: string) => graphemes(value)[0] ?? "";

const foldedName = (value: string) => value.trim().toLowerCase();

/**
 * Duas pessoas com o mesmo nome na sala. O número segue a ordem do array
 * (`people`): quem entrou primeiro fica `- 1`.
 */
export const displayLabel = (
  name: string,
  peerId: string,
  people: readonly { peerId: string; displayName: string }[],
) => {
  const key = foldedName(name);
  const same = people.filter((person) => foldedName(person.displayName) === key);
  if (same.length < 2) {
    return name;
  }
  const at = same.findIndex((person) => person.peerId === peerId);
  return `${name} - ${at < 0 ? same.length + 1 : at + 1}`;
};
