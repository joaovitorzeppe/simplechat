import { describe, expect, it } from "vitest";
import { supportedLocales } from "@i18n/i18n";
import { legalDoc } from "@i18n/legal";

describe("legalDoc", () => {
  it("tem as mesmas seções em todos os idiomas", () => {
    for (const kind of ["privacy", "terms"] as const) {
      const pt = legalDoc(kind, "pt");
      expect(pt.sections.length).toBeGreaterThan(0);
      for (const locale of supportedLocales) {
        const doc = legalDoc(kind, locale);
        expect(doc.sections).toHaveLength(pt.sections.length);
        expect(doc.title.length).toBeGreaterThan(0);
        expect(doc.intro.length).toBeGreaterThan(0);
      }
    }
  });
});
