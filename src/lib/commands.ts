import type { MessageKey } from "@i18n/locales";
import type {
  ChatCommandPayload,
  PeerInfo,
  RollExprOp,
  RollExprTerm,
} from "./types";
import { parseCodeArgs, CODE_LANGUAGE_LABELS } from "./code";
import { displayLabel } from "./text";

export type CommandId =
  | "roll"
  | "pick"
  | "choose"
  | "order"
  | "coin"
  | "emote"
  | "timer"
  | "poll"
  | "code"
  | "help";

export type ChatCommand = {
  id: CommandId;
  names: string[];
  nameKey: MessageKey;
  hintKey: MessageKey;
  exampleKey: MessageKey;
};

export const CHAT_COMMANDS: ChatCommand[] = [
  {
    id: "roll",
    names: ["roll", "dado", "dé"],
    nameKey: "chat.command.rollName",
    hintKey: "chat.command.rollHint",
    exampleKey: "chat.command.rollExample",
  },
  {
    id: "pick",
    names: ["pick", "sortear", "tirer", "sorteggia"],
    nameKey: "chat.command.pickName",
    hintKey: "chat.command.pickHint",
    exampleKey: "chat.command.pickExample",
  },
  {
    id: "choose",
    names: ["choose", "escolher", "elegir", "choisir", "scegli"],
    nameKey: "chat.command.chooseName",
    hintKey: "chat.command.chooseHint",
    exampleKey: "chat.command.chooseExample",
  },
  {
    id: "order",
    names: ["order", "ordem", "orden", "ordre", "ordine"],
    nameKey: "chat.command.orderName",
    hintKey: "chat.command.orderHint",
    exampleKey: "chat.command.orderExample",
  },
  {
    id: "coin",
    names: ["coin", "moeda", "moneda", "pièce", "piece", "moneta"],
    nameKey: "chat.command.coinName",
    hintKey: "chat.command.coinHint",
    exampleKey: "chat.command.coinExample",
  },
  {
    id: "emote",
    names: ["me"],
    nameKey: "chat.command.emoteName",
    hintKey: "chat.command.emoteHint",
    exampleKey: "chat.command.emoteExample",
  },
  {
    id: "timer",
    names: [
      "timer",
      "cronometro",
      "cronômetro",
      "temporizador",
      "minuteur",
      "temporizzatore",
    ],
    nameKey: "chat.command.timerName",
    hintKey: "chat.command.timerHint",
    exampleKey: "chat.command.timerExample",
  },
  {
    id: "poll",
    names: ["vote", "voto", "votar", "voter", "vota"],
    nameKey: "chat.command.pollName",
    hintKey: "chat.command.pollHint",
    exampleKey: "chat.command.pollExample",
  },
  {
    id: "code",
    names: ["code", "codigo", "código", "codice"],
    nameKey: "chat.command.codeName",
    hintKey: "chat.command.codeHint",
    exampleKey: "chat.command.codeExample",
  },
  {
    id: "help",
    names: ["help", "ajuda", "ayuda", "aide", "aiuto"],
    nameKey: "chat.command.helpName",
    hintKey: "chat.command.helpHint",
    exampleKey: "chat.command.helpExample",
  },
];

export type CommandQuery = {
  start: number;
  query: string;
};

const folded = (value: string) => value.trim().toLowerCase();

/**
 * `/` só dispara comando no começo da mensagem ou depois de espaço, para
 * `https://` e `1/2` não abrirem o seletor.
 */
export const commandQueryAt = (
  text: string,
  caret: number,
): CommandQuery | null => {
  if (caret < 0 || caret > text.length) {
    return null;
  }
  const before = text.slice(0, caret);
  const at = before.lastIndexOf("/");
  if (at < 0) {
    return null;
  }
  if (at > 0 && !/\s/.test(before[at - 1] ?? "")) {
    return null;
  }
  const query = before.slice(at + 1);
  if (query.includes("\n") || query.includes(" ")) {
    return null;
  }
  return { start: at, query };
};

export const filterChatCommands = (query: string) => {
  const q = folded(query);
  return CHAT_COMMANDS.filter((command) =>
    command.names.some((name) => name.startsWith(q)),
  );
};

