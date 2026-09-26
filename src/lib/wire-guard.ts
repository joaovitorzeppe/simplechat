import { MAX_FILE_BYTES, MAX_PARTICIPANTS } from "./quality";
import { ALL_MENTION } from "./mentions";
import { truncateText } from "./text";
import type { RoomMuteEntry } from "./mutes";
import type {
  ChatCommandPayload,
  PeerInfo,
  RollExprOp,
  RollExprTerm,
  WireMessage,
} from "./types";
import type { TimerState } from "./timer";
import {
  exprPassTotal,
  MAX_COMMAND_CHOICE_LENGTH,
  MAX_COMMAND_CHOICE_OPTIONS,
  MAX_COMMAND_DICE,
  MAX_COMMAND_EMOTE,
  MAX_COMMAND_MOD,
  MAX_COMMAND_RANGE,
  MAX_COMMAND_REPEATS,
  MAX_COMMAND_SIDES,
  MAX_COMMAND_TERMS,
  MAX_TIMER_MS,
  MIN_TIMER_MS,
} from "./commands";
import { isCodeLanguage, MAX_COMMAND_CODE } from "./code";
import { MAX_DISPLAY_NAME, MAX_PEER_ID } from "./identity";

export { clampDisplayName, MAX_DISPLAY_NAME, MAX_PEER_ID } from "./identity";

export const MAX_CHAT_TEXT = 4000;
export const MAX_MIME = 120;
export const MAX_FILE_NAME = 260;
export const MAX_TRANSFER_ID = 64;
export const MAX_ROOM_SECRET = 64;
export const MAX_PEERS = MAX_PARTICIPANTS;

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === "object" && value !== null;
};

const str = (value: unknown, max: number): string | null => {
  if (typeof value !== "string" || value.length === 0 || value.length > max) {
    return null;
  }
  return value;
};

const optionalBool = (value: unknown) => {
  return value === undefined || typeof value === "boolean";
};

/** `null` quando ausente, `false` quando presente e inválido. */
const optionalStr = (value: unknown, max: number): string | null | false => {
  if (value === undefined) {
    return null;
  }
  return str(value, max) ?? false;
};

const int = (value: unknown, min: number, max: number): number | null => {
  if (typeof value !== "number" || !Number.isInteger(value)) {
    return null;
  }
  return value >= min && value <= max ? value : null;
};

const timestamp = (value: unknown): number | null => {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }
  return value >= 0 ? value : null;
};

const parseMentions = (value: unknown): string[] | null | false => {
  if (value === undefined) {
    return null;
  }
  if (!Array.isArray(value)) {
    return false;
  }
  if (value.length === 0) {
    return null;
  }
  if (value.length > MAX_PEERS) {
    return false;
  }
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
    if (!id) {
      return false;
    }
    if (seen.has(id)) {
      continue;
    }
    seen.add(id);
    out.push(id);
  }
  return out.length > 0 ? out : null;
};

const parseCommandValues = (
  value: unknown,
  n: number,
  sides: number,
): number[] | null => {
  if (!Array.isArray(value) || value.length !== n) {
    return null;
  }
  const values: number[] = [];
  for (const entry of value) {
    const roll = int(entry, 1, sides);
    if (roll === null) {
      return null;
    }
    values.push(roll);
  }
  return values;
};

const parseExprOp = (value: unknown): RollExprOp | null => {
  if (value === "+" || value === "-" || value === "*" || value === "/") {
    return value;
  }
  return null;
};

const parseExprTerm = (value: unknown): RollExprTerm | null => {
  if (!isRecord(value) || typeof value.kind !== "string") {
    return null;
  }
  const op = parseExprOp(value.op);
  if (!op) {
    return null;
  }
  if (value.kind === "dice") {
    const n = int(value.n, 1, MAX_COMMAND_DICE);
    const sides = int(value.sides, 2, MAX_COMMAND_SIDES);
    if (n === null || sides === null) {
      return null;
    }
    const values = parseCommandValues(value.values, n, sides);
    if (!values) {
      return null;
    }
    return { kind: "dice", n, sides, op, values };
  }
  if (value.kind === "mod") {
    const raw = int(value.value, 1, MAX_COMMAND_MOD);
    if (raw === null) {
      return null;
    }
    return { kind: "mod", value: raw, op };
  }
  return null;
};

const exprTermKey = (term: RollExprTerm) => {
  if (term.kind === "mod") {
    return `mod:${term.op}:${term.value}`;
  }
  return `dice:${term.op}:${term.n}:${term.sides}`;
};

