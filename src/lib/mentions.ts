import { displayLabel } from "./text";
import type { PeerInfo } from "./types";

export const ALL_MENTION = "all";

export type MentionPerson = PeerInfo;

export type MentionQuery = {
  start: number;
  query: string;
};

export type MentionMark = {
  label: string;
  mine: boolean;
};

const escapeRegExp = (value: string) =>
  value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const folded = (value: string) => value.trim().toLowerCase();

/**
 * `@` só dispara menção no começo da mensagem ou depois de espaço. Assim
 * `ana@site.com` não vira seletor.
 */
export const mentionQueryAt = (
  text: string,
  caret: number,
): MentionQuery | null => {
  if (caret < 0 || caret > text.length) {
    return null;
  }
  const before = text.slice(0, caret);
  const at = before.lastIndexOf("@");
  if (at < 0) {
    return null;
  }
  if (at > 0 && !/\s/.test(before[at - 1] ?? "")) {
    return null;
  }
  const query = before.slice(at + 1);
  if (query.includes("\n")) {
    return null;
  }
  return { start: at, query };
};

export const filterMentionPeople = (
  people: MentionPerson[],
  query: string,
  selfId: string,
) => {
  const q = folded(query);
  return people
    .filter((person) => person.peerId !== selfId)
    .filter((person) => {
      if (folded(person.displayName).includes(q)) {
        return true;
      }
      return folded(
        displayLabel(person.displayName, person.peerId, people),
      ).includes(q);
    })
    .toSorted((a, b) =>
      displayLabel(a.displayName, a.peerId, people).localeCompare(
        displayLabel(b.displayName, b.peerId, people),
      ),
    );
};

export const matchAllOption = (query: string, hasOthers: boolean) => {
  if (!hasOthers) {
    return false;
  }
  const q = folded(query);
  return !q || ALL_MENTION.startsWith(q);
};

export const insertMention = (
  text: string,
  caret: number,
  label: string,
) => {
  const active = mentionQueryAt(text, caret);
  if (!active) {
    return { text, caret };
  }
  const inserted = `@${label} `;
  return {
    text: text.slice(0, active.start) + inserted + text.slice(caret),
    caret: active.start + inserted.length,
  };
};

const tokenAfter = (name: string) =>
  new RegExp(`(^|\\s)@${escapeRegExp(name)}(?=$|\\s|[.,!?;:…])`, "g");

/** Quem a mensagem realmente marca. `@all` vira o sentinela, nunca a lista. */
export const resolveMentions = (
  text: string,
  people: MentionPerson[],
): string[] => {
  const found: string[] = [];
  const seen = new Set<string>();
  const used: Array<{ start: number; end: number }> = [];
  const add = (id: string, start: number, end: number) => {
    if (seen.has(id)) {
      return;
    }
    const clash = used.find((span) => start < span.end && end > span.start);
    // Mesmo token (`@Ana` duas vezes na lista) marca todo mundo. Span
    // diferente ainda perde para o nome mais longo (`@Ana Maria`).
    if (clash && (clash.start !== start || clash.end !== end)) {
      return;
    }
    seen.add(id);
    if (!clash) {
      used.push({ start, end });
    }
    found.push(id);
  };
  const consider = (id: string, name: string) => {
    if (!name) {
      return;
    }
    for (const match of text.matchAll(tokenAfter(name))) {
      const prefix = match[1]?.length ?? 0;
      const start = (match.index ?? 0) + prefix;
      add(id, start, start + 1 + name.length);
    }
  };
  consider(ALL_MENTION, ALL_MENTION);
  const tokens: Array<{ id: string; name: string }> = [];
  for (const person of people) {
    const unique = displayLabel(person.displayName, person.peerId, people);
    tokens.push({ id: person.peerId, name: unique });
    if (unique !== person.displayName) {
      tokens.push({ id: person.peerId, name: person.displayName });
    }
  }
  tokens.sort((a, b) => b.name.length - a.name.length);
  for (const token of tokens) {
    consider(token.id, token.name);
  }
  return found;
};

export const isSelfMentioned = (
  mentions: string[] | undefined,
  selfId: string,
) => {
  if (!mentions?.length) {
    return false;
  }
  return mentions.includes(ALL_MENTION) || mentions.includes(selfId);
};

export const isPinged = (
  mentions: string[] | undefined,
  selfId: string,
  fromPeerId: string,
) => {
  return fromPeerId !== selfId && isSelfMentioned(mentions, selfId);
};

export const mentionMarks = (
  mentions: string[] | undefined,
  people: MentionPerson[],
  selfId: string,
): MentionMark[] => {
  if (!mentions?.length) {
    return [];
  }
  const marks: MentionMark[] = [];
  if (mentions.includes(ALL_MENTION)) {
    marks.push({ label: ALL_MENTION, mine: true });
  }
  const named = people.filter((person) => mentions.includes(person.peerId));
  named.sort((a, b) => b.displayName.length - a.displayName.length);
  for (const person of named) {
    if (person.displayName.toLowerCase() === ALL_MENTION) {
      continue;
    }
    const unique = displayLabel(person.displayName, person.peerId, people);
    const marked = person.peerId === selfId;
    marks.push({ label: unique, mine: marked });
    if (unique !== person.displayName) {
      marks.push({ label: person.displayName, mine: marked });
    }
  }
  return marks;
};
