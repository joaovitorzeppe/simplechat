import { localeTags, type Locale } from "../i18n/i18n";
import type { ChatMessage } from "./types";

export const CHAT_GROUP_MS = 60_000;

export type ChatGroup = {
  fromPeerId: string;
  fromName: string;
  at: number;
  messages: ChatMessage[];
};

export const groupChatMessages = (
  messages: ChatMessage[],
  windowMs = CHAT_GROUP_MS,
): ChatGroup[] => {
  const groups: ChatGroup[] = [];
  for (const msg of messages) {
    const last = groups[groups.length - 1];
    const lastAt = last?.messages[last.messages.length - 1]?.at;
    if (
      last &&
      last.fromPeerId === msg.fromPeerId &&
      lastAt !== undefined &&
      msg.at - lastAt <= windowMs
    ) {
      last.messages.push(msg);
    } else {
      groups.push({
        fromPeerId: msg.fromPeerId,
        fromName: msg.fromName,
        at: msg.at,
        messages: [msg],
      });
    }
  }
  return groups;
};

const sameCalendarDay = (a: Date, b: Date) => {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
};

export const formatMessageTime = (
  at: number,
  locale: Locale,
  now = Date.now(),
) => {
  const date = new Date(at);
  const today = new Date(now);
  const tag = localeTags[locale];
  const time = new Intl.DateTimeFormat(tag, {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);

  if (sameCalendarDay(date, today)) return time;

  if (date.getFullYear() === today.getFullYear()) {
    const dayMonth = new Intl.DateTimeFormat(tag, {
      day: "numeric",
      month: "short",
    }).format(date);
    return `${time}, ${dayMonth}`;
  }

  const full = new Intl.DateTimeFormat(tag, {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
  return `${time}, ${full}`;
};

export type MessagePart =
  | { type: "text"; value: string }
  | { type: "link"; href: string; label: string };

const LINK_RE = /\b(?:https?:\/\/|www\.)[^\s<>"]+/gi;

const peelTrail = (raw: string) => {
  let url = raw;
  while (/[.,;:!?]+$/.test(url)) url = url.slice(0, -1);
  while (
    url.endsWith(")") &&
    (url.match(/\(/g)?.length ?? 0) < (url.match(/\)/g)?.length ?? 0)
  ) {
    url = url.slice(0, -1);
  }
  return url;
};

export const hrefForLabel = (label: string) => {
  const candidate = /^https?:\/\//i.test(label) ? label : `https://${label}`;
  try {
    const parsed = new URL(candidate);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:")
      return null;
    return parsed.href;
  } catch {
    return null;
  }
};

export const splitMessageText = (text: string): MessagePart[] => {
  const parts: MessagePart[] = [];
  let last = 0;
  for (const match of text.matchAll(LINK_RE)) {
    const index = match.index ?? 0;
    const label = peelTrail(match[0]);
    const href = hrefForLabel(label);
    if (index > last) {
      parts.push({ type: "text", value: text.slice(last, index) });
    }
    if (href && label) {
      parts.push({ type: "link", href, label });
      last = index + label.length;
    } else {
      last = index;
    }
  }
  if (last < text.length) {
    parts.push({ type: "text", value: text.slice(last) });
  }
  return parts;
};
