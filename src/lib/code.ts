export const CODE_LANGUAGES = [
  "js",
  "ts",
  "python",
  "java",
  "sql",
  "shell",
  "html",
  "css",
  "json",
  "text",
] as const;

export type CodeLanguage = (typeof CODE_LANGUAGES)[number];

export const MAX_COMMAND_CODE = 3500;

export const CODE_LANGUAGE_LABELS: Record<CodeLanguage, string> = {
  js: "JavaScript",
  ts: "TypeScript",
  python: "Python",
  java: "Java",
  sql: "SQL",
  shell: "Shell",
  html: "HTML",
  css: "CSS",
  json: "JSON",
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
  if (!match) return { language: null, source: raw };
  return { language: match[1] || null, source: match[2] ?? "" };
};

const countHits = (source: string, patterns: RegExp[]) => {
  let total = 0;
  for (const pattern of patterns) {
    if (pattern.test(source)) total += 1;
  }
  return total;
};

export const detectCodeLanguage = (source: string): CodeLanguage => {
  const text = source.trim();
  if (!text) return "text";

  const scores: Record<Exclude<CodeLanguage, "text">, number> = {
    js: 0,
    ts: 0,
    python: 0,
    java: 0,
    sql: 0,
    shell: 0,
    html: 0,
    css: 0,
    json: 0,
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

  if (scores.json >= 6) return "json";
  if (scores.java >= scores.js && scores.java >= 2) return "java";
  if (scores.ts > 0 && scores.ts >= scores.js) return "ts";

  let best: CodeLanguage = "text";
  let bestScore = 0;
  for (const language of CODE_LANGUAGES) {
    if (language === "text") continue;
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
  if (!raw) return null;
  if (resolveCodeLanguage(raw) && !/\s/.test(raw)) return null;

  const fenced = unwrapFence(raw);
  if (fenced.language !== null || fenced.source !== raw) {
    const source = fenced.source.trim();
    if (!source) return null;
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
      if (!source) return null;
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

const KEYWORDS: Record<Exclude<CodeLanguage, "text" | "html" | "css">, Set<string>> =
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
  if (!value) return;
  const last = tokens[tokens.length - 1];
  if (last && last.type === type) {
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
      if (end < 0) end = n;
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
      if (end < 0) end = n;
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
      while (j < n && /[\d._]/.test(source[j] ?? "")) j += 1;
      pushToken(tokens, "number", source.slice(i, j));
      i = j;
      continue;
    }
    if (isIdentStart(ch)) {
      let j = i + 1;
      while (j < n && isIdent(source[j] ?? "")) j += 1;
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
      if (end < 0) end = n;
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
      while (j < n && /[\d._]/.test(source[j] ?? "")) j += 1;
      pushToken(tokens, "number", source.slice(i, j));
      i = j;
      continue;
    }
    if (isIdentStart(ch)) {
      let j = i + 1;
      while (j < n && isIdent(source[j] ?? "")) j += 1;
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
      if (end < 0) end = n;
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
      while (j < n && /[\d.]/.test(source[j] ?? "")) j += 1;
      pushToken(tokens, "number", source.slice(i, j));
      i = j;
      continue;
    }
    if (isIdentStart(ch)) {
      let j = i + 1;
      while (j < n && isIdent(source[j] ?? "")) j += 1;
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
        if (!part) continue;
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

export const highlightCode = (
  source: string,
  language: CodeLanguage,
): CodeToken[] => {
  if (language === "text") return [{ type: "plain", value: source }];
  if (language === "python") return scanPython(source);
  if (language === "sql") return scanSql(source);
  if (language === "html") return scanHtml(source);
  if (language === "js") {
    return scanCLike(source, KEYWORDS.js, { template: true });
  }
  if (language === "ts") {
    return scanCLike(source, KEYWORDS.ts, { template: true });
  }
  if (language === "java") {
    return scanCLike(source, KEYWORDS.java, {});
  }
  if (language === "shell") {
    return scanCLike(source, KEYWORDS.shell, { hashes: true });
  }
  if (language === "css") {
    return scanCLike(source, new Set(["and", "not", "only", "or"]), {});
  }
  return scanCLike(source, KEYWORDS.json, {});
};
