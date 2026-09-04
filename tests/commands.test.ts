import { describe, expect, it } from "vitest";
import {
  commandQueryAt,
  filterChatCommands,
  formatCommandText,
  formatTimerClock,
  insertCommand,
  mentionsForCommand,
  parseChatCommand,
  parseRollArgs,
  parseTimerArgs,
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
    expect(filterChatCommands("").map((cmd) => cmd.id)).toEqual([
      "roll",
      "pick",
      "choose",
      "order",
      "coin",
      "emote",
      "timer",
      "poll",
      "help",
    ]);
    expect(filterChatCommands("da").map((cmd) => cmd.id)).toEqual(["roll"]);
    expect(filterChatCommands("roll").map((cmd) => cmd.id)).toEqual(["roll"]);
    expect(filterChatCommands("sor").map((cmd) => cmd.id)).toEqual(["pick"]);
    expect(filterChatCommands("esc").map((cmd) => cmd.id)).toEqual(["choose"]);
    expect(filterChatCommands("or").map((cmd) => cmd.id)).toEqual(["order"]);
    expect(filterChatCommands("me").map((cmd) => cmd.id)).toEqual(["emote"]);
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

  it("aceita somas, modificadores e repetição", () => {
    expect(parseRollArgs("5d10+7d4+3")).toEqual({
      kind: "expr",
      repeats: 1,
      terms: [
        { kind: "dice", n: 5, sides: 10, op: "+" },
        { kind: "dice", n: 7, sides: 4, op: "+" },
        { kind: "mod", value: 3, op: "+" },
      ],
    });
    expect(parseRollArgs("2 5d10 + 7d4 + 3")).toEqual({
      kind: "expr",
      repeats: 2,
      terms: [
        { kind: "dice", n: 5, sides: 10, op: "+" },
        { kind: "dice", n: 7, sides: 4, op: "+" },
        { kind: "mod", value: 3, op: "+" },
      ],
    });
    expect(parseRollArgs("2d6-1")).toEqual({
      kind: "expr",
      repeats: 1,
      terms: [
        { kind: "dice", n: 2, sides: 6, op: "+" },
        { kind: "mod", value: 1, op: "-" },
      ],
    });
    expect(parseRollArgs("2 d6")).toEqual({
      kind: "expr",
      repeats: 2,
      terms: [{ kind: "dice", n: 1, sides: 6, op: "+" }],
    });
    expect(parseRollArgs("2d6*3")).toEqual({
      kind: "expr",
      repeats: 1,
      terms: [
        { kind: "dice", n: 2, sides: 6, op: "+" },
        { kind: "mod", value: 3, op: "*" },
      ],
    });
    expect(parseRollArgs("2d6/2+1")).toEqual({
      kind: "expr",
      repeats: 1,
      terms: [
        { kind: "dice", n: 2, sides: 6, op: "+" },
        { kind: "mod", value: 2, op: "/" },
        { kind: "mod", value: 1, op: "+" },
      ],
    });
    expect(parseRollArgs("2d6+3*2")).toEqual({
      kind: "expr",
      repeats: 1,
      terms: [
        { kind: "dice", n: 2, sides: 6, op: "+" },
        { kind: "mod", value: 3, op: "+" },
        { kind: "mod", value: 2, op: "*" },
      ],
    });
  });

  it("rejeita valores fora do limite", () => {
    expect(parseRollArgs("0d6")).toBeNull();
    expect(parseRollArgs("21d6")).toBeNull();
    expect(parseRollArgs("d1")).toBeNull();
    expect(parseRollArgs("nope")).toBeNull();
    expect(parseRollArgs("5d10++3")).toBeNull();
    expect(parseRollArgs("2d6/")).toBeNull();
    expect(parseRollArgs("*2d6")).toBeNull();
    expect(parseRollArgs("21 2d6")).toBeNull();
    expect(parseRollArgs("5d10+7d4+9d6")).toBeNull();
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

  it("rola uma expressão e pode repetir a soma", () => {
    expect(runChatCommand("/dado 5d10+7d4+3", people, rngOf(Array(12).fill(0)))).toEqual({
      ok: true,
      command: {
        kind: "expr",
        total: 15,
        passes: [
          {
            total: 15,
            terms: [
              { kind: "dice", n: 5, sides: 10, op: "+", values: [1, 1, 1, 1, 1] },
              { kind: "dice", n: 7, sides: 4, op: "+", values: [1, 1, 1, 1, 1, 1, 1] },
              { kind: "mod", value: 3, op: "+" },
            ],
          },
        ],
      },
    });
    expect(
      runChatCommand("/roll 2 5d10+7d4+3", people, rngOf(Array(24).fill(0))),
    ).toEqual({
      ok: true,
      command: {
        kind: "expr",
        total: 30,
        passes: [
          {
            total: 15,
            terms: [
              { kind: "dice", n: 5, sides: 10, op: "+", values: [1, 1, 1, 1, 1] },
              { kind: "dice", n: 7, sides: 4, op: "+", values: [1, 1, 1, 1, 1, 1, 1] },
              { kind: "mod", value: 3, op: "+" },
            ],
          },
          {
            total: 15,
            terms: [
              { kind: "dice", n: 5, sides: 10, op: "+", values: [1, 1, 1, 1, 1] },
              { kind: "dice", n: 7, sides: 4, op: "+", values: [1, 1, 1, 1, 1, 1, 1] },
              { kind: "mod", value: 3, op: "+" },
            ],
          },
        ],
      },
    });
  });

  it("multiplica e divide com precedência", () => {
    expect(runChatCommand("/dado 2d6*3", people, rngOf([0, 0.999]))).toEqual({
      ok: true,
      command: {
        kind: "expr",
        total: 21,
        passes: [
          {
            total: 21,
            terms: [
              { kind: "dice", n: 2, sides: 6, op: "+", values: [1, 6] },
              { kind: "mod", value: 3, op: "*" },
            ],
          },
        ],
      },
    });
    expect(runChatCommand("/dado 2d6/2", people, rngOf([0, 0.999]))).toEqual({
      ok: true,
      command: {
        kind: "expr",
        total: 3,
        passes: [
          {
            total: 3,
            terms: [
              { kind: "dice", n: 2, sides: 6, op: "+", values: [1, 6] },
              { kind: "mod", value: 2, op: "/" },
            ],
          },
        ],
      },
    });
    expect(runChatCommand("/dado 2d6+3*2", people, rngOf([0, 0.999]))).toEqual({
      ok: true,
      command: {
        kind: "expr",
        total: 13,
        passes: [
          {
            total: 13,
            terms: [
              { kind: "dice", n: 2, sides: 6, op: "+", values: [1, 6] },
              { kind: "mod", value: 3, op: "+" },
              { kind: "mod", value: 2, op: "*" },
            ],
          },
        ],
      },
    });
  });

  it("sorteia uma pessoa da sala", () => {
    expect(parseChatCommand("/sortear")).toEqual({ id: "pick", args: "" });
    expect(runChatCommand("/pick", people, rngOf([0.6]))).toEqual({
      ok: true,
      command: { kind: "pick", name: "Bruno", peerId: "bruno-1" },
    });
  });

  it("escolhe opções, ordem, moeda, ação e ajuda", () => {
    expect(
      runChatCommand("/escolher pizza, sushi", people, rngOf([0.6])),
    ).toEqual({
      ok: true,
      command: { kind: "choice", option: "sushi" },
    });
    expect(runChatCommand("/escolher pizza sushi taco", people, rngOf([0]))).toEqual({
      ok: true,
      command: { kind: "choice", option: "pizza" },
    });
    expect(runChatCommand("/escolher pizza", people)).toEqual({
      ok: false,
      error: "chat.command.chooseInvalid",
    });
    expect(runChatCommand("/ordem", people, rngOf([0]))).toEqual({
      ok: true,
      command: {
        kind: "order",
        people: [
          { name: "Bruno", peerId: "bruno-1" },
          { name: "Ana", peerId: "ana-1" },
        ],
      },
    });
    expect(runChatCommand("/moeda", people, rngOf([0]))).toEqual({
      ok: true,
      command: { kind: "coin", face: "heads" },
    });
    expect(runChatCommand("/me acena", people)).toEqual({
      ok: true,
      command: { kind: "emote", action: "acena" },
    });
    expect(runChatCommand("/me", people)).toEqual({
      ok: false,
      error: "chat.command.emoteEmpty",
    });
    expect(runChatCommand("/ajuda", people)).toEqual({
      ok: true,
      command: { kind: "help" },
    });
  });

  it("começa um timer a partir de minutos, unidades ou combinação", () => {
    expect(parseTimerArgs("5")).toBe(5 * 60_000);
    expect(parseTimerArgs("30s")).toBe(30_000);
    expect(parseTimerArgs("5m")).toBe(5 * 60_000);
    expect(parseTimerArgs("5min")).toBe(5 * 60_000);
    expect(parseTimerArgs("1h")).toBe(60 * 60_000);
    expect(parseTimerArgs("1h30m")).toBe(90 * 60_000);
    expect(parseTimerArgs("1 h 30 m")).toBe(90 * 60_000);
    expect(parseTimerArgs("4s")).toBeNull();
    expect(parseTimerArgs("3h")).toBeNull();
    expect(parseTimerArgs("")).toBeNull();
    expect(runChatCommand("/timer 5s", people)).toEqual({
      ok: true,
      command: { kind: "timer", ms: 5_000 },
    });
    expect(runChatCommand("/cronômetro 30s", people)).toEqual({
      ok: true,
      command: { kind: "timer", ms: 30_000 },
    });
    expect(runChatCommand("/timer", people)).toEqual({
      ok: false,
      error: "chat.command.timerInvalid",
    });
  });

  it("abre uma votação com as mesmas opções do escolher", () => {
    expect(runChatCommand("/voto pizza, sushi", people)).toEqual({
      ok: true,
      command: {
        kind: "poll",
        id: expect.stringMatching(
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
        ),
        options: ["pizza", "sushi"],
      },
    });
    expect(runChatCommand("/vote pizza sushi taco", people)).toMatchObject({
      ok: true,
      command: { kind: "poll", options: ["pizza", "sushi", "taco"] },
    });
    expect(runChatCommand("/voto pizza", people)).toEqual({
      ok: false,
      error: "chat.command.pollInvalid",
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
  const expr = {
    kind: "expr" as const,
    total: 15,
    passes: [
      {
        total: 15,
        terms: [
          { kind: "dice" as const, n: 2, sides: 6, op: "+" as const, values: [1, 6] },
          { kind: "mod" as const, value: 3, op: "+" as const },
        ],
      },
    ],
  };
  const exprRepeat = {
    kind: "expr" as const,
    total: 30,
    passes: [
      { total: 15, terms: expr.passes[0].terms },
      { total: 15, terms: expr.passes[0].terms },
    ],
  };
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
    expect(formatCommandText(expr, t)).toBe("Rolou 2d6+3: (1 + 6) + 3 = 15");
    expect(formatCommandText(expr, en)).toBe("Rolled 2d6+3: (1 + 6) + 3 = 15");
    expect(formatCommandText(exprRepeat, t)).toBe(
      "Rolou 2× (2d6+3): 15 + 15 = 30",
    );
    expect(formatCommandText(exprRepeat, en)).toBe(
      "Rolled 2× (2d6+3): 15 + 15 = 30",
    );
    expect(
      formatCommandText(
        {
          kind: "expr",
          total: 21,
          passes: [
            {
              total: 21,
              terms: [
                {
                  kind: "dice",
                  n: 2,
                  sides: 6,
                  op: "+",
                  values: [1, 6],
                },
                { kind: "mod", value: 3, op: "*" },
              ],
            },
          ],
        },
        t,
      ),
    ).toBe("Rolou 2d6*3: (1 + 6) * 3 = 21");
    expect(formatCommandText(pick, t)).toBe("Sorteou: @Bruno");
    expect(formatCommandText(pick, en)).toBe("Picked: @Bruno");
    expect(formatCommandText({ kind: "choice", option: "pizza" }, t)).toBe(
      "Escolheu: pizza",
    );
    expect(formatCommandText({ kind: "coin", face: "heads" }, t)).toBe(
      "Moeda: cara",
    );
    expect(formatCommandText({ kind: "coin", face: "heads" }, en)).toBe(
      "Coin: heads",
    );
    expect(formatCommandText({ kind: "emote", action: "acena" }, t, "João")).toBe(
      "João acena",
    );
    expect(formatCommandText({ kind: "timer", ms: 90_000 }, t)).toBe(
      "Timer: 1:30",
    );
    expect(formatCommandText({ kind: "timer", ms: 3_600_000 }, t)).toBe(
      "Timer: 1:00:00",
    );
    expect(
      formatCommandText(
        { kind: "poll", id: "p1", options: ["pizza", "sushi"] },
        t,
      ),
    ).toBe("Votação: pizza, sushi");
    expect(
      formatCommandText(
        {
          kind: "order",
          people: [
            { name: "Ana", peerId: "ana-1" },
            { name: "Bruno", peerId: "bruno-1" },
          ],
        },
        t,
      ),
    ).toBe("Ordem: @Ana, @Bruno");
    expect(formatCommandText({ kind: "help" }, t)).toMatch(/^Comandos:\n\/dado /);
  });

  it("mostra o relógio do timer", () => {
    expect(formatTimerClock(0)).toBe("0:00");
    expect(formatTimerClock(5_000)).toBe("0:05");
    expect(formatTimerClock(90_000)).toBe("1:30");
    expect(formatTimerClock(3_661_000)).toBe("1:01:01");
  });

  it("o sorteio marca a pessoa escolhida", () => {
    expect(mentionsForCommand(die)).toEqual([]);
    expect(mentionsForCommand(pick)).toEqual(["bruno-1"]);
    expect(
      mentionsForCommand({
        kind: "order",
        people: [
          { name: "Ana", peerId: "ana-1" },
          { name: "Bruno", peerId: "bruno-1" },
        ],
      }),
    ).toEqual(["ana-1", "bruno-1"]);
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
