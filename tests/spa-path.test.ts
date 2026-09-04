import { describe, expect, it } from "vitest";
import { spaHomeHref } from "@libs/spa-path";

describe("spaHomeHref", () => {
  it("não mexe na raiz", () => {
    expect(spaHomeHref({ pathname: "/", search: "", hash: "" })).toBeNull();
    expect(
      spaHomeHref({ pathname: "/", search: "?room=abc", hash: "#k=1" }),
    ).toBeNull();
  });

  it("joga path desconhecido para a home, preservando convite", () => {
    expect(spaHomeHref({ pathname: "/foo", search: "", hash: "" })).toBe("/");
    expect(
      spaHomeHref({
        pathname: "/pagina-inexistente",
        search: "?room=abc",
        hash: "#k=1",
      }),
    ).toBe("/?room=abc#k=1");
  });
});
