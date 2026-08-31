import { Peer, type DataConnection, type MediaConnection } from "peerjs";
import {
  appendHistoryMessage,
  endHistoryCall,
  startHistoryCall,
  touchHistoryParticipants,
} from "./db";
import { invitePeerId } from "./invite";
import {
  applySenderLimits,
  applyTrackConstraints,
  currentTier,
  getCameraConstraints,
  getDisplayConstraints,
} from "./quality";
import type { MessageKey } from "../i18n/locales";
import { t } from "../i18n/i18n";
import { playCallEnded } from "./sounds";
import { showToast } from "./toast";
import type {
  CallMode,
  ChatMessage,
  Identity,
  IncomingInvite,
  PeerInfo,
  RemotePeer,
  View,
  WireMessage,
} from "./types";

export type SessionState = {
  view: View;
  identity: Identity | null;
  peerReady: boolean;
  peerError: MessageKey | null;
  localStream: MediaStream | null;
  localScreenStream: MediaStream | null;
  remotes: RemotePeer[];
  messages: ChatMessage[];
  muted: boolean;
  cameraOff: boolean;
  sharingScreen: boolean;
  screenShareOrder: string[];
  callMode: CallMode | null;
  isHost: boolean;
  callStatus: "idle" | "connecting" | "in-call";
  incoming: IncomingInvite | null;
  activeCallId: string | null;
};

const STUN = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
  ],
};

const initialState: SessionState = {
  view: "home",
  identity: null,
  peerReady: false,
  peerError: null,
  localStream: null,
  localScreenStream: null,
  remotes: [],
  messages: [],
  muted: false,
  cameraOff: false,
  sharingScreen: false,
  screenShareOrder: [],
  callMode: null,
  isHost: false,
  callStatus: "idle",
  incoming: null,
  activeCallId: null,
};

type Listener = () => void;

export class PeerSession {
  private listeners = new Set<Listener>();
  private state: SessionState = initialState;
  private peer: Peer | null = null;
  private data = new Map<string, DataConnection>();
  private media = new Map<string, MediaConnection>();
  private screenOut = new Map<string, MediaConnection>();
  private screenIn = new Map<string, MediaConnection>();
  private names = new Map<string, string>();
  private roomMembers: PeerInfo[] = [];
  private screenTrack: MediaStreamTrack | null = null;
  private starting = false;
  private ending = false;

  subscribe = (listener: Listener) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getState = () => this.state;

  private patch(partial: Partial<SessionState>) {
    this.state = { ...this.state, ...partial };
    for (const listener of this.listeners) listener();
  }

  private toast(key: MessageKey) {
    showToast(key);
  }

  async start(identity: Identity) {
    if (this.starting && this.state.identity?.peerId === identity.peerId)
      return;
    if (
      this.peer &&
      this.state.identity?.peerId === identity.peerId &&
      this.state.peerReady
    ) {
      this.patch({ identity });
      return;
    }
    this.starting = true;
    this.destroyPeer();
    this.patch({ identity, peerReady: false, peerError: null });

    const peer = new Peer(identity.peerId, { config: STUN, debug: 0 });
    this.peer = peer;

    peer.on("open", () => {
      this.starting = false;
      this.patch({ peerReady: true, peerError: null });
    });

    peer.on("error", (err) => {
      this.starting = false;
      const type = "type" in err ? String(err.type) : "";
      if (type === "unavailable-id") {
        this.patch({
          peerReady: false,
          peerError: "error.unavailableId",
        });
        return;
      }
      if (type === "peer-unavailable") {
        this.toast("toast.peerUnavailable");
        if (this.state.callStatus === "connecting") this.resetCall(false);
        return;
      }
      this.patch({ peerError: "error.peerjs" });
    });

    peer.on("disconnected", () => {
      if (peer.destroyed) return;
      peer.reconnect();
    });

    peer.on("connection", (conn) => {
      this.attachData(conn, false);
    });

    peer.on("call", (call) => {
      void this.onIncomingCall(call);
    });
  }

  setView(view: View) {
    if (this.state.callStatus !== "idle" && view !== "call") return;
    this.patch({ view });
  }

