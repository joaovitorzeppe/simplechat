import { canonicalizePath } from "./spa-path";

export type Invite = {
  peerId: string;
  /** Segredo da sala, quando o link traz um. */
  secret: string | null;
};

const decode = (value: string) => {
  try {
    return decodeURIComponent(value).trim();
  } catch {
    return value.trim();
  }
};

const fromParams = (params: URLSearchParams): string | null => {
  const room = params.get("room") ?? params.get("call");
  return room?.trim() ? decode(room) : null;
};

const secretFrom = (params: URLSearchParams): string | null => {
  const key = params.get("k");
  return key?.trim() ? decode(key) : null;
};

const hashParams = (hash: string) => {
  return new URLSearchParams(hash.replace(/^#\/?/, "").replace(/^\?/, ""));
};

const toUrl = (text: string): URL | null => {
  try {
    return new URL(text);
  } catch {
    try {
      return new URL(`http://${text}`);
    } catch {
      return null;
    }
  }
};

const stripWrap = (raw: string) => {
  return raw.trim().replace(/^['"<]+/, "").replace(/['">]+$/, "").trim();
};

export const parseInvite = (raw: string): Invite | null => {
  const text = stripWrap(raw);
  if (!text) return null;

  const url = toUrl(text);
  if (url) {
    const hash = hashParams(url.hash);
    const secret = secretFrom(hash);
    const fromSearch = fromParams(url.searchParams);
    if (fromSearch) return { peerId: fromSearch, secret };
    const fromHash = fromParams(hash);
    if (fromHash) return { peerId: fromHash, secret };
  }

  if (text.includes("=")) {
    const fromLoose = fromParams(
      new URLSearchParams(text.startsWith("?") ? text.slice(1) : text),
    );
    if (fromLoose) return { peerId: fromLoose, secret: null };
  }

  const embedded = text.match(/[?&](?:room|call)=([^&\s#]+)/i);
  if (embedded) {
    const [, fragment = ""] = text.split("#", 2);
    return { peerId: decode(embedded[1]), secret: secretFrom(hashParams(fragment)) };
  }

  if (/^https?:\/\//i.test(text) || text.includes("/?")) return null;

  // Forma nua: a chave sozinha, ou `chave#k=segredo` como o app mostra ao
  // colar só o essencial.
  const [bare = "", fragment = ""] = text.split("#", 2);
  if (!bare.trim()) return null;
  return { peerId: bare.trim(), secret: secretFrom(hashParams(fragment)) };
};

export const invitePeerId = (raw: string) => {
  return parseInvite(raw)?.peerId ?? "";
};

/** Forma que `joinRoom` / o campo da home entendem, com o segredo se houver. */
export const inviteJoinArg = (invite: Invite) =>
  invite.secret ? `${invite.peerId}#k=${invite.secret}` : invite.peerId;

/**
 * Convite na barra de endereço, se não for a própria chave. Quem nunca
 * passou pelo onboarding cai na home com isso; o join automático usa o mesmo.
 */
export const deepLinkJoinArg = (
  href: string,
  myPeerId: string,
): string | null => {
  const invite = parseInvite(href);
  if (!invite?.peerId || invite.peerId === myPeerId) return null;
  return inviteJoinArg(invite);
};

/**
 * O segredo vai no fragmento de propósito: o navegador não o envia ao servidor
 * nem o repassa no Referer, então ele não aparece em log de acesso nenhum.
 */
export const inviteLink = (peerId: string, secret: string | null) => {
  const base = `${window.location.origin}/?room=${encodeURIComponent(peerId)}`;
  return secret ? `${base}#k=${encodeURIComponent(secret)}` : base;
};

/**
 * Tira `room`/`call`/`k` da URL. `null` se não havia convite.
 * Usado ao sair da chamada para não reentrar no refresh nem no histórico atual.
 */
export const hrefWithoutInvite = (href: string): string | null => {
  if (!parseInvite(href)) return null;
  let url: URL;
  try {
    url = new URL(href);
  } catch {
    return null;
  }
  const params = new URLSearchParams(url.search);
  params.delete("room");
  params.delete("call");
  params.delete("k");
  const hash = hashParams(url.hash);
  hash.delete("k");
  hash.delete("room");
  hash.delete("call");
  const path = canonicalizePath(url.pathname);
  const search = params.toString();
  const hashStr = hash.toString();
  return `${path}${search ? `?${search}` : ""}${hashStr ? `#${hashStr}` : ""}`;
};

/** Substitui a entrada atual do histórico, sem empilhar outra. */
export const clearInviteLocation = () => {
  const next = hrefWithoutInvite(window.location.href);
  if (next === null) return;
  const current = `${canonicalizePath(window.location.pathname)}${window.location.search}${window.location.hash}`;
  if (next === current) return;
  window.history.replaceState(null, "", next);
};
