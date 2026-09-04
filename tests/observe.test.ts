import { describe, expect, it } from "vitest";
import { publicObserveUrl } from "@libs/observe";

describe("publicObserveUrl", () => {
  it("remove query e hash do convite", () => {
    expect(
      publicObserveUrl("https://simplechat.app/?room=abc#k=segredo"),
    ).toBe("https://simplechat.app/");
  });

  it("mantém a origem quando já é a raiz", () => {
    expect(publicObserveUrl("https://simplechat.app/")).toBe(
      "https://simplechat.app/",
    );
  });
});
