export const CODE_LANGUAGES = [
  "js",
  "ts",
  "python",
  "java",
  "kotlin",
  "swift",
  "c",
  "cpp",
  "csharp",
  "go",
  "rust",
  "php",
  "sql",
  "shell",
  "html",
  "css",
  "json",
  "markdown",
  "text",
] as const;

export type CodeLanguage = (typeof CODE_LANGUAGES)[number];

export const MAX_COMMAND_CODE = 3500;

export const CODE_LANGUAGE_LABELS: Record<CodeLanguage, string> = {
  js: "JavaScript",
  ts: "TypeScript",
  python: "Python",
  java: "Java",
  kotlin: "Kotlin",
  swift: "Swift",
  c: "C",
  cpp: "C++",
  csharp: "C#",
  go: "Go",
  rust: "Rust",
  php: "PHP",
  sql: "SQL",
  shell: "Shell",
  html: "HTML",
  css: "CSS",
  json: "JSON",
  markdown: "Markdown",
  text: "Text",
};

const LANGUAGE_ALIASES: Record<string, CodeLanguage> = {
  js: "js",
  javascript: "js",
  node: "js",
  jsx: "js",
  ts: "ts",
  typescript: "ts",
  tsx: "ts",
  python: "python",
  py: "python",
  java: "java",
  kotlin: "kotlin",
  kt: "kotlin",
  kts: "kotlin",
  swift: "swift",
  c: "c",
  cpp: "cpp",
  "c++": "cpp",
  cxx: "cpp",
  cc: "cpp",
  csharp: "csharp",
  "c#": "csharp",
  cs: "csharp",
  go: "go",
  golang: "go",
  rust: "rust",
  rs: "rust",
  php: "php",
  sql: "sql",
  mysql: "sql",
  postgres: "sql",
  postgresql: "sql",
  shell: "shell",
  bash: "shell",
  sh: "shell",
  zsh: "shell",
  terminal: "shell",
  console: "shell",
  html: "html",
  xml: "html",
  css: "css",
  json: "json",
  markdown: "markdown",
  md: "markdown",
  text: "text",
  txt: "text",
  plain: "text",
  plaintext: "text",
};

export const isCodeLanguage = (value: string): value is CodeLanguage => {
  return (CODE_LANGUAGES as readonly string[]).includes(value);
};

export const resolveCodeLanguage = (value: string): CodeLanguage | null => {
  const key = value.trim().toLowerCase();
  return LANGUAGE_ALIASES[key] ?? (isCodeLanguage(key) ? key : null);
};

const unwrapFence = (
  raw: string,
): { language: string | null; source: string } => {
  const match = raw
    .trim()
    .match(/^```([a-zA-Z0-9_+-]*)[ \t]*\r?\n([\s\S]*?)\r?\n?```$/);
  if (!match) {
    return { language: null, source: raw };
  }
  return { language: match[1] || null, source: match[2] ?? "" };
};

const countHits = (source: string, patterns: RegExp[]) => {
  let total = 0;
  for (const pattern of patterns) {
    if (pattern.test(source)) {
      total += 1;
    }
  }
  return total;
};

