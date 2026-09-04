import { describe, expect, it } from "vitest";
import {
  detectCodeLanguage,
  highlightCode,
  parseCodeArgs,
} from "@libs/code";

describe("detectCodeLanguage", () => {
  it("reconhece js, python, java, sql e shell", () => {
    expect(detectCodeLanguage("const x = 1;\nconsole.log(x);")).toBe("js");
    expect(detectCodeLanguage("def hello():\n    print(1)")).toBe("python");
    expect(
      detectCodeLanguage("public class Main { public static void main() {} }"),
    ).toBe("java");
    expect(detectCodeLanguage("SELECT id FROM users WHERE id = 1")).toBe("sql");
    expect(detectCodeLanguage("npm install && git status")).toBe("shell");
  });

  it("reconhece json, html e typescript", () => {
    expect(detectCodeLanguage('{"ok": true, "n": 1}')).toBe("json");
    expect(detectCodeLanguage("<div class=\"box\">oi</div>")).toBe("html");
    expect(
      detectCodeLanguage("type User = { name: string };\nconst x: string = \"a\";"),
    ).toBe("ts");
  });

  it("cai em texto quando não dá para cravar", () => {
    expect(detectCodeLanguage("oi, tudo bem?")).toBe("text");
  });
});

describe("parseCodeArgs", () => {
  it("usa a linguagem do primeiro token quando é um apelido", () => {
    expect(parseCodeArgs("js console.log(1)")).toEqual({
      language: "js",
      source: "console.log(1)",
    });
    expect(parseCodeArgs("python print(1)")).toEqual({
      language: "python",
      source: "print(1)",
    });
    expect(parseCodeArgs("bash echo oi")).toEqual({
      language: "shell",
      source: "echo oi",
    });
  });

  it("detecta sozinho quando não há linguagem", () => {
    expect(parseCodeArgs("SELECT * FROM t")).toEqual({
      language: "sql",
      source: "SELECT * FROM t",
    });
  });

  it("abre fence markdown e lê a linguagem da cerca", () => {
    expect(parseCodeArgs("```py\nprint(1)\n```")).toEqual({
      language: "python",
      source: "print(1)",
    });
    expect(parseCodeArgs("js\n```\nconst x = 1\n```")).toEqual({
      language: "js",
      source: "const x = 1",
    });
  });

  it("recusa vazio ou só o nome da linguagem", () => {
    expect(parseCodeArgs("")).toBeNull();
    expect(parseCodeArgs("   ")).toBeNull();
    expect(parseCodeArgs("js")).toBeNull();
    expect(parseCodeArgs("python")).toBeNull();
  });
});

describe("highlightCode", () => {
  it("marca palavras-chave, strings e comentários", () => {
    const tokens = highlightCode(
      'const x = "oi"; // fim',
      "js",
    );
    const types = tokens.map((token) => token.type);
    expect(types).toContain("keyword");
    expect(types).toContain("string");
    expect(types).toContain("comment");
    expect(tokens.some((token) => token.type === "keyword" && token.value.includes("const"))).toBe(
      true,
    );
  });

  it("não quebra o texto original", () => {
    const source = "SELECT id FROM t -- x";
    const tokens = highlightCode(source, "sql");
    expect(tokens.map((token) => token.value).join("")).toBe(source);
  });
});