  async startDirect(remoteId: string) {
    const id = invitePeerId(remoteId);
    if (!id || !this.peer || id === this.state.identity?.peerId) return;
    try {
      await this.ensureLocalStream();
    } catch {
      this.toast("toast.mediaCall");
      return;
    }
    this.beginCall("direct", false);
    this.openData(id, {
      type: "hello",
      ...this.helloPayload(),
      kind: "direct",
    });
    this.openMedia(id);
    this.patch({ callStatus: "connecting" });
  }

  async createRoom() {
    try {
      await this.ensureLocalStream();
    } catch {
      this.toast("toast.mediaRoom");
      return;
    }
    this.roomMembers = this.selfInfo() ? [this.selfInfo()!] : [];
    this.beginCall("room", true);
    this.patch({ callStatus: "in-call" });
  }

  async joinRoom(hostId: string) {
    const id = invitePeerId(hostId);
    if (!id || !this.peer || id === this.state.identity?.peerId) return;
    try {
      await this.ensureLocalStream();
    } catch {
      this.toast("toast.mediaJoin");
      return;
    }
    this.beginCall("room", false);
    this.openData(id, {
      type: "hello",
      ...this.helloPayload(),
      kind: "room-join",
    });
    this.patch({ callStatus: "connecting" });
  }

  async acceptIncoming() {
    const incoming = this.state.incoming;
    if (!incoming) return;
    try {
      await this.ensureLocalStream();
    } catch {
      this.toast("toast.mediaAccept");
      return;
    }
    this.beginCall(
      incoming.kind === "room" ? "room" : "direct",
      incoming.kind === "room",
    );
    const queued = this.media.get(incoming.peerId);
    if (queued && this.state.localStream) queued.answer(this.outboundStream());
    const conn = this.data.get(incoming.peerId);
    if (conn?.open) {
      conn.send({
        type: "hello",
        ...this.helloPayload(),
        kind: incoming.kind === "room" ? "room-join" : "direct",
      });
    }
    this.patch({ incoming: null, callStatus: "in-call" });
    this.applyLimitsToAll();
  }

  rejectIncoming() {
    const incoming = this.state.incoming;
    if (!incoming) return;
    this.data.get(incoming.peerId)?.close();
    this.media.get(incoming.peerId)?.close();
    this.data.delete(incoming.peerId);
    this.media.delete(incoming.peerId);
    this.patch({ incoming: null });
  }

  hangUp() {
    if (this.ending) return;
    if (this.state.callStatus === "idle" && this.state.view !== "call") return;
    this.ending = true;
    playCallEnded();
    showToast("toast.callEnded");
    if (this.state.isHost && this.state.callMode === "room") {
      this.broadcast({ type: "room-ended" });
    } else if (this.state.callMode === "direct") {
      this.broadcast({ type: "hangup" });
    }
    window.setTimeout(() => {
      this.ending = false;
      this.resetCall(true);
    }, 80);
  }

  sendChat(text: string) {
    const trimmed = text.trim();
    const me = this.state.identity;
    if (!trimmed || !me) return;
    const message: ChatMessage = {
      id: crypto.randomUUID(),
      fromPeerId: me.peerId,
      fromName: me.displayName,
      text: trimmed,
      at: Date.now(),
    };
    this.patch({ messages: [...this.state.messages, message] });
    this.broadcast({ type: "chat", ...message });
    if (this.state.activeCallId) {
      void appendHistoryMessage({
        ...message,
        callId: this.state.activeCallId,
      });
    }
  }

  toggleMute() {
    const next = !this.state.muted;
    this.state.localStream?.getAudioTracks().forEach((track) => {
      track.enabled = !next;
    });
    this.patch({ muted: next });
  }

  toggleCamera() {
    const next = !this.state.cameraOff;
    this.state.localStream?.getVideoTracks().forEach((track) => {
      track.enabled = !next;
    });
    this.patch({ cameraOff: next });
  }

