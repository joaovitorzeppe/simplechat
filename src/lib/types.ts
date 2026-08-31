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
  progress: number;
  blobUrl: string | null;
};

export type ChatMessage = {
  id: string;
  fromPeerId: string;
  fromName: string;
  text: string;
  at: number;
  file?: ChatFile;
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
    }
  | { type: "room-peers"; peers: PeerInfo[]; hostPeerId?: string }
  | { type: "room-host"; hostPeerId: string }
  | {
      type: "chat";
      id: string;
      fromPeerId: string;
      fromName: string;
      text: string;
      at: number;
    }
  | { type: "room-ended" }
  | { type: "room-full" }
  | { type: "hangup" }
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
