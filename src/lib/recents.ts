import { clampDisplayName, MAX_PEER_ID } from "./wire-guard";

export type Recent = {
  peerId: string;
  displayName: string;
  at: number;
};

const KEY = "simplechat.recents";
const MAX_RECENTS = 8;

const read = (): Recent[] => {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    const out: Recent[] = [];
    for (const entry of parsed) {
      if (!entry || typeof entry !== "object") continue;
      const peerId = (entry as Recent).peerId;
      const displayName = (entry as Recent).displayName;
      const at = (entry as Recent).at;
      if (typeof peerId !== "string" || peerId.length === 0) continue;
      if (peerId.length > MAX_PEER_ID) continue;
      if (typeof displayName !== "string" || !displayName) continue;
      if (typeof at !== "number" || !Number.isFinite(at)) continue;
      out.push({
        peerId,
        displayName: clampDisplayName(displayName),
        at,
      });
      if (out.length >= MAX_RECENTS) break;
    }
    return out;
  } catch {
    return [];
  }
};

const write = (recents: Recent[]) => {
  try {
    localStorage.setItem(KEY, JSON.stringify(recents.slice(0, MAX_RECENTS)));
  } catch {
    // storage cheio ou privado
  }
};

export const loadRecents = () => read();

/**
 * Recentes servem para Ligar, não para Entrar: o segredo da sala gira, então
 * um convite antigo não reabre a mesma porta. Guardamos só quem já esteve
 * na chamada conosco, para discar de novo sem colar a chave.
 */
export const rememberPeer = (peerId: string, displayName: string) => {
  if (!peerId || peerId.length > MAX_PEER_ID) return;
  const name = clampDisplayName(displayName);
  if (!name) return;
  const rest = read().filter((entry) => entry.peerId !== peerId);
  write([{ peerId, displayName: name, at: Date.now() }, ...rest]);
};

export const forgetPeer = (peerId: string) => {
  write(read().filter((entry) => entry.peerId !== peerId));
};