export const insertCommand = (text: string, caret: number, name: string) => {
  const active = commandQueryAt(text, caret);
  if (!active) {
    return { text, caret };
  }
  const inserted = `/${name.replace(/^\//, "")} `;
  return {
    text: text.slice(0, active.start) + inserted + text.slice(caret),
    caret: active.start + inserted.length,
  };
};

export type Rng = () => number;

/** RNG local do remetente. Em P2P o peer escolhe os valores do fio; o
 * wire-guard só confere consistência (soma === total), não honestidade. */
export const defaultRng: Rng = () => {
  const buf = new Uint32Array(1);
  crypto.getRandomValues(buf);
  return (buf[0] ?? 0) / 2 ** 32;
};

export const randomInt = (min: number, max: number, rng: Rng = defaultRng) => {
  const lo = Math.min(min, max);
  const hi = Math.max(min, max);
  return lo + Math.floor(rng() * (hi - lo + 1));
};

export const shuffle = <T,>(items: readonly T[], rng: Rng = defaultRng): T[] => {
  const next = [...items];
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = randomInt(0, i, rng);
    const a = next[i];
    const b = next[j];
    if (a === undefined || b === undefined) {
      continue;
    }
    next[i] = b;
    next[j] = a;
  }
  return next;
};

export const parseChoiceOptions = (args: string): string[] | null => {
  const raw = args.trim();
  if (!raw) {
    return null;
  }
  const parts = raw.includes(",") ? raw.split(",") : raw.split(/\s+/);
  const unique: string[] = [];
  const seen = new Set<string>();
  for (const part of parts) {
    const option = part.trim();
    if (!option) {
      continue;
    }
    if (option.length > MAX_COMMAND_CHOICE_LENGTH) {
      return null;
    }
    const key = option.toLowerCase();
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    unique.push(option);
  }
  if (unique.length < 2 || unique.length > MAX_COMMAND_CHOICE_OPTIONS) {
    return null;
  }
  return unique;
};

export const MAX_COMMAND_DICE = 20;
export const MAX_COMMAND_SIDES = 1000;
export const MAX_COMMAND_RANGE = 1_000_000;
export const MAX_COMMAND_REPEATS = 20;
export const MAX_COMMAND_TERMS = 10;
export const MAX_COMMAND_MOD = 10_000;
export const MAX_COMMAND_CHOICE_OPTIONS = 12;
export const MAX_COMMAND_CHOICE_LENGTH = 80;
export { MAX_COMMAND_CODE } from "./code";
export const MAX_COMMAND_EMOTE = 200;
export const MIN_TIMER_MS = 5_000;
export const MAX_TIMER_MS = 2 * 60 * 60 * 1000;

export const parseTimerArgs = (args: string): number | null => {
  const raw = args.trim().toLowerCase().replace(/\s+/g, "");
  if (!raw) {
    return null;
  }
  if (/^\d+$/.test(raw)) {
    const minutes = Number(raw);
    if (!Number.isInteger(minutes) || minutes < 1 || minutes > 120) {
      return null;
    }
    const ms = minutes * 60_000;
    return ms >= MIN_TIMER_MS && ms <= MAX_TIMER_MS ? ms : null;
  }
  const match = raw.match(
    /^(?:(\d+)h)?(?:(\d+)m(?:in)?)?(?:(\d+)s(?:ec|eg)?)?$/,
  );
  if (!match || (!match[1] && !match[2] && !match[3])) {
    return null;
  }
  const hours = match[1] ? Number(match[1]) : 0;
  const minutes = match[2] ? Number(match[2]) : 0;
  const seconds = match[3] ? Number(match[3]) : 0;
  if (
    !Number.isInteger(hours) ||
    !Number.isInteger(minutes) ||
    !Number.isInteger(seconds)
  ) {
    return null;
  }
  const ms = ((hours * 60 + minutes) * 60 + seconds) * 1000;
  if (ms < MIN_TIMER_MS || ms > MAX_TIMER_MS) {
    return null;
  }
  return ms;
};

const pad = (value: number) => String(value).padStart(2, "0");

export const formatTimerClock = (ms: number) => {
  const total = Math.max(0, Math.floor(ms / 1000));
  const seconds = total % 60;
  const minuteTotal = Math.floor(total / 60);
  if (minuteTotal >= 60) {
    const hours = Math.floor(minuteTotal / 60);
    const minutes = minuteTotal % 60;
    return `${hours}:${pad(minutes)}:${pad(seconds)}`;
  }
  return `${minuteTotal}:${pad(seconds)}`;
};

