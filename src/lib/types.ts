export type QualityTier = "free" | "pro";
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
    }
  | { type: "room-host"; hostPeerId: string }
  | {
      type: "chat";
      id: string;
      fromPeerId: string;
      fromName: string;
      text: string;
      at: number;
      mentions?: string[];
    }
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
