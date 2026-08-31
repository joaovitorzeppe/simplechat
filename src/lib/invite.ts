export type Invite = {
  peerId: string;
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
    if (fromSearch) return { peerId: fromSearch };
    const hash = url.hash.replace(/^#\/?/, "");
    const fromHash = fromParams(new URLSearchParams(hash.replace(/^\?/, "")));
    if (fromHash) return { peerId: fromHash };
  }

  if (text.includes("=")) {
    const fromLoose = fromParams(
      new URLSearchParams(text.startsWith("?") ? text.slice(1) : text),
    );
    if (fromLoose) return { peerId: fromLoose };
  }

  const embedded = text.match(/[?&](?:room|call)=([^&\s#]+)/i);
  if (embedded) return { peerId: decode(embedded[1]) };

  if (/^https?:\/\//i.test(text) || text.includes("/?")) return null;
  return { peerId: text };
};

export const invitePeerId = (raw: string) => {
  return parseInvite(raw)?.peerId ?? "";
};