export type RollTermSpec =
  | { kind: "dice"; n: number; sides: number; op: RollExprOp }
  | { kind: "mod"; value: number; op: RollExprOp };

export type RollSpec =
  | { kind: "dice"; n: number; sides: number }
  | { kind: "range"; min: number; max: number }
  | { kind: "expr"; repeats: number; terms: RollTermSpec[] };

const parseRangePair = (min: number, max: number): RollSpec | null => {
  if (!Number.isInteger(min) || !Number.isInteger(max)) {
    return null;
  }
  if (min < 0 || max < 0) {
    return null;
  }
  if (min > MAX_COMMAND_RANGE || max > MAX_COMMAND_RANGE) {
    return null;
  }
  if (Math.abs(max - min) > MAX_COMMAND_RANGE) {
    return null;
  }
  return { kind: "range", min, max };
};

const isExprOp = (value: string): value is RollExprOp => {
  return value === "+" || value === "-" || value === "*" || value === "/";
};

type RollAtomSpec =
  | { kind: "dice"; n: number; sides: number }
  | { kind: "mod"; value: number };

const parseExprAtom = (
  rest: string,
): { spec: RollAtomSpec; length: number } | null => {
  const dice = rest.match(/^(\d*)d(\d+)/i);
  if (dice) {
    const n = dice[1] ? Number(dice[1]) : 1;
    const sides = Number(dice[2]);
    if (!Number.isInteger(n) || !Number.isInteger(sides)) {
      return null;
    }
    if (n < 1 || n > MAX_COMMAND_DICE) {
      return null;
    }
    if (sides < 2 || sides > MAX_COMMAND_SIDES) {
      return null;
    }
    return { spec: { kind: "dice", n, sides }, length: dice[0].length };
  }
  const mod = rest.match(/^(\d+)/);
  if (!mod) {
    return null;
  }
  const value = Number(mod[1]);
  if (!Number.isInteger(value) || value < 1 || value > MAX_COMMAND_MOD) {
    return null;
  }
  return { spec: { kind: "mod", value }, length: mod[0].length };
};

export const parseExprTerms = (expr: string): RollTermSpec[] | null => {
  const compact = expr.replace(/\s+/g, "");
  if (!compact || !/[dD]/.test(compact)) {
    return null;
  }
  const terms: RollTermSpec[] = [];
  let i = 0;
  let op: RollExprOp = "+";
  const lead = compact[i];
  if (lead === "+" || lead === "-") {
    op = lead;
    i += 1;
    if (i >= compact.length) {
      return null;
    }
  }
  const first = parseExprAtom(compact.slice(i));
  if (!first) {
    return null;
  }
  terms.push({ ...first.spec, op });
  i += first.length;
  while (i < compact.length) {
    const next = compact[i] ?? "";
    if (!isExprOp(next)) {
      return null;
    }
    i += 1;
    if (i >= compact.length) {
      return null;
    }
    const atom = parseExprAtom(compact.slice(i));
    if (!atom) {
      return null;
    }
    terms.push({ ...atom.spec, op: next });
    i += atom.length;
  }
  if (terms.length === 0 || terms.length > MAX_COMMAND_TERMS) {
    return null;
  }
  if (!terms.some((term) => term.kind === "dice")) {
    return null;
  }
  const diceCount = terms.reduce(
    (sum, term) => sum + (term.kind === "dice" ? term.n : 0),
    0,
  );
  if (diceCount < 1 || diceCount > MAX_COMMAND_DICE) {
    return null;
  }
  return terms;
};