  async shareScreen() {
    if (this.state.sharingScreen) {
      await this.stopScreenShare();
      return;
    }
    const tier = currentTier();
    let display: MediaStream;
    try {
      display = await navigator.mediaDevices.getDisplayMedia(
        getDisplayConstraints(tier),
      );
    } catch {
      return;
    }
    const track = display.getVideoTracks()[0];
    if (!track) return;
    this.screenTrack = track;
    const screenStream = new MediaStream([track]);
    await applyTrackConstraints(screenStream, "screen", tier);
    track.addEventListener("ended", () => {
      void this.stopScreenShare();
    });
    this.patch({
      sharingScreen: true,
      localScreenStream: screenStream,
      screenShareOrder: this.appendShare(this.state.identity?.peerId),
    });
    this.broadcast({ type: "media-meta", sharingScreen: true });
    this.openScreenToAll();
  }

  async stopScreenShare() {
    for (const call of this.screenOut.values()) call.close();
    this.screenOut.clear();
    this.screenTrack?.stop();
    this.screenTrack = null;
    this.patch({
      sharingScreen: false,
      localScreenStream: null,
      screenShareOrder: this.removeShare(this.state.identity?.peerId),
    });
    this.broadcast({ type: "media-meta", sharingScreen: false });
  }

  async reapplyQuality() {
    const stream = this.state.localStream;
    const tier = currentTier();
    if (stream) await applyTrackConstraints(stream, "camera", tier);
    if (this.screenTrack) {
      await applyTrackConstraints(
        new MediaStream([this.screenTrack]),
        "screen",
        tier,
      );
    }
    this.applyLimitsToAll();
  }

  private helloPayload() {
    const me = this.state.identity;
    return {
      displayName: me?.displayName ?? t("common.someone"),
      peerId: me?.peerId ?? "",
    };
  }

  private selfInfo(): PeerInfo | null {
    const me = this.state.identity;
    return me ? { peerId: me.peerId, displayName: me.displayName } : null;
  }

  private beginCall(mode: CallMode, isHost: boolean) {
    const callId = crypto.randomUUID();
    const me = this.selfInfo();
    this.patch({
      view: "call",
      callMode: mode,
      isHost,
      callStatus: "connecting",
      messages: [],
      remotes: [],
      activeCallId: callId,
    });
    if (me) {
      void startHistoryCall({
        id: callId,
        mode,
        startedAt: Date.now(),
        endedAt: null,
        participants: [me],
      });
    }
  }

