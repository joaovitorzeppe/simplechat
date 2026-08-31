import { MAX_FILE_BYTES, MAX_PARTICIPANTS } from "./quality";
import { ALL_MENTION } from "./mentions";
import { truncateText } from "./text";
import type { RoomMuteEntry } from "./mutes";
import type { PeerInfo, WireMessage } from "./types";

export const MAX_CHAT_TEXT = 4000;
export const MAX_DISPLAY_NAME = 100;
export const MAX_PEER_ID = 200;
export const MAX_MIME = 120;
export const MAX_FILE_NAME = 260;
export const MAX_TRANSFER_ID = 64;
export const MAX_ROOM_SECRET = 64;
export const MAX_PEERS = MAX_PARTICIPANTS.pro;

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === "object" && value !== null;
};

const str = (value: unknown, max: number): string | null => {
  if (typeof value !== "string" || value.length === 0 || value.length > max)
    return null;
  return value;
};

const optionalBool = (value: unknown) => {
  return value === undefined || typeof value === "boolean";
};

/** `null` quando ausente, `false` quando presente e inválido. */
const optionalStr = (value: unknown, max: number): string | null | false => {
  if (value === undefined) return null;
  return str(value, max) ?? false;
};

const int = (value: unknown, min: number, max: number): number | null => {
  if (typeof value !== "number" || !Number.isInteger(value)) return null;
  return value >= min && value <= max ? value : null;
};

const timestamp = (value: unknown): number | null => {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return value >= 0 ? value : null;
};

