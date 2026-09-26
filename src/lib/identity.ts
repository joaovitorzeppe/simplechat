import { truncateText } from "./text";
import type { Identity } from "./types";

// Moram aqui, e não no wire-guard, porque este módulo entra no bundle inicial
// e o wire-guard arrasta o parser de comandos e o highlighter.
export const MAX_DISPLAY_NAME = 100;
export const MAX_PEER_ID = 200;

export const clampDisplayName = (value: string) => {
  return truncateText(value.trim(), MAX_DISPLAY_NAME);
};

const KEY = "simplechat.identity";
const SECRET_KEY = "simplechat.roomkey";

/** Formato produzido por `createPeerId`: 128 bits em base36. */
const OPAQUE_ID = /^[0-9a-z]{25}$/;
const ROOM_SECRET = /^[0-9a-z]{16}$/;

/**
 * Base36 sem viés: os bytes viram um único inteiro e são convertidos de uma
 * vez, em vez de mapear byte a byte num alfabeto de 36 (que favoreceria as
 * quatro primeiras letras, já que 256 não é múltiplo de 36).
 */
const randomBase36 = (bytes: number, width: number) => {
  const buffer = crypto.getRandomValues(new Uint8Array(bytes));
  let value = 0n;
  for (const byte of buffer) value = (value << 8n) | BigInt(byte);
  return value.toString(36).padStart(width, "0");
};

/**
 * Chave opaca. O peerId trafega em claro pelo broker público do PeerJS, então
 * nada do nome entra aqui — 128 bits aleatórios e mais nada.
 */
export const createPeerId = (): string => randomBase36(16, 25);

/**
 * Segredo da sala, que viaja no fragmento do link (`#k=`) e por isso nunca é
 * enviado ao servidor nem vaza no cabeçalho Referer. Girá-lo é o que faz uma
 * remoção sobreviver à troca de chave: o link antigo morre junto.
 */
export const createRoomSecret = (): string => randomBase36(10, 16);

const readStored = (key: string) => {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
};

const writeStored = (key: string, value: string) => {
  try {
    localStorage.setItem(key, value);
  } catch {
    // modo privado ou storage cheio: o valor vale só para esta sessão
  }
};

export const loadRoomSecret = (): string => {
  const stored = readStored(SECRET_KEY);
  if (stored && ROOM_SECRET.test(stored)) return stored;
  return rotateRoomSecret();
};

export const rotateRoomSecret = (): string => {
  const secret = createRoomSecret();
  writeStored(SECRET_KEY, secret);
  return secret;
};

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
    // Chaves antigas embutiam o primeiro nome. Trocamos na primeira carga para
    // que o nome pare de trafegar pelo broker; links antigos morrem junto.
    if (!OPAQUE_ID.test(parsed.peerId)) {
      const migrated = { displayName, peerId: createPeerId() };
      persistIdentity(migrated);
      return migrated;
    }
    return { displayName, peerId: parsed.peerId };
  } catch {
    return null;
  }
};

export const createIdentity = (
  displayName: string,
  peerId = createPeerId(),
): Identity => {
  return { displayName: clampDisplayName(displayName), peerId };
};

export const persistIdentity = (identity: Identity) => {
  writeStored(KEY, JSON.stringify(identity));
};

export const clearIdentity = () => {
  try {
    localStorage.removeItem(KEY);
    localStorage.removeItem(SECRET_KEY);
  } catch {
    // nada a limpar se o storage não está disponível
  }
};
