import type { Identity } from "./types";
import { clampDisplayName, MAX_PEER_ID } from "./wire-guard";

const KEY = "simplechat.identity";

export const loadIdentity = (): Identity | null => {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<Identity>;
    if (typeof parsed.displayName !== "string") return null;
    if (typeof parsed.peerId !== "string") return null;
    const displayName = clampDisplayName(parsed.displayName);
    if (!displayName || !parsed.peerId || parsed.peerId.length > MAX_PEER_ID)
      return null;
    return { displayName, peerId: parsed.peerId };
  } catch {
    return null;
  }
};

const slugFirstName = (displayName: string): string => {
  const first = displayName.trim().split(/\s+/)[0] ?? "";
  const cleaned = first
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
  // Nomes fora do alfabeto latino sobram vazios aqui e caem no rótulo genérico;
  // o UUID a seguir é quem garante unicidade, o slug é só legibilidade.
  return cleaned.slice(0, 24) || "user";
};

export const createPeerId = (displayName: string): string => {
  return `${slugFirstName(displayName)}-${crypto.randomUUID()}-${Date.now()}`;
};

export const createIdentity = (
  displayName: string,
  peerId = createPeerId(displayName),
): Identity => {
  return { displayName: clampDisplayName(displayName), peerId };
};

export const persistIdentity = (identity: Identity) => {
  localStorage.setItem(KEY, JSON.stringify(identity));
};

export const clearIdentity = () => {
  localStorage.removeItem(KEY);
};
