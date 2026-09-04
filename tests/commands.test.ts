import { describe, expect, it } from "vitest";
import {
  commandQueryAt,
  filterChatCommands,
  formatCommandText,
  insertCommand,
  mentionsForCommand,
  parseChatCommand,
  parseRollArgs,
  peopleForCommandMentions,
  randomInt,
  runChatCommand,
} from "@libs/commands";
import { translate } from "@i18n/i18n";

const t = (key: Parameters<typeof translate>[1], vars?: Record<string, string | number>) =>
  translate("pt", key, vars);

const rngOf = (values: number[]) => {
  let index = 0;
  return () => {
    const value = values[index] ?? 0;
    index += 1;
    return value;
  };
};

describe("commandQueryAt", () => {
  it("abre depois de / no começo ou após espaço", () => {
    expect(commandQueryAt("/", 1)).toEqual({ start: 0, query: "" });
    expect(commandQueryAt("oi /da", 6)).toEqual({ start: 3, query: "da" });
  });

  it("não trata URL nem fração como comando", () => {
    expect(commandQueryAt("https://exemplo.com", 8)).toBeNull();
    expect(commandQueryAt("1/2", 2)).toBeNull();
  });

  it("fecha o seletor depois do espaço dos argumentos", () => {
    expect(commandQueryAt("/dado 2d6", 9)).toBeNull();
  });
});

describe("filterChatCommands", () => {
  it("filtra pelo nome e pelos apelidos", () => {
    expect(filterChatCommands("").map((cmd) => cmd.id)).toEqual(["roll", "pick"]);
    expect(filterChatCommands("da").map((cmd) => cmd.id)).toEqual(["roll"]);
    expect(filterChatCommands("roll").map((cmd) => cmd.id)).toEqual(["roll"]);
    expect(filterChatCommands("sor").map((cmd) => cmd.id)).toEqual(["pick"]);
  });
});

describe("insertCommand", () => {
  it("troca o rascunho pelo comando e um espaço", () => {
    expect(insertCommand("/da", 3, "dado")).toEqual({
      text: "/dado ",
      caret: 6,
    });
  });
});

describe("parseRollArgs", () => {
  it("usa 1d20 sem argumentos", () => {
    expect(parseRollArgs("")).toEqual({ kind: "dice", n: 1, sides: 20 });
  });

  it("aceita NdS, só faces e intervalo", () => {
    expect(parseRollArgs("2d6")).toEqual({ kind: "dice", n: 2, sides: 6 });
    expect(parseRollArgs("d8")).toEqual({ kind: "dice", n: 1, sides: 8 });
    expect(parseRollArgs("6")).toEqual({ kind: "dice", n: 1, sides: 6 });
    expect(parseRollArgs("1-100")).toEqual({ kind: "range", min: 1, max: 100 });
    expect(parseRollArgs("1 10")).toEqual({ kind: "range", min: 1, max: 10 });
  });

  it("rejeita valores fora do limite", () => {
    expect(parseRollArgs("0d6")).toBeNull();
    expect(parseRollArgs("21d6")).toBeNull();
    expect(parseRollArgs("d1")).toBeNull();
    expect(parseRollArgs("nope")).toBeNull();
  });
});

describe("randomInt", () => {
  it("respeita o intervalo fechado", () => {
    expect(randomInt(1, 6, () => 0)).toBe(1);
    expect(randomInt(1, 6, () => 0.999)).toBe(6);
  });
});

describe("runChatCommand", () => {
  const people = [
    { peerId: "ana-1", displayName: "Ana" },
    { peerId: "bruno-1", displayName: "Bruno" },
  ];

  it("ignora texto comum e comando desconhecido", () => {
    expect(runChatCommand("oi", people)).toBeNull();
    expect(runChatCommand("/foo", people)).toBeNull();
  });

  it("rola um dado e um intervalo", () => {
    expect(runChatCommand("/dado", people, rngOf([0]))).toEqual({
      ok: true,
      command: { kind: "die", n: 1, sides: 20, value: 1 },
    });
    expect(runChatCommand("/roll 2d6", people, rngOf([0, 0.999]))).toEqual({
      ok: true,
      command: { kind: "dice", n: 2, sides: 6, values: [1, 6], total: 7 },
    });
    expect(runChatCommand("/dado 1-100", people, rngOf([0.5]))).toEqual({
      ok: true,
      command: { kind: "range", min: 1, max: 100, value: 51 },
    });
  });

  it("sorteia uma pessoa da sala", () => {
    expect(parseChatCommand("/sortear")).toEqual({ id: "pick", args: "" });
    expect(runChatCommand("/pick", people, rngOf([0.6]))).toEqual({
      ok: true,
      command: { kind: "pick", name: "Bruno", peerId: "bruno-1" },
    });
  });

  it("recusa /dado inválido", () => {
    expect(runChatCommand("/dado banana", people)).toEqual({
      ok: false,
      error: "chat.command.rollInvalid",
    });
  });
});

describe("formatCommandText", () => {
  const die = { kind: "die" as const, n: 1, sides: 20, value: 1 };
  const dice = {
    kind: "dice" as const,
    n: 2,
    sides: 6,
    values: [1, 6],
    total: 7,
  };
  const range = { kind: "range" as const, min: 1, max: 100, value: 51 };
  const pick = { kind: "pick" as const, name: "Bruno", peerId: "bruno-1" };
  const en = (
    key: Parameters<typeof translate>[1],
    vars?: Record<string, string | number>,
  ) => translate("en", key, vars);

  it("formata no idioma de quem lê", () => {
    expect(formatCommandText(die, t)).toBe("Rolou 1d20: 1");
    expect(formatCommandText(die, en)).toBe("Rolled 1d20: 1");
    expect(formatCommandText(dice, t)).toBe("Rolou 2d6: 1 + 6 = 7");
    expect(formatCommandText(dice, en)).toBe("Rolled 2d6: 1 + 6 = 7");
    expect(formatCommandText(range, t)).toBe("Rolou 1–100: 51");
    expect(formatCommandText(range, en)).toBe("Rolled 1–100: 51");
    expect(formatCommandText(pick, t)).toBe("Sorteou: @Bruno");
    expect(formatCommandText(pick, en)).toBe("Picked: @Bruno");
  });

  it("o sorteio marca a pessoa escolhida", () => {
    expect(mentionsForCommand(die)).toEqual([]);
    expect(mentionsForCommand(pick)).toEqual(["bruno-1"]);
    expect(
      peopleForCommandMentions(pick, [
        { peerId: "bruno-1", displayName: "Bruno agora" },
        { peerId: "ana-1", displayName: "Ana" },
      ]),
    ).toEqual([
      { peerId: "bruno-1", displayName: "Bruno" },
      { peerId: "ana-1", displayName: "Ana" },
    ]);
  });
});
