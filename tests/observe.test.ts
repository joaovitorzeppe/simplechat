import { describe, expect, it } from "vitest";
import { publicObserveUrl } from "@libs/observe";

describe("publicObserveUrl", () => {
  it("remove query e hash do convite", () => {
    expect(
      publicObserveUrl("https://www.simplechat.me/?room=abc#k=segredo"),
    ).toBe("https://www.simplechat.me/");
  });

  it("mantém a origem quando já é a raiz", () => {
    expect(publicObserveUrl("https://www.simplechat.me/")).toBe(
      "https://www.simplechat.me/",
    );
  });
});
