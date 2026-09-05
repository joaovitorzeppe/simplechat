import type { RoomMuteEntry } from "./mutes";
import type { CodeLanguage } from "./code";
import type { TimerState } from "./timer";

export type CallMode = "direct" | "room";
export type View = "home" | "call";

export type Identity = {
  displayName: string;
  peerId: string;
};

export type PeerInfo = {
  peerId: string;
  displayName: string;
};

export type RemotePeer = PeerInfo & {
  stream: MediaStream | null;
  screenStream: MediaStream | null;
  sharingScreen: boolean;
  cameraOff: boolean;
};

export type ChatFileStatus = "sending" | "receiving" | "ready" | "error";

export type ChatFile = {
  id: string;
  name: string;
  mime: string;
  size: number;
  status: ChatFileStatus;
  blobUrl: string | null;
};

export type RollExprOp = "+" | "-" | "*" | "/";

export type RollExprTerm =
  | {
      kind: "dice";
      n: number;
      sides: number;
      op: RollExprOp;
      values: number[];
    }
  | { kind: "mod"; value: number; op: RollExprOp };

export type ChatCommandPayload =
  | { kind: "die"; n: number; sides: number; value: number }
  | { kind: "dice"; n: number; sides: number; values: number[]; total: number }
  | { kind: "range"; min: number; max: number; value: number }
  | {
      kind: "expr";
      passes: Array<{ terms: RollExprTerm[]; total: number }>;
      total: number;
    }
  | { kind: "pick"; name: string; peerId: string }
  | { kind: "choice"; option: string; options: string[] }
  | {
      kind: "order";
      people: Array<{ name: string; peerId: string }>;
    }
  | { kind: "coin"; face: "heads" | "tails" }
  | { kind: "emote"; action: string }
  | { kind: "help" }
  | { kind: "timer"; ms: number }
  | { kind: "poll"; id: string; options: string[] }
  | { kind: "code"; language: CodeLanguage; source: string };

export type ChatMessage = {
  id: string;
  fromPeerId: string;
  fromName: string;
  text: string;
  at: number;
  file?: ChatFile;
  system?: "left";
  /** peerIds marcados, ou `"all"`. Ausente = ninguém. */
  mentions?: string[];
  command?: ChatCommandPayload;
  /** Votos em `/voto`: peerId → índice da opção. Só local; o fio usa poll-vote. */
  pollVotes?: Record<string, number>;
  /** Estado de `/timer` (pausa/cancel). Só local; o fio usa timer-control. */
  timer?: TimerState;
};

export type IncomingInvite = {
  peerId: string;
  displayName: string;
};

export type WireMessage =
  | {
      type: "hello";
      displayName: string;
      peerId: string;
      kind: "direct" | "room-join";
      secret?: string;
    }
  | {
      type: "room-peers";
      peers: PeerInfo[];
      hostPeerId?: string;
      secret?: string;
      mutes?: RoomMuteEntry[];
    }
  | { type: "room-host"; hostPeerId: string }
  | {
      type: "room-mute";
      peerId: string;
      audio?: boolean;
      video?: boolean;
    }
  | {
      type: "chat";
      id: string;
      fromPeerId: string;
      fromName: string;
      text: string;
      at: number;
      mentions?: string[];
      command?: ChatCommandPayload;
    }
  | { type: "poll-vote"; id: string; option: number }
  | { type: "timer-control"; id: string; timer: TimerState }
  | { type: "room-ended" }
  | { type: "room-full" }
  | { type: "host-transfer"; hostPeerId: string }
  | { type: "room-waiting" }
  | { type: "room-denied"; reason?: "stale" }
  | { type: "room-kicked" }
  | { type: "hangup"; displayName?: string }
  | { type: "media-meta"; sharingScreen?: boolean; cameraOff?: boolean }
  | {
      type: "file-start";
      id: string;
      name: string;
      mime: string;
      size: number;
      fromPeerId: string;
      fromName: string;
      at: number;
    }
  | { type: "file-end"; id: string };