  private async ensureLocalStream() {
    if (this.state.localStream && this.state.localStream.active)
      return this.state.localStream;
    const tier = currentTier();
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia(
        getCameraConstraints(tier),
      );
    } catch {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: true,
      });
    }
    await applyTrackConstraints(stream, "camera", tier);
    stream.getAudioTracks().forEach((track) => {
      track.enabled = !this.state.muted;
    });
    stream.getVideoTracks().forEach((track) => {
      track.enabled = !this.state.cameraOff;
    });
    this.patch({ localStream: stream });
    return stream;
  }

  private outboundStream() {
    const local = this.state.localStream;
    const mixed = new MediaStream();
    local?.getAudioTracks().forEach((track) => mixed.addTrack(track));
    const video = local?.getVideoTracks()[0];
    if (video) mixed.addTrack(video);
    return mixed;
  }

  private openData(peerId: string, first?: WireMessage) {
    if (!this.peer || this.data.has(peerId)) return;
    const conn = this.peer.connect(peerId, {
      reliable: true,
      metadata: this.helloPayload(),
    });
    this.attachData(conn, true, first);
  }

  private openMedia(peerId: string) {
    if (!this.peer || this.media.has(peerId) || !this.state.localStream) return;
    const call = this.peer.call(peerId, this.outboundStream(), {
      metadata: { ...this.helloPayload(), kind: "camera" },
    });
    this.attachMedia(call);
    if (this.state.sharingScreen) this.openScreen(peerId);
  }

  private openScreen(peerId: string) {
    const stream = this.state.localScreenStream;
    if (!this.peer || this.screenOut.has(peerId) || !stream) return;
    const call = this.peer.call(peerId, stream, {
      metadata: { ...this.helloPayload(), kind: "screen" },
    });
    this.screenOut.set(peerId, call);
    call.on("close", () => this.screenOut.delete(peerId));
    call.on("error", () => this.screenOut.delete(peerId));
    window.setTimeout(() => this.applyLimitsToAll(), 400);
  }

  private openScreenToAll() {
    const ids = new Set<string>([
      ...this.data.keys(),
      ...this.media.keys(),
      ...this.state.remotes.map((r) => r.peerId),
    ]);
    for (const peerId of ids) {
      if (peerId !== this.state.identity?.peerId) this.openScreen(peerId);
    }
  }

  private attachData(
    conn: DataConnection,
    outgoing: boolean,
    first?: WireMessage,
  ) {
    this.data.set(conn.peer, conn);
    conn.on("open", () => {
      if (outgoing && first) conn.send(first);
      else if (outgoing && this.state.callMode) {
        conn.send({
          type: "hello",
          ...this.helloPayload(),
          kind: this.state.callMode === "room" ? "room-join" : "direct",
        });
      }
      if (this.state.sharingScreen)
        conn.send({ type: "media-meta", sharingScreen: true });
    });
    conn.on("data", (raw) => {
      this.onWire(conn, raw);
    });
    conn.on("close", () => this.onPeerLeft(conn.peer));
    conn.on("error", () => this.onPeerLeft(conn.peer));
  }

  private attachMedia(call: MediaConnection) {
    this.media.set(call.peer, call);
    call.on("stream", (stream) => {
      this.upsertRemote(call.peer, { stream });
      const onRemoteEnded = () => {
        if (stream.getTracks().some((track) => track.readyState === "live"))
          return;
        this.onPeerLeft(call.peer);
      };
      for (const track of stream.getTracks()) {
        track.addEventListener("ended", onRemoteEnded);
      }
      if (this.state.callStatus !== "in-call")
        this.patch({ callStatus: "in-call" });
      window.setTimeout(() => this.applyLimitsToAll(), 400);
    });
    call.on("close", () => this.onPeerLeft(call.peer));
    call.on("error", () => this.onPeerLeft(call.peer));
  }

  private async onIncomingCall(call: MediaConnection) {
    const meta = call.metadata as
      | { displayName?: string; kind?: string }
      | undefined;
    if (meta?.kind === "screen") {
      if (this.state.callStatus === "idle") {
        call.close();
        return;
      }
      call.answer();
      this.attachIncomingScreen(call);
      const displayName =
        meta.displayName || this.names.get(call.peer) || t("common.someone");
      this.names.set(call.peer, displayName);
      this.upsertRemote(call.peer, { displayName, sharingScreen: true });
      this.rememberShare(call.peer);
      return;
    }

    this.media.set(call.peer, call);
    if (this.state.callStatus !== "idle") {
      if (this.state.localStream) call.answer(this.outboundStream());
      this.attachMedia(call);
      if (this.state.sharingScreen) this.openScreen(call.peer);
      return;
    }
    this.attachMedia(call);
    this.patch({
      incoming: {
        peerId: call.peer,
        displayName:
          meta?.displayName || this.names.get(call.peer) || t("common.someone"),
        kind: "direct",
      },
    });
  }

  private attachIncomingScreen(call: MediaConnection) {
    const previous = this.screenIn.get(call.peer);
    this.screenIn.set(call.peer, call);
    previous?.close();
    call.on("stream", (stream) => {
      this.upsertRemote(call.peer, {
        screenStream: stream,
        sharingScreen: true,
      });
      this.rememberShare(call.peer);
    });
    call.on("close", () => this.dropIncomingScreen(call));
    call.on("error", () => this.dropIncomingScreen(call));
  }

  private dropIncomingScreen(call: MediaConnection) {
    if (this.screenIn.get(call.peer) !== call) return;
    this.screenIn.delete(call.peer);
    if (!this.state.remotes.some((r) => r.peerId === call.peer)) return;
    this.upsertRemote(call.peer, { screenStream: null, sharingScreen: false });
    this.forgetShare(call.peer);
  }

  private clearRemoteScreen(peerId: string) {
    const call = this.screenIn.get(peerId);
    this.screenIn.delete(peerId);
    if (call) call.close();
    if (!this.state.remotes.some((r) => r.peerId === peerId)) return;
    this.upsertRemote(peerId, { screenStream: null, sharingScreen: false });
    this.forgetShare(peerId);
  }

  private onWire(conn: DataConnection, raw: unknown) {
    const msg = raw as WireMessage;
    if (!msg || typeof msg !== "object" || !("type" in msg)) return;

    if (msg.type === "hello") {
      this.names.set(msg.peerId, msg.displayName);
      this.upsertRemote(msg.peerId, { displayName: msg.displayName });
      if (this.state.callStatus === "idle") {
        this.patch({
          incoming: {
            peerId: msg.peerId,
            displayName: msg.displayName,
            kind: msg.kind === "room-join" ? "room" : "direct",
          },
        });
        return;
      }
      if (
        this.state.callMode === "room" &&
        this.state.isHost &&
        msg.kind === "room-join"
      ) {
        this.addRoomMember({
          peerId: msg.peerId,
          displayName: msg.displayName,
        });
        this.broadcast({ type: "room-peers", peers: this.roomMembers });
        this.maybeCall(msg.peerId);
      }
      this.maybeCall(msg.peerId);
      this.syncHistoryPeers();
      return;
    }

    if (msg.type === "room-peers") {
      this.roomMembers = msg.peers;
      for (const peer of msg.peers) {
        if (peer.peerId === this.state.identity?.peerId) continue;
        this.names.set(peer.peerId, peer.displayName);
        this.upsertRemote(peer.peerId, { displayName: peer.displayName });
        this.maybeConnect(peer.peerId);
        this.maybeCall(peer.peerId);
      }
      if (this.state.callStatus !== "in-call")
        this.patch({ callStatus: "in-call" });
      this.syncHistoryPeers();
      return;
    }

    if (msg.type === "chat") {
      const message: ChatMessage = {
        id: msg.id,
        fromPeerId: msg.fromPeerId,
        fromName: msg.fromName,
        text: msg.text,
        at: msg.at,
      };
      this.patch({ messages: [...this.state.messages, message] });
      if (this.state.activeCallId) {
        void appendHistoryMessage({
          ...message,
          callId: this.state.activeCallId,
        });
      }
      return;
    }

    if (msg.type === "hangup") {
      if (this.state.callStatus !== "idle") {
        this.resetCall(true, "toast.peerLeft");
      }
      return;
    }

    if (msg.type === "room-ended") {
      this.resetCall(true, "toast.roomEndedByHost");
      return;
    }

    if (msg.type === "media-meta") {
      if (msg.sharingScreen) {
        this.upsertRemote(conn.peer, { sharingScreen: true });
        this.rememberShare(conn.peer);
      } else {
        this.clearRemoteScreen(conn.peer);
      }
    }
  }

  private addRoomMember(info: PeerInfo) {
    if (!this.roomMembers.some((p) => p.peerId === info.peerId)) {
      this.roomMembers = [...this.roomMembers, info];
    }
  }

  private maybeConnect(peerId: string) {
    const me = this.state.identity?.peerId;
    if (!me || peerId === me || this.data.has(peerId)) return;
    if (me < peerId) this.openData(peerId);
  }

  private maybeCall(peerId: string) {
    const me = this.state.identity?.peerId;
    if (!me || peerId === me || !this.state.localStream) return;
    if (!this.media.has(peerId) && me < peerId) this.openMedia(peerId);
    else if (this.state.sharingScreen) this.openScreen(peerId);
  }

  private upsertRemote(peerId: string, patch: Partial<RemotePeer>) {
    const current = this.state.remotes.find((r) => r.peerId === peerId);
    const next: RemotePeer = {
      peerId,
      displayName:
        patch.displayName ??
        current?.displayName ??
        this.names.get(peerId) ??
        t("common.someone"),
      stream:
        patch.stream === undefined ? (current?.stream ?? null) : patch.stream,
      screenStream:
        patch.screenStream === undefined
          ? (current?.screenStream ?? null)
          : patch.screenStream,
      sharingScreen: patch.sharingScreen ?? current?.sharingScreen ?? false,
    };
    const remotes = current
      ? this.state.remotes.map((r) => (r.peerId === peerId ? next : r))
      : [...this.state.remotes.filter((r) => r.peerId !== peerId), next];
    this.patch({ remotes });
  }

  private appendShare(peerId: string | undefined) {
    if (!peerId) return this.state.screenShareOrder;
    if (this.state.screenShareOrder.includes(peerId))
      return this.state.screenShareOrder;
    return [...this.state.screenShareOrder, peerId];
  }

  private removeShare(peerId: string | undefined) {
    if (!peerId) return this.state.screenShareOrder;
    return this.state.screenShareOrder.filter((id) => id !== peerId);
  }

  private rememberShare(peerId: string) {
    const screenShareOrder = this.appendShare(peerId);
    if (screenShareOrder === this.state.screenShareOrder) return;
    this.patch({ screenShareOrder });
  }

  private forgetShare(peerId: string) {
    const screenShareOrder = this.removeShare(peerId);
    if (screenShareOrder.length === this.state.screenShareOrder.length) return;
    this.patch({ screenShareOrder });
  }

  private onPeerLeft(peerId: string) {
    if (this.ending) return;
    this.data.get(peerId)?.close();
    this.media.get(peerId)?.close();
    this.screenOut.get(peerId)?.close();
    this.screenIn.get(peerId)?.close();
    this.data.delete(peerId);
    this.media.delete(peerId);
    this.screenOut.delete(peerId);
    this.screenIn.delete(peerId);
    const remotes = this.state.remotes.filter((r) => r.peerId !== peerId);
    this.patch({
      remotes,
      screenShareOrder: this.removeShare(peerId),
      incoming:
        this.state.incoming?.peerId === peerId ? null : this.state.incoming,
    });
    if (this.state.isHost && this.state.callMode === "room") {
      this.roomMembers = this.roomMembers.filter((p) => p.peerId !== peerId);
      this.broadcast({ type: "room-peers", peers: this.roomMembers });
    }
    if (
      this.state.callMode === "direct" &&
      remotes.length === 0 &&
      (this.state.callStatus === "in-call" ||
        this.state.callStatus === "connecting")
    ) {
      this.resetCall(true, "toast.peerLeft");
    }
    if (
      this.state.callMode === "room" &&
      !this.state.isHost &&
      remotes.length === 0 &&
      (this.state.callStatus === "in-call" ||
        this.state.callStatus === "connecting")
    ) {
      this.resetCall(true, "toast.roomEnded");
    }
  }

  private broadcast(message: WireMessage) {
    for (const conn of this.data.values()) {
      if (conn.open) conn.send(message);
    }
  }

  private applyLimitsToAll() {
    const tier = currentTier();
    for (const call of this.media.values()) {
      const pc = call.peerConnection;
      if (!pc) continue;
      for (const sender of pc.getSenders()) {
        void applySenderLimits(sender, "camera", tier);
      }
    }
    for (const call of this.screenOut.values()) {
      const pc = call.peerConnection;
      if (!pc) continue;
      for (const sender of pc.getSenders()) {
        void applySenderLimits(sender, "screen", tier);
      }
    }
  }

  private syncHistoryPeers() {
    const callId = this.state.activeCallId;
    const me = this.selfInfo();
    if (!callId || !me) return;
    const participants = [
      me,
      ...this.state.remotes.map((r) => ({
        peerId: r.peerId,
        displayName: r.displayName,
      })),
    ];
    void touchHistoryParticipants(callId, participants);
  }

  private resetCall(endHistory: boolean, endedReason?: MessageKey) {
    if (this.ending) return;
    this.ending = true;
    if (endHistory && this.state.activeCallId) {
      void endHistoryCall(this.state.activeCallId);
    }
    for (const conn of this.data.values()) conn.close();
    for (const call of this.media.values()) call.close();
    for (const call of this.screenOut.values()) call.close();
    for (const call of this.screenIn.values()) call.close();
    this.data.clear();
    this.media.clear();
    this.screenOut.clear();
    this.screenIn.clear();
    this.roomMembers = [];
    this.screenTrack?.stop();
    this.screenTrack = null;
    this.state.localStream?.getTracks().forEach((track) => track.stop());
    this.names.clear();
    if (endedReason) {
      playCallEnded();
      showToast(endedReason);
    }
    this.patch({
      view: "home",
      localStream: null,
      localScreenStream: null,
      remotes: [],
      messages: [],
      sharingScreen: false,
      screenShareOrder: [],
      muted: false,
      cameraOff: false,
      callMode: null,
      isHost: false,
      callStatus: "idle",
      incoming: null,
      activeCallId: null,
    });
    window.setTimeout(() => {
      this.ending = false;
    }, 400);
  }

  private destroyPeer() {
    this.peer?.destroy();
    this.peer = null;
  }
}

export const session = new PeerSession();
