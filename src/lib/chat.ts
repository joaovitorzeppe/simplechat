import { localeTags, type Locale } from "@i18n/i18n";
import type { MentionMark } from "./mentions";
import { truncateText } from "./text";
import type { ChatMessage } from "./types";

export const CHAT_GROUP_MS = 60_000;
/** Espaço mínimo entre chats de um mesmo peer (anti-flood). */
export const CHAT_COOLDOWN_MS = 250;
/** Não empilha toast de @ a cada mensagem. */
export const MENTION_TOAST_COOLDOWN_MS = 2500;
/** Tetos de timers ativos (cada um é um setTimeout). */
export const MAX_TIMER_ALARMS = 24;

export const cooledDown = (
  lastAt: number | undefined,
  now: number,
  ms: number,
) => lastAt === undefined || now - lastAt >= ms;

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
      !msg.system &&
      !last.messages[0]?.system &&
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

  if (sameCalendarDay(date, today)) {
    return time;
  }

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
  | { type: "link"; href: string; label: string }
  | { type: "mention"; label: string; mine: boolean };

const LINK_RE = /\b(?:https?:\/\/|www\.)[^\s<>"]+/gi;

const peelTrail = (raw: string) => {
  let url = raw;
  while (/[.,;:!?]+$/.test(url)) {
    url = url.slice(0, -1);
  }
  while (
    url.endsWith(")") &&
    (url.match(/\(/g)?.length ?? 0) < (url.match(/\)/g)?.length ?? 0)
  ) {
    url = url.slice(0, -1);
  }
  return url;
};

export const hrefForLabel = (label: string) => {
  const hierarchical = /^([a-z][a-z0-9+.-]*):\/\//i.exec(label);
  if (hierarchical) {
    const scheme = hierarchical[1].toLowerCase();
    if (scheme !== "http" && scheme !== "https") {
      return null;
    }
  } else if (/^[a-z][a-z0-9+.-]*:(?!\d)/i.test(label)) {
    // javascript:, data:, mailto: e afins nunca viram link clicável. O que vem
    // depois de dois-pontos com dígito é porta, como em exemplo.com:8080.
    return null;
  }
  const candidate = hierarchical ? label : `https://${label}`;
  try {
    const parsed = new URL(candidate);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }
    return parsed.href;
  } catch {
    return null;
  }
};

const splitLinks = (text: string): MessagePart[] => {
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

const splitMentions = (text: string, marks: MentionMark[]): MessagePart[] => {
  if (!marks.length || !text) {
    return text ? [{ type: "text", value: text }] : [];
  }
  const labels = [...marks].toSorted(
    (a, b) => b.label.length - a.label.length,
  );
  const parts: MessagePart[] = [];
  let cursor = 0;
  while (cursor < text.length) {
    let nextAt = -1;
    let hit: MentionMark | null = null;
    let hitLen = 0;
    const slice = text.slice(cursor);
    const local = slice.search(/(^|\s)@/);
    if (local < 0) {
      parts.push({ type: "text", value: text.slice(cursor) });
      break;
    }
    const at = cursor + local + (slice[local] === "@" ? 0 : 1);
    for (const mark of labels) {
      const token = `@${mark.label}`;
      if (text.startsWith(token, at)) {
        const after = at + token.length;
        const next = text[after];
        if (next && !/[\s.,!?;:…]/.test(next)) {
          continue;
        }
        if (token.length > hitLen) {
          nextAt = at;
          hit = mark;
          hitLen = token.length;
        }
      }
    }
    if (!hit) {
      const skip = at + 1;
      if (skip <= cursor) {
        parts.push({ type: "text", value: text.slice(cursor) });
        break;
      }
      parts.push({ type: "text", value: text.slice(cursor, skip) });
      cursor = skip;
      continue;
    }
    if (nextAt > cursor) {
      parts.push({ type: "text", value: text.slice(cursor, nextAt) });
    }
    parts.push({ type: "mention", label: hit.label, mine: hit.mine });
    cursor = nextAt + hitLen;
  }
  return parts.filter((part) => part.type !== "text" || part.value);
};

export const splitMessageText = (
  text: string,
  marks: MentionMark[] = [],
): MessagePart[] => {
  const withLinks = splitLinks(text);
  if (!marks.length) {
    return withLinks;
  }
  return withLinks.flatMap((part) =>
    part.type === "text" ? splitMentions(part.value, marks) : [part],
  );
};

export const safeFileName = (name: string) => {
  const base = name
    // Controles e marcas de direção deixam renomear "nota.txt" em algo que se
    // exibe como imagem mas salva como executável.
    .replace(
      // oxlint-disable-next-line no-control-regex
      /[\u0000-\u001f\u007f-\u009f\u200e\u200f\u202a-\u202e\u2066-\u2069]/g,
      "",
    )
    .replace(/[\\/]/g, "_")
    .replace(/^\.+/, "")
    .trim();
  return truncateText(base, 180) || "file";
};

export const isPreviewableImage = (mime: string) => {
  return /^(image\/(jpeg|jpg|png|gif|webp))$/i.test(mime);
};

export const formatFileSize = (bytes: number, locale: Locale) => {
  const tag = localeTags[locale];
  const format = (value: number, unit: string) => {
    const n = new Intl.NumberFormat(tag, {
      maximumFractionDigits: value < 10 ? 1 : 0,
    }).format(value);
    return `${n} ${unit}`;
  };
  if (bytes < 1024) {
    return format(bytes, "B");
  }
  if (bytes < 1024 * 1024) {
    return format(bytes / 1024, "KB");
  }
  return format(bytes / (1024 * 1024), "MB");
};