export const detectCodeLanguage = (source: string): CodeLanguage => {
  const text = source.trim();
  if (!text) {
    return "text";
  }

  const scores: Record<Exclude<CodeLanguage, "text">, number> = {
    js: 0,
    ts: 0,
    python: 0,
    java: 0,
    kotlin: 0,
    swift: 0,
    c: 0,
    cpp: 0,
    csharp: 0,
    go: 0,
    rust: 0,
    php: 0,
    sql: 0,
    shell: 0,
    html: 0,
    css: 0,
    json: 0,
    markdown: 0,
  };

  if (text.startsWith("{") || text.startsWith("[")) {
    try {
      JSON.parse(text);
      scores.json += 6;
    } catch {
      // trecho que só parece JSON
    }
  }

  scores.sql +=
    countHits(text, [
      /\b(select|insert|update|delete|alter|create|drop)\b.+\b(from|into|table|set|where|values)\b/is,
      /\b(inner|left|right|full)\s+join\b/i,
      /\bgroup\s+by\b/i,
      /\border\s+by\b/i,
    ]) * 2;

  scores.python += countHits(text, [
    /\bdef\s+\w+\s*\(/,
    /\belif\b/,
    /\bfrom\s+\w[\w.]*\s+import\b/,
    /\bNone\b/,
    /:\r?\n[ \t]+\S/,
    /\bprint\s*\(/,
  ]);

  scores.java +=
    countHits(text, [
      /\bpublic\s+(class|interface|enum)\b/,
      /\bpublic\s+static\s+void\b/,
      /System\.out/,
      /\b@Override\b/,
    ]) * 2;

  scores.kotlin +=
    countHits(text, [
      /\bfun\s+\w+/,
      /\b(val|var)\s+\w+/,
      /\bcompanion\s+object\b/,
      /\bdata\s+class\b/,
      /\bsuspend\s+fun\b/,
      /\?\.|\?:/,
    ]) * 2;

  scores.swift +=
    countHits(text, [
      /\bimport\s+Foundation\b/,
      /\bfunc\s+\w+/,
      /\bguard\s+/,
      /\b(let|var)\s+\w+\s*[:=]/,
      /\bUIView|SwiftUI|@State\b/,
      /->\s*(Void|String|Int|Bool)\b/,
    ]) * 2;

  scores.php +=
    countHits(text, [
      /<\?php\b/,
      /\$\w+/,
      /\becho\s+/,
      /\bfunction\s+\w+\s*\(/,
      /->\w+\s*\(/,
      /\brequire(_once)?\s*\(/,
    ]) * 2;

  scores.csharp +=
    countHits(text, [
      /\busing\s+System\b/,
      /\bnamespace\s+\w/,
      /\bConsole\.(Write|WriteLine)\b/,
      /\basync\s+Task\b/,
      /\bstring\[\]\s+args\b/,
    ]) * 2;

  scores.cpp +=
    countHits(text, [
      /#include\s*<[\w./]+>/,
      /\bstd::/,
      /\bnullptr\b/,
      /\btemplate\s*</,
      /\bcout\s*<</,
      /\bnamespace\s+\w+\s*\{/,
    ]) * 2;

  scores.c +=
    countHits(text, [
      /#include\s*[<"]/,
      /\bprintf\s*\(/,
      /\bint\s+main\s*\(/,
      /\bsizeof\s*\(/,
      /\bNULL\b/,
    ]) * 2;

  scores.go +=
    countHits(text, [
      /\bpackage\s+\w+/,
      /\bfunc\s+(\w+\s*)?\(/,
      /:=/,
      /\bfmt\./,
      /\bgo\s+func\b/,
      /\bdefer\b/,
    ]) * 2;

  scores.rust +=
    countHits(text, [
      /\bfn\s+\w+/,
      /\blet\s+mut\b/,
      /\bimpl\b/,
      /\bprintln!\s*\(/,
      /\buse\s+\w[\w:]*::/,
      /\bpub\s+(fn|struct|enum|mod)\b/,
    ]) * 2;

  scores.ts += countHits(text, [
    /\binterface\s+[A-Z]\w*/,
    /\btype\s+[A-Z]\w*\s*=/,
    /:\s*(string|number|boolean|void|unknown|never)\b/,
    /\bas\s+const\b/,
  ]);

  scores.js += countHits(text, [
    /\b(const|let)\s+\w+\s*=/,
    /=>/,
    /console\.(log|error|warn|info)\s*\(/,
    /\bfunction\b/,
    /\b(import|export)\s+/,
    /\b(document|window)\./,
  ]);

  scores.shell +=
    countHits(text, [
      /^#!/,
      /^\s*[$#]\s+\S/m,
      /^\s*(sudo\s+)?(npm|npx|git|curl|chmod|export|echo|cd|ls|mkdir|docker|brew|apt|yarn|pnpm)\b/m,
      / \|\s*\w+/,
    ]) * 2;

  scores.html += countHits(text, [
    /<\/?[a-zA-Z][\w:-]*[\s>]/,
    /<!DOCTYPE/i,
    /<\/[a-zA-Z][\w:-]*>/,
  ]);

  scores.css += countHits(text, [
    /[.#]?[\w-]+\s*\{[^}]*:[^}]+\}/,
    /@(media|import|keyframes)\b/,
  ]);

  scores.markdown += countHits(text, [
    /^#{1,6}\s+\S/m,
    /^\s*[-*+]\s+\S/m,
    /\[[^\]]+\]\([^)]+\)/,
    /^\s*```/m,
    /\*\*[^*\n]+\*\*/,
  ]);

  if (scores.json >= 6) {
    return "json";
  }
  if (scores.rust >= 2) {
    return "rust";
  }
  if (scores.go >= 2 && scores.go >= scores.swift) {
    return "go";
  }
  if (scores.swift >= 2) {
    return "swift";
  }
  if (scores.kotlin >= 2) {
    return "kotlin";
  }
  if (scores.csharp >= 2) {
    return "csharp";
  }
  if (scores.php >= 2) {
    return "php";
  }
  if (scores.cpp >= scores.c && scores.cpp >= 2) {
    return "cpp";
  }
  if (scores.c >= 2 && scores.c > scores.java) {
    return "c";
  }
  if (scores.java >= scores.js && scores.java >= 2) {
    return "java";
  }
  if (scores.ts > 0 && scores.ts >= scores.js) {
    return "ts";
  }
  if (scores.markdown >= 3 && scores.html < 2) {
    return "markdown";
  }

  let best: CodeLanguage = "text";
  let bestScore = 0;
  for (const language of CODE_LANGUAGES) {
    if (language === "text") {
      continue;
    }
    const score = scores[language];
    if (score > bestScore) {
      best = language;
      bestScore = score;
    }
  }
  return bestScore > 0 ? best : "text";
};

export const parseCodeArgs = (
  args: string,
): { language: CodeLanguage; source: string } | null => {
  const raw = args.trim();
  if (!raw) {
    return null;
  }
  if (resolveCodeLanguage(raw) && !/\s/.test(raw)) {
    return null;
  }

  const fenced = unwrapFence(raw);
  if (fenced.language !== null || fenced.source !== raw) {
    const source = fenced.source.trim();
    if (!source) {
      return null;
    }
    const language =
      (fenced.language ? resolveCodeLanguage(fenced.language) : null) ??
      detectCodeLanguage(source);
    return { language, source: source.slice(0, MAX_COMMAND_CODE) };
  }

  const match = raw.match(/^(\S+)([ \t]+|[ \t]*\r?\n)([\s\S]+)$/);
  if (match?.[1] && match[3] !== undefined) {
    const hinted = resolveCodeLanguage(match[1]);
    if (hinted) {
      const inner = unwrapFence(match[3].trim());
      const source = inner.source.trim();
      if (!source) {
        return null;
      }
      const language =
        (inner.language ? resolveCodeLanguage(inner.language) : null) ?? hinted;
      return { language, source: source.slice(0, MAX_COMMAND_CODE) };
    }
  }

  const source = raw.slice(0, MAX_COMMAND_CODE);
  return { language: detectCodeLanguage(source), source };
};

export type CodeToken = {
  type: "plain" | "comment" | "string" | "number" | "keyword" | "punct";
  value: string;
};

const KEYWORDS: Record<
  Exclude<CodeLanguage, "text" | "html" | "css" | "markdown">,
  Set<string>
> =
  {
    js: new Set([
      "async",
      "await",
      "break",
      "case",
      "catch",
      "class",
      "const",
      "continue",
      "debugger",
      "default",
      "delete",
      "do",
      "else",
      "export",
      "extends",
      "false",
      "finally",
      "for",
      "from",
      "function",
      "if",
      "import",
      "in",
      "instanceof",
      "let",
      "new",
      "null",
      "of",
      "return",
      "static",
      "super",
      "switch",
      "this",
      "throw",
      "true",
      "try",
      "typeof",
      "var",
      "void",
      "while",
      "with",
      "yield",
    ]),
    ts: new Set([
      "abstract",
      "any",
      "as",
      "async",
      "await",
      "boolean",
      "break",
      "case",
      "catch",
      "class",
      "const",
      "continue",
      "declare",
      "default",
      "delete",
      "do",
      "else",
      "enum",
      "export",
      "extends",
      "false",
      "finally",
      "for",
      "from",
      "function",
      "if",
      "implements",
      "import",
      "in",
      "infer",
      "instanceof",
      "interface",
      "keyof",
      "let",
      "namespace",
      "never",
      "new",
      "null",
      "number",
      "of",
      "private",
      "protected",
      "public",
      "readonly",
      "return",
      "satisfies",
      "static",
      "string",
      "super",
      "switch",
      "this",
      "throw",
      "true",
      "try",
      "type",
      "typeof",
      "undefined",
      "unknown",
      "var",
      "void",
      "while",
      "yield",
    ]),
    python: new Set([
      "False",
      "None",
      "True",
      "and",
      "as",
      "assert",
      "async",
      "await",
      "break",
      "class",
      "continue",
      "def",
      "del",
      "elif",
      "else",
      "except",
      "finally",
      "for",
      "from",
      "global",
      "if",
      "import",
      "in",
      "is",
      "lambda",
      "match",
      "nonlocal",
      "not",
      "or",
      "pass",
      "raise",
      "return",
      "try",
      "while",
      "with",
      "yield",
    ]),
    java: new Set([
      "abstract",
      "assert",
      "boolean",
      "break",
      "byte",
      "case",
      "catch",
      "char",
      "class",
      "const",
      "continue",
      "default",
      "do",
      "double",
      "else",
      "enum",
      "extends",
      "false",
      "final",
      "finally",
      "float",
      "for",
      "if",
      "implements",
      "import",
      "instanceof",
      "int",
      "interface",
      "long",
      "native",
      "new",
      "null",
      "package",
      "private",
      "protected",
      "public",
      "return",
      "short",
      "static",
      "super",
      "switch",
      "synchronized",
      "this",
      "throw",
      "throws",
      "transient",
      "true",
      "try",
      "void",
      "volatile",
      "while",
    ]),
    kotlin: new Set([
      "abstract",
      "actual",
      "annotation",
      "as",
      "break",
      "by",
      "catch",
      "class",
      "companion",
      "const",
      "constructor",
      "continue",
      "crossinline",
      "data",
      "delegate",
      "do",
      "dynamic",
      "else",
      "enum",
      "expect",
      "external",
      "false",
      "field",
      "file",
      "final",
      "finally",
      "for",
      "fun",
      "get",
      "if",
      "import",
      "in",
      "infix",
      "init",
      "inline",
      "inner",
      "interface",
      "internal",
      "is",
      "lateinit",
      "noinline",
      "null",
      "object",
      "open",
      "operator",
      "out",
      "override",
      "package",
      "param",
      "private",
      "property",
      "protected",
      "public",
      "receiver",
      "reified",
      "return",
      "sealed",
      "set",
      "setparam",
      "super",
      "suspend",
      "tailrec",
      "this",
      "throw",
      "true",
      "try",
      "typealias",
      "typeof",
      "val",
      "var",
      "vararg",
      "when",
      "where",
      "while",
    ]),
    swift: new Set([
      "associatedtype",
      "class",
      "deinit",
      "enum",
      "extension",
      "fileprivate",
      "func",
      "import",
      "init",
      "inout",
      "internal",
      "let",
      "open",
      "operator",
      "private",
      "protocol",
      "public",
      "rethrows",
      "static",
      "struct",
      "subscript",
      "typealias",
      "var",
      "break",
      "case",
      "continue",
      "default",
      "defer",
      "do",
      "else",
      "fallthrough",
      "for",
      "guard",
      "if",
      "in",
      "repeat",
      "return",
      "switch",
      "where",
      "while",
      "as",
      "Any",
      "catch",
      "false",
      "is",
      "nil",
      "super",
      "self",
      "Self",
      "throw",
      "throws",
      "true",
      "try",
      "associativity",
      "convenience",
      "dynamic",
      "didSet",
      "final",
      "get",
      "infix",
      "indirect",
      "lazy",
      "left",
      "mutating",
      "none",
      "nonmutating",
      "optional",
      "override",
      "postfix",
      "precedence",
      "prefix",
      "Protocol",
      "required",
      "right",
      "set",
      "Type",
      "unowned",
      "weak",
      "willSet",
      "async",
      "await",
      "actor",
      "some",
      "opaque",
    ]),
    c: new Set([
      "auto",
      "break",
      "case",
      "char",
      "const",
      "continue",
      "default",
      "do",
      "double",
      "else",
      "enum",
      "extern",
      "float",
      "for",
      "goto",
      "if",
      "inline",
      "int",
      "long",
      "register",
      "restrict",
      "return",
      "short",
      "signed",
      "sizeof",
      "static",
      "struct",
      "switch",
      "typedef",
      "union",
      "unsigned",
      "void",
      "volatile",
      "while",
      "_Bool",
      "_Complex",
      "_Imaginary",
      "NULL",
    ]),
    cpp: new Set([
      "alignas",
      "alignof",
      "and",
      "and_eq",
      "asm",
      "auto",
      "bitand",
      "bitor",
      "bool",
      "break",
      "case",
      "catch",
      "char",
      "char8_t",
      "char16_t",
      "char32_t",
      "class",
      "compl",
      "concept",
      "const",
      "consteval",
      "constexpr",
      "constinit",
      "const_cast",
      "continue",
      "co_await",
      "co_return",
      "co_yield",
      "decltype",
      "default",
      "delete",
      "do",
      "double",
      "dynamic_cast",
      "else",
      "enum",
      "explicit",
      "export",
      "extern",
      "false",
      "float",
      "for",
      "friend",
      "goto",
      "if",
      "inline",
      "int",
      "long",
      "mutable",
      "namespace",
      "new",
      "noexcept",
      "not",
      "not_eq",
      "nullptr",
      "operator",
      "or",
      "or_eq",
      "private",
      "protected",
      "public",
      "register",
      "reinterpret_cast",
      "requires",
      "return",
      "short",
      "signed",
      "sizeof",
      "static",
      "static_assert",
      "static_cast",
      "struct",
      "switch",
      "template",
      "this",
      "thread_local",
      "throw",
      "true",
      "try",
      "typedef",
      "typeid",
      "typename",
      "union",
      "unsigned",
      "using",
      "virtual",
      "void",
      "volatile",
      "wchar_t",
      "while",
      "xor",
      "xor_eq",
    ]),
    csharp: new Set([
      "abstract",
      "as",
      "base",
      "bool",
      "break",
      "byte",
      "case",
      "catch",
      "char",
      "checked",
      "class",
      "const",
      "continue",
      "decimal",
      "default",
      "delegate",
      "do",
      "double",
      "else",
      "enum",
      "event",
      "explicit",
      "extern",
      "false",
      "finally",
      "fixed",
      "float",
      "for",
      "foreach",
      "goto",
      "if",
      "implicit",
      "in",
      "int",
      "interface",
      "internal",
      "is",
      "lock",
      "long",
      "namespace",
      "new",
      "null",
      "object",
      "operator",
      "out",
      "override",
      "params",
      "private",
      "protected",
      "public",
      "readonly",
      "ref",
      "return",
      "sbyte",
      "sealed",
      "short",
      "sizeof",
      "stackalloc",
      "static",
      "string",
      "struct",
      "switch",
      "this",
      "throw",
      "true",
      "try",
      "typeof",
      "uint",
      "ulong",
      "unchecked",
      "unsafe",
      "ushort",
      "using",
      "virtual",
      "void",
      "volatile",
      "while",
      "async",
      "await",
      "var",
      "dynamic",
      "nameof",
      "when",
      "where",
      "yield",
      "record",
      "init",
      "required",
      "nint",
      "nuint",
      "file",
      "scoped",
    ]),
    go: new Set([
      "break",
      "case",
      "chan",
      "const",
      "continue",
      "default",
      "defer",
      "else",
      "fallthrough",
      "for",
      "func",
      "go",
      "goto",
      "if",
      "import",
      "interface",
      "map",
      "package",
      "range",
      "return",
      "select",
      "struct",
      "switch",
      "type",
      "var",
      "true",
      "false",
      "iota",
      "nil",
      "make",
      "new",
      "append",
      "cap",
      "close",
      "complex",
      "copy",
      "delete",
      "imag",
      "len",
      "panic",
      "print",
      "println",
      "real",
      "recover",
      "any",
      "bool",
      "byte",
      "comparable",
      "error",
      "int",
      "int8",
      "int16",
      "int32",
      "int64",
      "rune",
      "string",
      "uint",
      "uint8",
      "uint16",
      "uint32",
      "uint64",
      "uintptr",
      "float32",
      "float64",
      "complex64",
      "complex128",
    ]),
    rust: new Set([
      "as",
      "async",
      "await",
      "break",
      "const",
      "continue",
      "crate",
      "dyn",
      "else",
      "enum",
      "extern",
      "false",
      "fn",
      "for",
      "if",
      "impl",
      "in",
      "let",
      "loop",
      "match",
      "mod",
      "move",
      "mut",
      "pub",
      "ref",
      "return",
      "self",
      "Self",
      "static",
      "struct",
      "super",
      "trait",
      "true",
      "type",
      "unsafe",
      "use",
      "where",
      "while",
      "abstract",
      "become",
      "box",
      "do",
      "final",
      "macro",
      "override",
      "priv",
      "typeof",
      "unsized",
      "virtual",
      "yield",
      "try",
      "union",
    ]),
    php: new Set([
      "abstract",
      "and",
      "array",
      "as",
      "break",
      "callable",
      "case",
      "catch",
      "class",
      "clone",
      "const",
      "continue",
      "declare",
      "default",
      "die",
      "do",
      "echo",
      "else",
      "elseif",
      "empty",
      "enddeclare",
      "endfor",
      "endforeach",
      "endif",
      "endswitch",
      "endwhile",
      "eval",
      "exit",
      "extends",
      "final",
      "finally",
      "fn",
      "for",
      "foreach",
      "function",
      "global",
      "goto",
      "if",
      "implements",
      "include",
      "include_once",
      "instanceof",
      "insteadof",
      "interface",
      "isset",
      "list",
      "match",
      "namespace",
      "new",
      "or",
      "print",
      "private",
      "protected",
      "public",
      "readonly",
      "require",
      "require_once",
      "return",
      "static",
      "switch",
      "throw",
      "trait",
      "try",
      "unset",
      "use",
      "var",
      "while",
      "xor",
      "yield",
      "true",
      "false",
      "null",
      "self",
      "parent",
    ]),
    sql: new Set([
      "add",
      "all",
      "alter",
      "and",
      "as",
      "asc",
      "avg",
      "between",
      "by",
      "case",
      "count",
      "create",
      "delete",
      "desc",
      "distinct",
      "drop",
      "else",
      "end",
      "exists",
      "from",
      "full",
      "group",
      "having",
      "in",
      "index",
      "inner",
      "insert",
      "into",
      "is",
      "join",
      "left",
      "like",
      "limit",
      "max",
      "min",
      "not",
      "null",
      "on",
      "or",
      "order",
      "outer",
      "right",
      "select",
      "set",
      "sum",
      "table",
      "then",
      "union",
      "update",
      "values",
      "view",
      "when",
      "where",
      "with",
    ]),
    shell: new Set([
      "alias",
      "break",
      "case",
      "cd",
      "chmod",
      "continue",
      "cp",
      "curl",
      "do",
      "done",
      "echo",
      "elif",
      "else",
      "esac",
      "exit",
      "export",
      "fi",
      "for",
      "function",
      "git",
      "if",
      "in",
      "local",
      "ls",
      "mkdir",
      "mv",
      "npm",
      "npx",
      "printf",
      "pwd",
      "readonly",
      "return",
      "rm",
      "set",
      "shift",
      "sudo",
      "then",
      "unset",
      "until",
      "while",
    ]),
    json: new Set(["true", "false", "null"]),
  };

const isIdentStart = (ch: string) => /[A-Za-z_]/.test(ch);
const isIdent = (ch: string) => /[\w]/.test(ch);

const pushToken = (
  tokens: CodeToken[],
  type: CodeToken["type"],
  value: string,
) => {
  if (!value) {
    return;
  }
  const last = tokens[tokens.length - 1];
  if (last?.type === type) {
    last.value += value;
    return;
  }
  tokens.push({ type, value });
};

const scanCLike = (
  source: string,
  keywords: Set<string>,
  options: { hashes?: boolean; template?: boolean; insensitive?: boolean },
): CodeToken[] => {
  const tokens: CodeToken[] = [];
  const n = source.length;
  let i = 0;
  while (i < n) {
    const ch = source[i] ?? "";
    const next = source[i + 1] ?? "";
    if (ch === "/" && next === "/") {
      let end = source.indexOf("\n", i);
      if (end < 0) {
        end = n;
      }
      pushToken(tokens, "comment", source.slice(i, end));
      i = end;
      continue;
    }
    if (ch === "/" && next === "*") {
      const end = source.indexOf("*/", i + 2);
      const stop = end < 0 ? n : end + 2;
      pushToken(tokens, "comment", source.slice(i, stop));
      i = stop;
      continue;
    }
    if (options.hashes && ch === "#" && (i === 0 || /\s/.test(source[i - 1] ?? ""))) {
      let end = source.indexOf("\n", i);
      if (end < 0) {
        end = n;
      }
      pushToken(tokens, "comment", source.slice(i, end));
      i = end;
      continue;
    }
    if (ch === "'" || ch === '"' || (options.template && ch === "`")) {
      const quote = ch;
      let j = i + 1;
      while (j < n) {
        const cur = source[j] ?? "";
        if (cur === "\\") {
          j += 2;
          continue;
        }
        if (cur === quote) {
          j += 1;
          break;
        }
        j += 1;
      }
      pushToken(tokens, "string", source.slice(i, j));
      i = j;
      continue;
    }
    if (/\d/.test(ch)) {
      let j = i + 1;
      while (j < n && /[\d._]/.test(source[j] ?? "")) {
        j += 1;
      }
      pushToken(tokens, "number", source.slice(i, j));
      i = j;
      continue;
    }
    if (isIdentStart(ch)) {
      let j = i + 1;
      while (j < n && isIdent(source[j] ?? "")) {
        j += 1;
      }
      const ident = source.slice(i, j);
      const key = options.insensitive ? ident.toLowerCase() : ident;
      pushToken(tokens, keywords.has(key) ? "keyword" : "plain", ident);
      i = j;
      continue;
    }
    if (/[{}()[\].,;:=<>!&|+\-*%^~?]/.test(ch)) {
      pushToken(tokens, "punct", ch);
      i += 1;
      continue;
    }
    pushToken(tokens, "plain", ch);
    i += 1;
  }
  return tokens;
};

const scanPython = (source: string): CodeToken[] => {
  const keywords = KEYWORDS.python;
  const tokens: CodeToken[] = [];
  const n = source.length;
  let i = 0;
  while (i < n) {
    const ch = source[i] ?? "";
    if (ch === "#") {
      let end = source.indexOf("\n", i);
      if (end < 0) {
        end = n;
      }
      pushToken(tokens, "comment", source.slice(i, end));
      i = end;
      continue;
    }
    const triple = source.slice(i, i + 3);
    if (triple === '"""' || triple === "'''") {
      const quote = triple;
      const end = source.indexOf(quote, i + 3);
      const stop = end < 0 ? n : end + 3;
      pushToken(tokens, "string", source.slice(i, stop));
      i = stop;
      continue;
    }
    if (ch === "'" || ch === '"') {
      let j = i + 1;
      while (j < n) {
        const cur = source[j] ?? "";
        if (cur === "\\") {
          j += 2;
          continue;
        }
        if (cur === ch) {
          j += 1;
          break;
        }
        j += 1;
      }
      pushToken(tokens, "string", source.slice(i, j));
      i = j;
      continue;
    }
    if (/\d/.test(ch)) {
      let j = i + 1;
      while (j < n && /[\d._]/.test(source[j] ?? "")) {
        j += 1;
      }
      pushToken(tokens, "number", source.slice(i, j));
      i = j;
      continue;
    }
    if (isIdentStart(ch)) {
      let j = i + 1;
      while (j < n && isIdent(source[j] ?? "")) {
        j += 1;
      }
      const ident = source.slice(i, j);
      pushToken(tokens, keywords.has(ident) ? "keyword" : "plain", ident);
      i = j;
      continue;
    }
    if (/[{}()[\].,:;=<>!&|+\-*%^~]/.test(ch)) {
      pushToken(tokens, "punct", ch);
      i += 1;
      continue;
    }
    pushToken(tokens, "plain", ch);
    i += 1;
  }
  return tokens;
};

const scanSql = (source: string): CodeToken[] => {
  const tokens: CodeToken[] = [];
  const n = source.length;
  const keywords = KEYWORDS.sql;
  let i = 0;
  while (i < n) {
    const ch = source[i] ?? "";
    const next = source[i + 1] ?? "";
    if (ch === "-" && next === "-") {
      let end = source.indexOf("\n", i);
      if (end < 0) {
        end = n;
      }
      pushToken(tokens, "comment", source.slice(i, end));
      i = end;
      continue;
    }
    if (ch === "/" && next === "*") {
      const end = source.indexOf("*/", i + 2);
      const stop = end < 0 ? n : end + 2;
      pushToken(tokens, "comment", source.slice(i, stop));
      i = stop;
      continue;
    }
    if (ch === "'") {
      let j = i + 1;
      while (j < n) {
        if (source[j] === "'" && source[j + 1] === "'") {
          j += 2;
          continue;
        }
        if (source[j] === "'") {
          j += 1;
          break;
        }
        j += 1;
      }
      pushToken(tokens, "string", source.slice(i, j));
      i = j;
      continue;
    }
    if (/\d/.test(ch)) {
      let j = i + 1;
      while (j < n && /[\d.]/.test(source[j] ?? "")) {
        j += 1;
      }
      pushToken(tokens, "number", source.slice(i, j));
      i = j;
      continue;
    }
    if (isIdentStart(ch)) {
      let j = i + 1;
      while (j < n && isIdent(source[j] ?? "")) {
        j += 1;
      }
      const ident = source.slice(i, j);
      pushToken(
        tokens,
        keywords.has(ident.toLowerCase()) ? "keyword" : "plain",
        ident,
      );
      i = j;
      continue;
    }
    if (/[(),.;=*<>!]/.test(ch)) {
      pushToken(tokens, "punct", ch);
      i += 1;
      continue;
    }
    pushToken(tokens, "plain", ch);
    i += 1;
  }
  return tokens;
};

const scanHtml = (source: string): CodeToken[] => {
  const tokens: CodeToken[] = [];
  const n = source.length;
  let i = 0;
  while (i < n) {
    if (source.startsWith("<!--", i)) {
      const end = source.indexOf("-->", i + 4);
      const stop = end < 0 ? n : end + 3;
      pushToken(tokens, "comment", source.slice(i, stop));
      i = stop;
      continue;
    }
    if (source[i] === "<") {
      const end = source.indexOf(">", i);
      const stop = end < 0 ? n : end + 1;
      const tag = source.slice(i, stop);
      const attr = tag.split(/(\s+|(?:=)|(?:"[^"]*"|'[^']*'))/g);
      for (const part of attr) {
        if (!part) {
          continue;
        }
        if (part.startsWith('"') || part.startsWith("'")) {
          pushToken(tokens, "string", part);
        } else if (part.startsWith("<") || part.startsWith("/") || part === ">") {
          pushToken(tokens, "keyword", part);
        } else if (part === "=") {
          pushToken(tokens, "punct", part);
        } else {
          pushToken(tokens, "plain", part);
        }
      }
      i = stop;
      continue;
    }
    pushToken(tokens, "plain", source[i] ?? "");
    i += 1;
  }
  return tokens;
};

const scanMarkdown = (source: string): CodeToken[] => {
  const tokens: CodeToken[] = [];
  const n = source.length;
  let i = 0;
  while (i < n) {
    if (source.startsWith("```", i)) {
      const end = source.indexOf("```", i + 3);
      const stop = end < 0 ? n : end + 3;
      pushToken(tokens, "string", source.slice(i, stop));
      i = stop;
      continue;
    }
    if (source[i] === "`") {
      const end = source.indexOf("`", i + 1);
      const stop = end < 0 ? n : end + 1;
      pushToken(tokens, "string", source.slice(i, stop));
      i = stop;
      continue;
    }
    const atLine = i === 0 || source[i - 1] === "\n";
    if (atLine && source[i] === "#") {
      let j = i;
      while (j < n && source[j] === "#") {
        j += 1;
      }
      if (j < n && /\s/.test(source[j] ?? "")) {
        let end = source.indexOf("\n", i);
        if (end < 0) {
          end = n;
        }
        pushToken(tokens, "keyword", source.slice(i, end));
        i = end;
        continue;
      }
    }
    if (source[i] === "[") {
      const close = source.indexOf("]", i + 1);
      if (close > i && source[close + 1] === "(") {
        const endParen = source.indexOf(")", close + 2);
        if (endParen > close) {
          pushToken(tokens, "keyword", source.slice(i, close + 1));
          pushToken(tokens, "string", source.slice(close + 1, endParen + 1));
          i = endParen + 1;
          continue;
        }
      }
    }
    if (atLine && /^[-*+]\s/.test(source.slice(i, i + 2))) {
      pushToken(tokens, "punct", source[i] ?? "");
      i += 1;
      continue;
    }
    if (source.startsWith("**", i)) {
      const end = source.indexOf("**", i + 2);
      if (end > i) {
        pushToken(tokens, "keyword", source.slice(i, end + 2));
        i = end + 2;
        continue;
      }
    }
    pushToken(tokens, "plain", source[i] ?? "");
    i += 1;
  }
  return tokens;
};

export const highlightCode = (
  source: string,
  language: CodeLanguage,
): CodeToken[] => {
  if (language === "text") {
    return [{ type: "plain", value: source }];
  }
  if (language === "python") {
    return scanPython(source);
  }
  if (language === "sql") {
    return scanSql(source);
  }
  if (language === "html") {
    return scanHtml(source);
  }
  if (language === "markdown") {
    return scanMarkdown(source);
  }
  if (language === "js") {
    return scanCLike(source, KEYWORDS.js, { template: true });
  }
  if (language === "ts") {
    return scanCLike(source, KEYWORDS.ts, { template: true });
  }
  if (language === "java") {
    return scanCLike(source, KEYWORDS.java, {});
  }
  if (language === "php") {
    return scanCLike(source, KEYWORDS.php, { hashes: true });
  }
  if (
    language === "c" ||
    language === "cpp" ||
    language === "csharp" ||
    language === "go" ||
    language === "rust" ||
    language === "kotlin" ||
    language === "swift"
  ) {
    return scanCLike(source, KEYWORDS[language], {});
  }
  if (language === "shell") {
    return scanCLike(source, KEYWORDS.shell, { hashes: true });
  }
  if (language === "css") {
    return scanCLike(source, new Set(["and", "not", "only", "or"]), {});
  }
  return scanCLike(source, KEYWORDS.json, {});
};
