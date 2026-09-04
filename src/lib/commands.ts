import type { MessageKey } from "@i18n/locales";
import type { ChatCommandPayload, PeerInfo } from "./types";

export type CommandId = "roll" | "pick";

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
  if (caret < 0 || caret > text.length) return null;
  const before = text.slice(0, caret);
  const at = before.lastIndexOf("/");
  if (at < 0) return null;
  if (at > 0 && !/\s/.test(before[at - 1] ?? "")) return null;
  const query = before.slice(at + 1);
  if (query.includes("\n") || query.includes(" ")) return null;
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
  if (!active) return { text, caret };
  const inserted = `/${name.replace(/^\//, "")} `;
  return {
    text: text.slice(0, active.start) + inserted + text.slice(caret),
    caret: active.start + inserted.length,
  };
};

export type Rng = () => number;

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

export const MAX_COMMAND_DICE = 20;
export const MAX_COMMAND_SIDES = 1000;
export const MAX_COMMAND_RANGE = 1_000_000;

export type RollSpec =
  | { kind: "dice"; n: number; sides: number }
  | { kind: "range"; min: number; max: number };

export const parseRollArgs = (args: string): RollSpec | null => {
  const raw = args.trim();
  if (!raw) return { kind: "dice", n: 1, sides: 20 };
  const dice = raw.match(/^(\d*)d(\d+)$/i);
  if (dice) {
    const n = dice[1] ? Number(dice[1]) : 1;
    const sides = Number(dice[2]);
    if (!Number.isInteger(n) || !Number.isInteger(sides)) return null;
    if (n < 1 || n > MAX_COMMAND_DICE || sides < 2 || sides > MAX_COMMAND_SIDES)
      return null;
    return { kind: "dice", n, sides };
  }
  if (/^\d+$/.test(raw)) {
    const sides = Number(raw);
    if (sides < 2 || sides > MAX_COMMAND_SIDES) return null;
    return { kind: "dice", n: 1, sides };
  }
  const range = raw.match(/^(\d+)\s*-\s*(\d+)$/) ?? raw.match(/^(\d+)\s+(\d+)$/);
  if (!range) return null;
  const min = Number(range[1]);
  const max = Number(range[2]);
  if (!Number.isInteger(min) || !Number.isInteger(max)) return null;
  if (min < 0 || max < 0) return null;
  if (min > MAX_COMMAND_RANGE || max > MAX_COMMAND_RANGE) return null;
  if (Math.abs(max - min) > MAX_COMMAND_RANGE) return null;
  return { kind: "range", min, max };
};

const commandByName = (name: string) => {
  const key = folded(name);
  return CHAT_COMMANDS.find((command) => command.names.includes(key));
};

export const parseChatCommand = (text: string) => {
  const trimmed = text.trim();
  if (!trimmed.startsWith("/")) return null;
  const rest = trimmed.slice(1);
  const space = rest.search(/\s/);
  const name = space < 0 ? rest : rest.slice(0, space);
  const args = space < 0 ? "" : rest.slice(space + 1).trim();
  const command = commandByName(name);
  if (!command) return null;
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
  return translate("chat.command.pickResult", {
    name: `@${command.name}`,
  });
};

export const mentionsForCommand = (command: ChatCommandPayload) => {
  return command.kind === "pick" ? [command.peerId] : [];
};

export const peopleForCommandMentions = (
  command: ChatCommandPayload | undefined,
  people: PeerInfo[],
) => {
  if (command?.kind !== "pick") return people;
  return [
    { peerId: command.peerId, displayName: command.name },
    ...people.filter((person) => person.peerId !== command.peerId),
  ];
};

export const runChatCommand = (
  text: string,
  people: PeerInfo[],
  rng: Rng = defaultRng,
): CommandResult | null => {
  const parsed = parseChatCommand(text);
  if (!parsed) return null;
  if (parsed.id === "roll") {
    const spec = parseRollArgs(parsed.args);
    if (!spec) return { ok: false, error: "chat.command.rollInvalid" };
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
  if (people.length === 0) {
    return { ok: false, error: "chat.command.pickEmpty" };
  }
  const person = people[randomInt(0, people.length - 1, rng)];
  if (!person) return { ok: false, error: "chat.command.pickEmpty" };
  return {
    ok: true,
    command: {
      kind: "pick",
      name: person.displayName,
      peerId: person.peerId,
    },
  };
};