export const parseRollArgs = (args: string): RollSpec | null => {
  const raw = args.trim();
  if (!raw) {
    return { kind: "dice", n: 1, sides: 20 };
  }
  if (/^\d+$/.test(raw)) {
    const sides = Number(raw);
    if (sides < 2 || sides > MAX_COMMAND_SIDES) {
      return null;
    }
    return { kind: "dice", n: 1, sides };
  }
  if (!/[dD]/.test(raw)) {
    const range =
      raw.match(/^(\d+)\s*-\s*(\d+)$/) ?? raw.match(/^(\d+)\s+(\d+)$/);
    if (!range) {
      return null;
    }
    return parseRangePair(Number(range[1]), Number(range[2]));
  }
  let repeats = 1;
  let expr = raw;
  const repeated = raw.match(/^(\d+)\s+(.+)$/);
  if (repeated) {
    repeats = Number(repeated[1]);
    expr = repeated[2] ?? "";
    if (!Number.isInteger(repeats) || repeats < 1 || repeats > MAX_COMMAND_REPEATS) {
      return null;
    }
  }
  const terms = parseExprTerms(expr);
  if (!terms) {
    return null;
  }
  const only = terms[0];
  if (
    repeats === 1 &&
    terms.length === 1 &&
    only?.kind === "dice" &&
    only.op === "+"
  ) {
    return { kind: "dice", n: only.n, sides: only.sides };
  }
  return { kind: "expr", repeats, terms };
};

export const formatRollFormula = (terms: RollTermSpec[]) => {
  return terms
    .map((term, index) => {
      const body =
        term.kind === "mod" ? String(term.value) : `${term.n}d${term.sides}`;
      if (index === 0) {
        return term.op === "-" ? `-${body}` : body;
      }
      return `${term.op}${body}`;
    })
    .join("");
};

export const joinSigned = (values: number[]) => {
  return values
    .map((value, index) => {
      if (index === 0) {
        return String(value);
      }
      return value < 0 ? ` - ${-value}` : ` + ${value}`;
    })
    .join("");
};

const atomValue = (term: RollExprTerm) => {
  if (term.kind === "mod") {
    return term.value;
  }
  return term.values.reduce((sum, value) => sum + value, 0);
};

/** `*` e `/` primeiro, da esquerda para a direita; divisão truncada em direção a zero. */
export const exprPassTotal = (terms: RollExprTerm[]): number | null => {
  const first = terms[0];
  if (!first || first.op === "*" || first.op === "/") {
    return null;
  }
  let acc = atomValue(first);
  let accOp: "+" | "-" = first.op === "-" ? "-" : "+";
  const parts: number[] = [];
  const flush = () => {
    parts.push(accOp === "-" ? -acc : acc);
  };
  for (let i = 1; i < terms.length; i += 1) {
    const term = terms[i];
    if (!term) {
      return null;
    }
    const value = atomValue(term);
    if (term.op === "*" || term.op === "/") {
      if (term.op === "*") {
        acc *= value;
      } else {
        if (value === 0) {
          return null;
        }
        acc = Math.trunc(acc / value);
      }
      if (!Number.isSafeInteger(acc)) {
        return null;
      }
      continue;
    }
    flush();
    acc = value;
    accOp = term.op;
  }
  flush();
  const total = parts.reduce((sum, value) => sum + value, 0);
  return Number.isSafeInteger(total) ? total : null;
};

export const formatExprParts = (terms: RollExprTerm[]) => {
  return terms
    .map((term, index) => {
      const body =
        term.kind === "mod"
          ? String(term.value)
          : term.values.length === 1
            ? String(term.values[0])
            : `(${term.values.join(" + ")})`;
      if (index === 0) {
        return term.op === "-" ? `-${body}` : body;
      }
      return ` ${term.op} ${body}`;
    })
    .join("");
};

const specFromExprTerm = (term: RollExprTerm): RollTermSpec => {
  if (term.kind === "mod") {
    return { kind: "mod", value: term.value, op: term.op };
  }
  return { kind: "dice", n: term.n, sides: term.sides, op: term.op };
};

const commandByName = (name: string) => {
  const key = folded(name);
  return CHAT_COMMANDS.find((command) => command.names.includes(key));
};

export const parseChatCommand = (text: string) => {
  const trimmed = text.trim();
  if (!trimmed.startsWith("/")) {
    return null;
  }
  const rest = trimmed.slice(1);
  const space = rest.search(/\s/);
  const name = space < 0 ? rest : rest.slice(0, space);
  const args = space < 0 ? "" : rest.slice(space + 1).trim();
  const command = commandByName(name);
  if (!command) {
    return null;
  }
  return { id: command.id, args };
};

type Translate = (
  key: MessageKey,
  vars?: Record<string, string | number>,
) => string;

export type CommandResult =
  | { ok: true; command: ChatCommandPayload }
  | { ok: false; error: MessageKey };

