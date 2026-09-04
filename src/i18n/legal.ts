import type { Locale } from "./i18n";
import { privacy } from "./legal-privacy";
import { terms } from "./legal-terms";
import type { LegalDocument } from "./legal-types";
import type { LegalKind } from "@libs/spa-path";

export type { LegalDocument, LegalSection } from "./legal-types";

const documents: Record<LegalKind, Record<Locale, LegalDocument>> = {
  privacy,
  terms,
};

export const legalDoc = (kind: LegalKind, locale: Locale) => {
  return documents[kind][locale];
};
