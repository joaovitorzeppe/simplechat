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

export type ChatMessage = {
  id: string;
  fromPeerId: string;
  fromName: string;
  text: string;
  at: number;
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
  | { type: "room-peers"; peers: PeerInfo[] }
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
  | { type: "media-meta"; sharingScreen?: boolean; cameraOff?: boolean };
