import { describe, expect, it } from "vitest";
import {
  ALL_MENTION,
  filterMentionPeople,
  insertMention,
  isPinged,
  matchAllOption,
  mentionMarks,
  mentionQueryAt,
  resolveMentions,
} from "@libs/mentions";
import { splitMessageText } from "@libs/chat";

const people = [
  { peerId: "ana-1", displayName: "Ana" },
  { peerId: "bruno-1", displayName: "Ana Maria" },
  { peerId: "me-1", displayName: "Eu" },
];

describe("mentionQueryAt", () => {
  it("abre depois de @ no começo ou após espaço", () => {
    expect(mentionQueryAt("@", 1)).toEqual({ start: 0, query: "" });
    expect(mentionQueryAt("oi @an", 6)).toEqual({ start: 3, query: "an" });
  });

  it("não trata e-mail como menção", () => {
    expect(mentionQueryAt("ana@site.com", 8)).toBeNull();
  });
});

describe("filterMentionPeople", () => {
  it("filtra pelo nome e ignora o próprio usuário", () => {
    expect(filterMentionPeople(people, "ana", "me-1").map((p) => p.peerId)).toEqual(
      ["ana-1", "bruno-1"],
    );
    expect(filterMentionPeople(people, "maria", "me-1").map((p) => p.peerId)).toEqual(
      ["bruno-1"],
    );
  });
});

describe("matchAllOption", () => {
  it("só aparece quando há outras pessoas e a query casa com all", () => {
    expect(matchAllOption("", true)).toBe(true);
    expect(matchAllOption("al", true)).toBe(true);
    expect(matchAllOption("ana", true)).toBe(false);
    expect(matchAllOption("", false)).toBe(false);
  });
});

describe("insertMention", () => {
  it("troca o rascunho pelo @nome e um espaço", () => {
    expect(insertMention("oi @an", 6, "Ana")).toEqual({
      text: "oi @Ana ",
      caret: 8,
    });
  });
});

describe("resolveMentions", () => {
  it("resolve @all e nomes, o mais longo primeiro", () => {
    expect(resolveMentions("oi @all", people)).toEqual([ALL_MENTION]);
    expect(resolveMentions("fala @Ana Maria", people)).toEqual(["bruno-1"]);
    expect(resolveMentions("fala @Ana", people)).toEqual(["ana-1"]);
  });

  it("não marca token grudado em outra letra", () => {
    expect(resolveMentions("x@Ana", people)).toEqual([]);
  });
});

describe("isPinged", () => {
  it("não pinge o autor da mensagem", () => {
    expect(isPinged([ALL_MENTION], "me-1", "me-1")).toBe(false);
    expect(isPinged([ALL_MENTION], "me-1", "ana-1")).toBe(true);
    expect(isPinged(["me-1"], "me-1", "ana-1")).toBe(true);
  });
});

describe("splitMessageText com menções", () => {
  it("destaca o token e preserva links", () => {
    const marks = mentionMarks(["ana-1"], people, "me-1");
    expect(splitMessageText("oi @Ana veja https://exemplo.com", marks)).toEqual([
      { type: "text", value: "oi " },
      { type: "mention", label: "Ana", mine: false },
      { type: "text", value: " veja " },
      {
        type: "link",
        href: "https://exemplo.com/",
        label: "https://exemplo.com",
      },
    ]);
  });

  it("destaca a pessoa sorteada", () => {
    const marks = mentionMarks(["ana-1"], people, "me-1");
    expect(splitMessageText("Sorteou: @Ana", marks)).toEqual([
      { type: "text", value: "Sorteou: " },
      { type: "mention", label: "Ana", mine: false },
    ]);
  });
});