const parseMentions = (value: unknown): string[] | null | false => {
  if (value === undefined) return null;
  if (!Array.isArray(value)) return false;
  if (value.length === 0) return null;
  if (value.length > MAX_PEERS) return false;
  const out: string[] = [];
  const seen = new Set<string>();
  for (const entry of value) {
    if (entry === ALL_MENTION) {
      if (!seen.has(ALL_MENTION)) {
        seen.add(ALL_MENTION);
        out.push(ALL_MENTION);
      }
      continue;
    }
    const id = str(entry, MAX_PEER_ID);
    if (!id) return false;
    if (seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out.length > 0 ? out : null;
};

const peerInfo = (value: unknown): PeerInfo | null => {
  if (!isRecord(value)) return null;
  const peerId = str(value.peerId, MAX_PEER_ID);
  const displayName = str(value.displayName, MAX_DISPLAY_NAME);
  if (!peerId || !displayName) return null;
  return { peerId, displayName };
};

const roomMuteEntry = (value: unknown): RoomMuteEntry | null => {
  if (!isRecord(value)) return null;
  const peerId = str(value.peerId, MAX_PEER_ID);
  if (!peerId) return null;
  if (typeof value.audio !== "boolean" || typeof value.video !== "boolean")
    return null;
  return { peerId, audio: value.audio, video: value.video };
};

/** `null` quando ausente, `false` quando presente e inválido. */
const parseRoomMutes = (value: unknown): RoomMuteEntry[] | null | false => {
  if (value === undefined) return null;
  if (!Array.isArray(value) || value.length > MAX_PEERS) return false;
  const out: RoomMuteEntry[] = [];
  const seen = new Set<string>();
  for (const entry of value) {
    const mute = roomMuteEntry(entry);
    if (!mute) return false;
    if (seen.has(mute.peerId)) continue;
    seen.add(mute.peerId);
    out.push(mute);
  }
  return out;
};

/**
 * Tudo que chega pelo data channel é hostil até prova em contrário: o peer
 * remoto controla os bytes por completo. Mensagens que não batem exatamente
 * com o contrato são descartadas, nunca corrigidas.
 */
export const parseWire = (raw: unknown): WireMessage | null => {
  if (!isRecord(raw) || typeof raw.type !== "string") return null;

  switch (raw.type) {
    case "hello": {
      const displayName = str(raw.displayName, MAX_DISPLAY_NAME);
      const peerId = str(raw.peerId, MAX_PEER_ID);
      if (!displayName || !peerId) return null;
      if (raw.kind !== "direct" && raw.kind !== "room-join") return null;
      const secret = optionalStr(raw.secret, MAX_ROOM_SECRET);
      if (secret === false) return null;
      return {
        type: "hello",
        displayName,
        peerId,
        kind: raw.kind,
        ...(secret ? { secret } : {}),
      };
    }

    case "room-peers": {
      if (!Array.isArray(raw.peers) || raw.peers.length > MAX_PEERS)
        return null;
      const peers: PeerInfo[] = [];
      for (const entry of raw.peers) {
        const peer = peerInfo(entry);
        if (!peer) return null;
        peers.push(peer);
      }
      const hostPeerId = optionalStr(raw.hostPeerId, MAX_PEER_ID);
      const secret = optionalStr(raw.secret, MAX_ROOM_SECRET);
      const mutes = parseRoomMutes(raw.mutes);
      if (hostPeerId === false || secret === false || mutes === false)
        return null;
      return {
        type: "room-peers",
        peers,
        ...(hostPeerId ? { hostPeerId } : {}),
        ...(secret ? { secret } : {}),
        ...(mutes ? { mutes } : {}),
      };
    }

    case "room-mute": {
      const peerId = str(raw.peerId, MAX_PEER_ID);
      if (!peerId) return null;
      if (!optionalBool(raw.audio) || !optionalBool(raw.video)) return null;
      if (raw.audio === undefined && raw.video === undefined) return null;
      return {
        type: "room-mute",
        peerId,
        ...(raw.audio !== undefined ? { audio: raw.audio as boolean } : {}),
        ...(raw.video !== undefined ? { video: raw.video as boolean } : {}),
      };
    }

    case "room-host": {
      const hostPeerId = str(raw.hostPeerId, MAX_PEER_ID);
      return hostPeerId ? { type: "room-host", hostPeerId } : null;
    }

    case "chat": {
      const id = str(raw.id, MAX_TRANSFER_ID);
      const text = str(raw.text, MAX_CHAT_TEXT);
      const fromPeerId = str(raw.fromPeerId, MAX_PEER_ID);
      const fromName = str(raw.fromName, MAX_DISPLAY_NAME);
      const at = timestamp(raw.at);
      const mentions = parseMentions(raw.mentions);
      if (!id || !text || !fromPeerId || !fromName || at === null) return null;
      if (mentions === false) return null;
      return {
        type: "chat",
        id,
        text,
        fromPeerId,
        fromName,
        at,
        ...(mentions ? { mentions } : {}),
      };
    }

    case "room-ended":
      return { type: "room-ended" };

    case "room-full":
      return { type: "room-full" };

    case "room-waiting":
      return { type: "room-waiting" };

    case "room-denied":
      if (raw.reason !== undefined && raw.reason !== "stale") return null;
      return {
        type: "room-denied",
        ...(raw.reason === "stale" ? { reason: "stale" as const } : {}),
      };

    case "room-kicked":
      return { type: "room-kicked" };

    case "host-transfer": {
      const hostPeerId = str(raw.hostPeerId, MAX_PEER_ID);
      return hostPeerId ? { type: "host-transfer", hostPeerId } : null;
    }

    case "hangup": {
      const displayName = optionalStr(raw.displayName, MAX_DISPLAY_NAME);
      if (displayName === false) return null;
      return { type: "hangup", ...(displayName ? { displayName } : {}) };
    }

    case "media-meta": {
      if (!optionalBool(raw.sharingScreen) || !optionalBool(raw.cameraOff))
        return null;
      return {
        type: "media-meta",
        ...(raw.sharingScreen !== undefined
          ? { sharingScreen: raw.sharingScreen as boolean }
          : {}),
        ...(raw.cameraOff !== undefined
          ? { cameraOff: raw.cameraOff as boolean }
          : {}),
      };
    }

    case "file-start": {
      const id = str(raw.id, MAX_TRANSFER_ID);
      const name = str(raw.name, MAX_FILE_NAME);
      const mime = str(raw.mime, MAX_MIME);
      const size = int(raw.size, 1, MAX_FILE_BYTES.pro);
      const fromPeerId = str(raw.fromPeerId, MAX_PEER_ID);
      const fromName = str(raw.fromName, MAX_DISPLAY_NAME);
      const at = timestamp(raw.at);
      if (!id || !name || !mime || size === null) return null;
      if (!fromPeerId || !fromName || at === null) return null;
      return {
        type: "file-start",
        id,
        name,
        mime,
        size,
        fromPeerId,
        fromName,
        at,
      };
    }

    case "file-end": {
      const id = str(raw.id, MAX_TRANSFER_ID);
      return id ? { type: "file-end", id } : null;
    }

    default:
      return null;
  }
};

export const clampDisplayName = (value: string) => {
  return truncateText(value.trim(), MAX_DISPLAY_NAME);
};

export const clampChatText = (value: string) => {
  return truncateText(value, MAX_CHAT_TEXT);
};