const parseExprPass = (value: unknown) => {
  if (!isRecord(value) || !Array.isArray(value.terms)) {
    return null;
  }
  if (value.terms.length < 1 || value.terms.length > MAX_COMMAND_TERMS) {
    return null;
  }
  const terms: RollExprTerm[] = [];
  for (const entry of value.terms) {
    const term = parseExprTerm(entry);
    if (!term) {
      return null;
    }
    terms.push(term);
  }
  if (!terms.some((term) => term.kind === "dice")) {
    return null;
  }
  if (terms[0]?.op === "*" || terms[0]?.op === "/") {
    return null;
  }
  const diceCount = terms.reduce(
    (sum, term) => sum + (term.kind === "dice" ? term.n : 0),
    0,
  );
  if (diceCount < 1 || diceCount > MAX_COMMAND_DICE) {
    return null;
  }
  const total = exprPassTotal(terms);
  if (total === null || value.total !== total) {
    return null;
  }
  return { terms, total };
};

const parseExprPayload = (value: Record<string, unknown>) => {
  if (!Array.isArray(value.passes)) {
    return null;
  }
  if (value.passes.length < 1 || value.passes.length > MAX_COMMAND_REPEATS) {
    return null;
  }
  const passes: Array<{ terms: RollExprTerm[]; total: number }> = [];
  let specKey = "";
  for (const entry of value.passes) {
    const pass = parseExprPass(entry);
    if (!pass) {
      return null;
    }
    const key = pass.terms.map(exprTermKey).join("|");
    if (!specKey) {
      specKey = key;
    } else if (key !== specKey) {
      return null;
    }
    passes.push(pass);
  }
  const total = passes.reduce((sum, pass) => sum + pass.total, 0);
  if (value.total !== total) {
    return null;
  }
  return { kind: "expr" as const, passes, total };
};

const parseOrderPeople = (value: unknown) => {
  if (!Array.isArray(value) || value.length < 1 || value.length > MAX_PEERS) {
    return null;
  }
  const people: Array<{ name: string; peerId: string }> = [];
  const seen = new Set<string>();
  for (const entry of value) {
    if (!isRecord(entry)) {
      return null;
    }
    const name = str(entry.name, MAX_DISPLAY_NAME);
    const peerId = str(entry.peerId, MAX_PEER_ID);
    if (!name || !peerId || seen.has(peerId)) {
      return null;
    }
    seen.add(peerId);
    people.push({ name, peerId });
  }
  return people;
};

/** `null` quando ausente, `false` quando presente e inválido. */
const parseChatCommandPayload = (
  value: unknown,
): ChatCommandPayload | null | false => {
  if (value === undefined) {
    return null;
  }
  if (!isRecord(value) || typeof value.kind !== "string") {
    return false;
  }
  if (value.kind === "die") {
    const n = int(value.n, 1, 1);
    const sides = int(value.sides, 2, MAX_COMMAND_SIDES);
    if (n === null || sides === null) {
      return false;
    }
    const roll = int(value.value, 1, sides);
    if (roll === null) {
      return false;
    }
    return { kind: "die", n, sides, value: roll };
  }
  if (value.kind === "dice") {
    const n = int(value.n, 2, MAX_COMMAND_DICE);
    const sides = int(value.sides, 2, MAX_COMMAND_SIDES);
    if (n === null || sides === null) {
      return false;
    }
    const values = parseCommandValues(value.values, n, sides);
    const total = int(value.total, n, n * sides);
    if (!values || total === null) {
      return false;
    }
    const sum = values.reduce((acc, roll) => acc + roll, 0);
    if (sum !== total) {
      return false;
    }
    return { kind: "dice", n, sides, values, total };
  }
  if (value.kind === "range") {
    const min = int(value.min, 0, MAX_COMMAND_RANGE);
    const max = int(value.max, 0, MAX_COMMAND_RANGE);
    if (min === null || max === null) {
      return false;
    }
    const lo = Math.min(min, max);
    const hi = Math.max(min, max);
    const roll = int(value.value, lo, hi);
    if (roll === null) {
      return false;
    }
    return { kind: "range", min: lo, max: hi, value: roll };
  }
  if (value.kind === "expr") {
    const payload = parseExprPayload(value);
    return payload ?? false;
  }
  if (value.kind === "pick") {
    const name = str(value.name, MAX_DISPLAY_NAME);
    const peerId = str(value.peerId, MAX_PEER_ID);
    if (!name || !peerId) {
      return false;
    }
    return { kind: "pick", name, peerId };
  }
  if (value.kind === "choice") {
    const option = str(value.option, MAX_COMMAND_CHOICE_LENGTH);
    if (!option) {
      return false;
    }
    const options = parsePollOptions(value.options);
    if (options) {
      if (!options.includes(option)) {
        return false;
      }
      return { kind: "choice", option, options };
    }
    // Legado: só vinha a opção sorteada.
    if (value.options !== undefined) {
      return false;
    }
    return { kind: "choice", option, options: [option] };
  }
  if (value.kind === "order") {
    const people = parseOrderPeople(value.people);
    if (!people) {
      return false;
    }
    return { kind: "order", people };
  }
  if (value.kind === "coin") {
    if (value.face !== "heads" && value.face !== "tails") {
      return false;
    }
    return { kind: "coin", face: value.face };
  }
  if (value.kind === "emote") {
    const action = str(value.action, MAX_COMMAND_EMOTE);
    if (!action) {
      return false;
    }
    return { kind: "emote", action };
  }
  if (value.kind === "timer") {
    const ms = int(value.ms, MIN_TIMER_MS, MAX_TIMER_MS);
    if (ms === null) {
      return false;
    }
    return { kind: "timer", ms };
  }
  if (value.kind === "poll") {
    const id = str(value.id, MAX_TRANSFER_ID);
    const options = parsePollOptions(value.options);
    if (!id || !options) {
      return false;
    }
    return { kind: "poll", id, options };
  }
  if (value.kind === "code") {
    if (typeof value.language !== "string" || !isCodeLanguage(value.language)) {
      return false;
    }
    const source = str(value.source, MAX_COMMAND_CODE);
    if (!source) {
      return false;
    }
    return { kind: "code", language: value.language, source };
  }
  return false;
};

