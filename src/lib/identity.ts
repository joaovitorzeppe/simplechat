import type { Identity } from "./types";

const KEY = "simplechat.identity";

export function loadIdentity(): Identity | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<Identity>;
    if (!parsed.displayName || !parsed.peerId) return null;
    return { displayName: parsed.displayName, peerId: parsed.peerId };
  } catch {
    return null;
  }
}

function slugFirstName(displayName: string): string {
  const first = displayName.trim().split(/\s+/)[0] ?? "";
  const cleaned = first
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
  return cleaned || "user";
}

export function createPeerId(displayName: string): string {
  return `${slugFirstName(displayName)}-${crypto.randomUUID()}-${Date.now()}`;
}

export function createIdentity(
  displayName: string,
  peerId = createPeerId(displayName),
): Identity {
  return { displayName: displayName.trim(), peerId };
}

export function persistIdentity(identity: Identity) {
  localStorage.setItem(KEY, JSON.stringify(identity));
}

export function clearIdentity() {
  localStorage.removeItem(KEY);
}
