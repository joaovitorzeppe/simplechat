export type InviteKind = "call" | "room";

export type Invite = {
  peerId: string;
  kind: InviteKind | null;
};

const decode = (value: string) => {
  try {
    return decodeURIComponent(value).trim();
  } catch {
    return value.trim();
  }
};

const fromParams = (params: URLSearchParams): Invite | null => {
  const room = params.get("room");
  if (room?.trim()) return { peerId: decode(room), kind: "room" };
  const call = params.get("call");
  if (call?.trim()) return { peerId: decode(call), kind: "call" };
  return null;
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
    const fromSearch = fromParams(url.searchParams);
    if (fromSearch) return fromSearch;
    const hash = url.hash.replace(/^#\/?/, "");
    const fromHash = fromParams(new URLSearchParams(hash.replace(/^\?/, "")));
    if (fromHash) return fromHash;
  }

  if (text.includes("=")) {
    const fromLoose = fromParams(
      new URLSearchParams(text.startsWith("?") ? text.slice(1) : text),
    );
    if (fromLoose) return fromLoose;
  }

  const embedded = text.match(/[?&](room|call)=([^&\s#]+)/i);
  if (embedded) {
    const kind = embedded[1].toLowerCase() === "room" ? "room" : "call";
    return { peerId: decode(embedded[2]), kind };
  }

  if (/^https?:\/\//i.test(text) || text.includes("/?")) return null;
  return { peerId: text, kind: null };
};

export const invitePeerId = (raw: string) => {
  return parseInvite(raw)?.peerId ?? "";
};
