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

  it("mantém as páginas legais", () => {
    expect(
      spaHomeHref({ pathname: "/privacy", search: "", hash: "" }),
    ).toBeNull();
    expect(spaHomeHref({ pathname: "/terms", search: "", hash: "" })).toBeNull();
  });

  it("tira a barra final das páginas legais", () => {
    expect(
      spaHomeHref({ pathname: "/privacy/", search: "", hash: "" }),
    ).toBe("/privacy");
    expect(
      spaHomeHref({
        pathname: "/terms/",
        search: "?room=abc",
        hash: "#k=1",
      }),
    ).toBe("/terms?room=abc#k=1");
  });
});
