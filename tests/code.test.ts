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

  it("reconhece c, c++, c#, go e rust", () => {
    expect(detectCodeLanguage("#include <stdio.h>\nint main(void) { printf(\"x\"); }")).toBe(
      "c",
    );
    expect(
      detectCodeLanguage("#include <iostream>\nint main() { std::cout << 1; }"),
    ).toBe("cpp");
    expect(
      detectCodeLanguage("using System;\nnamespace App { class P { static void Main() { Console.WriteLine(1); } } }"),
    ).toBe("csharp");
    expect(detectCodeLanguage("package main\nfunc main() { fmt.Println(1) }")).toBe(
      "go",
    );
    expect(detectCodeLanguage("fn main() { let mut x = 1; println!(\"{}\", x); }")).toBe(
      "rust",
    );
  });

  it("reconhece kotlin, swift, php e markdown", () => {
    expect(
      detectCodeLanguage("fun main() {\n  val x = 1\n  println(x)\n}"),
    ).toBe("kotlin");
    expect(
      detectCodeLanguage(
        "import Foundation\nfunc hello() -> String { guard true else { return \"\" }; return \"oi\" }",
      ),
    ).toBe("swift");
    expect(
      detectCodeLanguage("<?php\n$x = 1;\necho $x;\nfunction hi() { return 1; }"),
    ).toBe("php");
    expect(
      detectCodeLanguage("# Título\n\n- item\n\n[link](https://ex.com)\n\n**negrito**"),
    ).toBe("markdown");
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
    expect(parseCodeArgs("c++ int x = 1;")).toEqual({
      language: "cpp",
      source: "int x = 1;",
    });
    expect(parseCodeArgs("c# Console.WriteLine(1);")).toEqual({
      language: "csharp",
      source: "Console.WriteLine(1);",
    });
    expect(parseCodeArgs("golang fmt.Println(1)")).toEqual({
      language: "go",
      source: "fmt.Println(1)",
    });
    expect(parseCodeArgs("rs fn main() {}")).toEqual({
      language: "rust",
      source: "fn main() {}",
    });
    expect(parseCodeArgs("kt fun main() {}")).toEqual({
      language: "kotlin",
      source: "fun main() {}",
    });
    expect(parseCodeArgs("md # Olá")).toEqual({
      language: "markdown",
      source: "# Olá",
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

  it("destaca headings e links em markdown", () => {
    const source = "# Título\n[site](https://ex.com)";
    const tokens = highlightCode(source, "markdown");
    expect(tokens.map((token) => token.value).join("")).toBe(source);
    expect(tokens.some((token) => token.type === "keyword")).toBe(true);
    expect(tokens.some((token) => token.type === "string")).toBe(true);
  });
});