export const formatCommandText = (
  command: ChatCommandPayload,
  translate: Translate,
  fromName = "",
  people: readonly PeerInfo[] = [],
) => {
  if (command.kind === "die") {
    return translate("chat.command.rollDie", {
      n: command.n,
      sides: command.sides,
      value: command.value,
    });
  }
  if (command.kind === "dice") {
    return translate("chat.command.rollDice", {
      n: command.n,
      sides: command.sides,
      parts: command.values.join(" + "),
      total: command.total,
    });
  }
  if (command.kind === "range") {
    return translate("chat.command.rollRange", {
      min: command.min,
      max: command.max,
      value: command.value,
    });
  }
  if (command.kind === "expr") {
    const first = command.passes[0];
    if (!first) {
      return "";
    }
    const formula = formatRollFormula(first.terms.map(specFromExprTerm));
    if (command.passes.length === 1) {
      return translate("chat.command.rollExpr", {
        formula,
        parts: formatExprParts(first.terms),
        total: command.total,
      });
    }
    return translate("chat.command.rollExprRepeat", {
      n: command.passes.length,
      formula,
      parts: joinSigned(command.passes.map((pass) => pass.total)),
      total: command.total,
    });
  }
  if (command.kind === "pick") {
    return translate("chat.command.pickResult", {
      name: `@${displayLabel(command.name, command.peerId, people)}`,
    });
  }
  if (command.kind === "choice") {
    return translate("chat.command.chooseResult", {
      options: command.options.join(", "),
      option: command.option,
    });
  }
  if (command.kind === "order") {
    const names = command.people
      .map((person) => `@${displayLabel(person.name, person.peerId, people)}`)
      .join(", ");
    return translate("chat.command.orderResult", { names });
  }
  if (command.kind === "coin") {
    const face =
      command.face === "heads"
        ? translate("chat.command.coinHeads")
        : translate("chat.command.coinTails");
    return translate("chat.command.coinResult", {
      name: fromName || translate("common.someone"),
      face,
    });
  }
  if (command.kind === "emote") {
    return translate("chat.command.emoteResult", {
      name: fromName,
      action: command.action,
    });
  }
  if (command.kind === "timer") {
    return translate("chat.command.timerResult", {
      clock: formatTimerClock(command.ms),
    });
  }
  if (command.kind === "poll") {
    return translate("chat.command.pollResult", {
      options: command.options.join(", "),
    });
  }
  if (command.kind === "code") {
    return translate("chat.command.codeResult", {
      language: CODE_LANGUAGE_LABELS[command.language],
      source: command.source,
    });
  }
  if (command.kind === "help") {
    const lines = CHAT_COMMANDS.map(
      (item) => `/${translate(item.nameKey)} — ${translate(item.hintKey)}`,
    );
    return `${translate("chat.command.helpResult")}\n${lines.join("\n")}`;
  }
  return "";
};

export const mentionsForCommand = (command: ChatCommandPayload) => {
  if (command.kind === "pick") {
    return [command.peerId];
  }
  if (command.kind === "order") {
    return command.people.map((person) => person.peerId);
  }
  return [];
};

export const peopleForCommandMentions = (
  command: ChatCommandPayload | undefined,
  people: PeerInfo[],
) => {
  if (command?.kind === "pick") {
    const mapped = people.map((person) =>
      person.peerId === command.peerId
        ? { ...person, displayName: command.name }
        : person,
    );
    if (mapped.some((person) => person.peerId === command.peerId)) {
      return mapped;
    }
    return [...mapped, { peerId: command.peerId, displayName: command.name }];
  }
  if (command?.kind === "order") {
    const names = new Map(
      command.people.map((person) => [person.peerId, person.name]),
    );
    const mapped = people.map((person) => {
      const name = names.get(person.peerId);
      return name ? { ...person, displayName: name } : person;
    });
    const seen = new Set(mapped.map((person) => person.peerId));
    const extras = command.people
      .filter((person) => !seen.has(person.peerId))
      .map((person) => ({ peerId: person.peerId, displayName: person.name }));
    return extras.length ? [...mapped, ...extras] : mapped;
  }
  return people;
};