const parsePollOptions = (value: unknown): string[] | null => {
  if (!Array.isArray(value)) {
    return null;
  }
  if (value.length < 2 || value.length > MAX_COMMAND_CHOICE_OPTIONS) {
    return null;
  }
  const options: string[] = [];
  const seen = new Set<string>();
  for (const entry of value) {
    const option = str(entry, MAX_COMMAND_CHOICE_LENGTH);
    if (!option) {
      return null;
    }
    const key = option.toLowerCase();
    if (seen.has(key)) {
      return null;
    }
    seen.add(key);
    options.push(option);
  }
  return options;
};

const peerInfo = (value: unknown): PeerInfo | null => {
  if (!isRecord(value)) {
    return null;
  }
  const peerId = str(value.peerId, MAX_PEER_ID);
  const displayName = str(value.displayName, MAX_DISPLAY_NAME);
  if (!peerId || !displayName) {
    return null;
  }
  return { peerId, displayName };
};

const roomMuteEntry = (value: unknown): RoomMuteEntry | null => {
  if (!isRecord(value)) {
    return null;
  }
  const peerId = str(value.peerId, MAX_PEER_ID);
  if (!peerId) {
    return null;
  }
  if (typeof value.audio !== "boolean" || typeof value.video !== "boolean") {
    return null;
  }
  return { peerId, audio: value.audio, video: value.video };
};

/** `null` quando ausente, `false` quando presente e inválido. */
const parseRoomMutes = (value: unknown): RoomMuteEntry[] | null | false => {
  if (value === undefined) {
    return null;
  }
  if (!Array.isArray(value) || value.length > MAX_PEERS) {
    return false;
  }
  const out: RoomMuteEntry[] = [];
  const seen = new Set<string>();
  for (const entry of value) {
    const mute = roomMuteEntry(entry);
    if (!mute) {
      return false;
    }
    if (seen.has(mute.peerId)) {
      continue;
    }
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
  if (!isRecord(raw) || typeof raw.type !== "string") {
    return null;
  }

  switch (raw.type) {
    case "hello": {
      const displayName = str(raw.displayName, MAX_DISPLAY_NAME);
      const peerId = str(raw.peerId, MAX_PEER_ID);
      if (!displayName || !peerId) {
        return null;
      }
      if (raw.kind !== "direct" && raw.kind !== "room-join") {
        return null;
      }
      const secret = optionalStr(raw.secret, MAX_ROOM_SECRET);
      if (secret === false) {
        return null;
      }
      return {
        type: "hello",
        displayName,
        peerId,
        kind: raw.kind,
        ...(secret ? { secret } : {}),
      };
    }

    case "room-peers": {
      if (!Array.isArray(raw.peers) || raw.peers.length > MAX_PEERS) {
        return null;
      }
      const peers: PeerInfo[] = [];
      const seen = new Set<string>();
      for (const entry of raw.peers) {
        const peer = peerInfo(entry);
        if (!peer) {
          return null;
        }
        if (seen.has(peer.peerId)) {
          continue;
        }
        seen.add(peer.peerId);
        peers.push(peer);
      }
      const hostPeerId = optionalStr(raw.hostPeerId, MAX_PEER_ID);
      const secret = optionalStr(raw.secret, MAX_ROOM_SECRET);
      const mutes = parseRoomMutes(raw.mutes);
      if (hostPeerId === false || secret === false || mutes === false) {
        return null;
      }
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
      if (!peerId) {
        return null;
      }
      if (!optionalBool(raw.audio) || !optionalBool(raw.video)) {
        return null;
      }
      if (raw.audio === undefined && raw.video === undefined) {
        return null;
      }
      return {
        type: "room-mute",
        peerId,
        ...(raw.audio !== undefined ? { audio: raw.audio } : {}),
        ...(raw.video !== undefined ? { video: raw.video } : {}),
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
      const command = parseChatCommandPayload(raw.command);
      if (!id || !text || !fromPeerId || !fromName || at === null) {
        return null;
      }
      if (mentions === false || command === false) {
        return null;
      }
      return {
        type: "chat",
        id,
        text,
        fromPeerId,
        fromName,
        at,
        ...(mentions ? { mentions } : {}),
        ...(command ? { command } : {}),
      };
    }

    case "room-ended":
      return { type: "room-ended" };

    case "room-full":
      return { type: "room-full" };

    case "room-waiting":
      return { type: "room-waiting" };

    case "room-denied":
      if (raw.reason !== undefined && raw.reason !== "stale") {
        return null;
      }
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
      if (displayName === false) {
        return null;
      }
      return { type: "hangup", ...(displayName ? { displayName } : {}) };
    }

    case "media-meta": {
      if (!optionalBool(raw.sharingScreen) || !optionalBool(raw.cameraOff)) {
        return null;
      }
      return {
        type: "media-meta",
        ...(raw.sharingScreen !== undefined
          ? { sharingScreen: raw.sharingScreen }
          : {}),
        ...(raw.cameraOff !== undefined
          ? { cameraOff: raw.cameraOff }
          : {}),
      };
    }

    case "file-start": {
      const id = str(raw.id, MAX_TRANSFER_ID);
      const name = str(raw.name, MAX_FILE_NAME);
      const mime = str(raw.mime, MAX_MIME);
      const size = int(raw.size, 1, MAX_FILE_BYTES);
      const fromPeerId = str(raw.fromPeerId, MAX_PEER_ID);
      const fromName = str(raw.fromName, MAX_DISPLAY_NAME);
      const at = timestamp(raw.at);
      if (!id || !name || !mime || size === null) {
        return null;
      }
      if (!fromPeerId || !fromName || at === null) {
        return null;
      }
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

    case "poll-vote": {
      const id = str(raw.id, MAX_TRANSFER_ID);
      const option = int(raw.option, 0, MAX_COMMAND_CHOICE_OPTIONS - 1);
      if (!id || option === null) {
        return null;
      }
      return { type: "poll-vote", id, option };
    }

    case "timer-control": {
      const id = str(raw.id, MAX_TRANSFER_ID);
      const timer = parseTimerState(raw.timer);
      if (!id || !timer) {
        return null;
      }
      return { type: "timer-control", id, timer };
    }

    default:
      return null;
  }
};

const parseTimerState = (value: unknown): TimerState | null => {
  if (!isRecord(value) || typeof value.status !== "string") {
    return null;
  }
  const byHost = value.byHost === true ? (true as const) : undefined;
  if (value.status === "cancelled") {
    return byHost
      ? { status: "cancelled", byHost }
      : { status: "cancelled" };
  }
  if (value.status === "paused") {
    const remainingMs = int(value.remainingMs, 0, MAX_TIMER_MS);
    if (remainingMs === null) {
      return null;
    }
    return byHost
      ? { status: "paused", remainingMs, byHost }
      : { status: "paused", remainingMs };
  }
  if (value.status === "running") {
    const endsAt = timestamp(value.endsAt);
    if (endsAt === null) {
      return null;
    }
    return { status: "running", endsAt };
  }
  return null;
};

export const clampChatText = (value: string) => {
  return truncateText(value, MAX_CHAT_TEXT);
};