export const runChatCommand = (
  text: string,
  people: PeerInfo[],
  rng: Rng = defaultRng,
): CommandResult | null => {
  const parsed = parseChatCommand(text);
  if (!parsed) {
    return null;
  }
  if (parsed.id === "roll") {
    const spec = parseRollArgs(parsed.args);
    if (!spec) {
      return { ok: false, error: "chat.command.rollInvalid" };
    }
    if (spec.kind === "dice") {
      const values = Array.from({ length: spec.n }, () =>
        randomInt(1, spec.sides, rng),
      );
      const total = values.reduce((sum, value) => sum + value, 0);
      if (spec.n === 1) {
        return {
          ok: true,
          command: {
            kind: "die",
            n: spec.n,
            sides: spec.sides,
            value: total,
          },
        };
      }
      return {
        ok: true,
        command: {
          kind: "dice",
          n: spec.n,
          sides: spec.sides,
          values,
          total,
        },
      };
    }
    if (spec.kind === "expr") {
      const passes: Array<{ terms: RollExprTerm[]; total: number }> = [];
      for (let i = 0; i < spec.repeats; i += 1) {
        const terms: RollExprTerm[] = spec.terms.map((term) => {
          if (term.kind === "mod") {
            return term;
          }
          return {
            kind: "dice" as const,
            n: term.n,
            sides: term.sides,
            op: term.op,
            values: Array.from({ length: term.n }, () =>
              randomInt(1, term.sides, rng),
            ),
          };
        });
        const total = exprPassTotal(terms);
        if (total === null) {
          return { ok: false, error: "chat.command.rollInvalid" };
        }
        passes.push({ terms, total });
      }
      const total = passes.reduce((sum, pass) => sum + pass.total, 0);
      return { ok: true, command: { kind: "expr", passes, total } };
    }
    const min = Math.min(spec.min, spec.max);
    const max = Math.max(spec.min, spec.max);
    return {
      ok: true,
      command: {
        kind: "range",
        min,
        max,
        value: randomInt(spec.min, spec.max, rng),
      },
    };
  }
  if (parsed.id === "choose") {
    const options = parseChoiceOptions(parsed.args);
    if (!options) {
      return { ok: false, error: "chat.command.chooseInvalid" };
    }
    const option = options[randomInt(0, options.length - 1, rng)];
    if (!option) {
      return { ok: false, error: "chat.command.chooseInvalid" };
    }
    return { ok: true, command: { kind: "choice", option, options } };
  }
  if (parsed.id === "order") {
    if (people.length === 0) {
      return { ok: false, error: "chat.command.pickEmpty" };
    }
    return {
      ok: true,
      command: {
        kind: "order",
        people: shuffle(people, rng).map((person) => ({
          name: person.displayName,
          peerId: person.peerId,
        })),
      },
    };
  }
  if (parsed.id === "coin") {
    return {
      ok: true,
      command: {
        kind: "coin",
        face: randomInt(0, 1, rng) === 0 ? "heads" : "tails",
      },
    };
  }
  if (parsed.id === "emote") {
    const action = parsed.args.trim().slice(0, MAX_COMMAND_EMOTE);
    if (!action) {
      return { ok: false, error: "chat.command.emoteEmpty" };
    }
    return { ok: true, command: { kind: "emote", action } };
  }
  if (parsed.id === "timer") {
    const ms = parseTimerArgs(parsed.args);
    if (ms === null) {
      return { ok: false, error: "chat.command.timerInvalid" };
    }
    return { ok: true, command: { kind: "timer", ms } };
  }
  if (parsed.id === "poll") {
    const options = parseChoiceOptions(parsed.args);
    if (!options) {
      return { ok: false, error: "chat.command.pollInvalid" };
    }
    return {
      ok: true,
      command: { kind: "poll", id: crypto.randomUUID(), options },
    };
  }
  if (parsed.id === "code") {
    const snippet = parseCodeArgs(parsed.args);
    if (!snippet) {
      return { ok: false, error: "chat.command.codeEmpty" };
    }
    return {
      ok: true,
      command: {
        kind: "code",
        language: snippet.language,
        source: snippet.source,
      },
    };
  }
  if (parsed.id === "help") {
    return { ok: true, command: { kind: "help" } };
  }
  if (people.length === 0) {
    return { ok: false, error: "chat.command.pickEmpty" };
  }
  const person = people[randomInt(0, people.length - 1, rng)];
  if (!person) {
    return { ok: false, error: "chat.command.pickEmpty" };
  }
  return {
    ok: true,
    command: {
      kind: "pick",
      name: person.displayName,
      peerId: person.peerId,
    },
  };
};
