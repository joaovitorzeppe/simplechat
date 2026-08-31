import { Peer, type DataConnection, type MediaConnection } from "peerjs";
import { invitePeerId } from "./invite";
import {
  applySenderLimits,
  applyTrackConstraints,
  currentTier,
  getCameraConstraints,
  getDisplayConstraints,
  maxFileBytes,
  maxParticipants,
  MAX_FILE_BYTES,
} from "./quality";
import type { MessageKey } from "../i18n/locales";
import { t } from "../i18n/i18n";
import { playCallEnded } from "./sounds";
import { showToast } from "./toast";
import { safeFileName } from "./chat";
import type {
  CallMode,
  ChatFile,
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
  hostPeerId: string | null;
  callStatus: "idle" | "connecting" | "in-call";
  incoming: IncomingInvite | null;
};

const FILE_CHUNK = 16 * 1024;
const FILE_BUFFER_HIGH = 2_000_000;

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
  hostPeerId: null,
  callStatus: "idle",
  incoming: null,
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
  private sendingFile = false;
  private incomingFiles = new Map<
    string,
    {
      id: string;
      name: string;
      mime: string;
      size: number;
      received: number;
      buffer: Uint8Array;
      lastPatch: number;
    }
  >();
  private incomingByteTail = new Map<string, Promise<void>>();

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
        if (this.state.callStatus === "connecting") this.resetCall();
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

  async callPeer(remoteId: string) {
    const id = invitePeerId(remoteId);
    if (!id || !this.peer || id === this.state.identity?.peerId) return;
    try {
      await this.ensureLocalStream();
    } catch {
      this.toast("toast.mediaCall");
      return;
    }
    const me = this.selfInfo();
    this.roomMembers = me ? [me] : [];
    this.beginCall(true, me?.peerId ?? id);
    this.openData(id, {
      type: "hello",
      ...this.helloPayload(),
      kind: "room-join",
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
    const me = this.selfInfo();
    this.roomMembers = me ? [me] : [];
    this.beginCall(true, me?.peerId ?? "");
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
    this.beginCall(false, id);
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
    this.beginCall(false, incoming.peerId);
    const queued = this.media.get(incoming.peerId);
    if (queued && this.state.localStream) queued.answer(this.outboundStream());
    const conn = this.data.get(incoming.peerId);
    if (conn?.open) {
      conn.send({
        type: "hello",
        ...this.helloPayload(),
        kind: "room-join",
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
    const hostLeaving = this.state.isHost;
    playCallEnded();
    showToast(hostLeaving ? "toast.callEnded" : "toast.leftCall");
    if (hostLeaving) this.broadcast({ type: "room-ended" });
    window.setTimeout(() => {
      this.ending = false;
      this.resetCall();
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
  }

  async sendFile(file: File) {
    const me = this.state.identity;
    if (!me || this.state.callStatus === "idle" || this.ending) return;
    if (this.sendingFile) {
      this.toast("toast.fileBusy");
      return;
    }
    const max = maxFileBytes();
    if (file.size <= 0 || file.size > max) {
      this.toast(
        currentTier() === "pro"
          ? "toast.fileTooBigPro"
          : "toast.fileTooBigFree",
      );
      return;
    }
    const id = crypto.randomUUID();
    const name = safeFileName(file.name);
    const mime = file.type || "application/octet-stream";
    const blobUrl = URL.createObjectURL(file);
    const message: ChatMessage = {
      id,
      fromPeerId: me.peerId,
      fromName: me.displayName,
      text: "",
      at: Date.now(),
      file: {
        id,
        name,
        mime,
        size: file.size,
        status: "sending",
        progress: 0,
        blobUrl,
      },
    };
    this.patch({ messages: [...this.state.messages, message] });
    this.sendingFile = true;
    try {
      const buffer = await file.arrayBuffer();
      const start = {
        type: "file-start" as const,
        id,
        name,
        mime,
        size: file.size,
        fromPeerId: me.peerId,
        fromName: me.displayName,
        at: message.at,
      };
      const peers = [...this.data.values()].filter((conn) => conn.open);
      if (peers.length === 0) {
        this.patchFile(id, { status: "ready", progress: 1 });
        return;
      }
      let lastPatch = 0;
      for (const conn of peers) conn.send(start);
      for (let offset = 0; offset < buffer.byteLength; offset += FILE_CHUNK) {
        if (this.ending) throw new Error("ended");
        const chunk = buffer.slice(offset, offset + FILE_CHUNK);
        for (const conn of peers) {
          if (!conn.open) continue;
          await this.waitForFileBuffer(conn);
          if (!conn.open) continue;
          conn.send(chunk);
        }
        const progress = Math.min(1, (offset + chunk.byteLength) / file.size);
        const now = Date.now();
        if (progress === 1 || now - lastPatch > 200) {
          lastPatch = now;
          this.patchFile(id, { progress });
        }
      }
      for (const conn of peers) {
        if (conn.open) conn.send({ type: "file-end", id });
      }
      this.patchFile(id, { status: "ready", progress: 1 });
    } catch {
      this.patchFile(id, { status: "error" });
      this.toast("toast.fileFailed");
    } finally {
      this.sendingFile = false;
    }
  }

  toggleMute() {
    const next = !this.state.muted;
    this.state.localStream?.getAudioTracks().forEach((track) => {
      track.enabled = !next;
    });
    this.patch({ muted: next });
  }

  async toggleCamera() {
    if (this.state.cameraOff) await this.enableCamera();
    else this.disableCamera();
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

  private beginCall(isHost: boolean, hostPeerId: string) {
    this.patch({
      view: "call",
      callMode: "room",
      isHost,
      hostPeerId,
      callStatus: "connecting",
      messages: [],
      remotes: [],
    });
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
    if (this.state.cameraOff) {
      stream.getVideoTracks().forEach((track) => track.stop());
      const audioOnly = new MediaStream(stream.getAudioTracks());
      this.patch({ localStream: audioOnly });
      return audioOnly;
    }
    this.patch({ localStream: stream });
    return stream;
  }

  private disableCamera() {
    this.syncOutgoingVideo(null);
    const audio = this.state.localStream?.getAudioTracks() ?? [];
    this.state.localStream?.getVideoTracks().forEach((track) => track.stop());
    this.patch({ cameraOff: true, localStream: new MediaStream(audio) });
    this.broadcast({ type: "media-meta", cameraOff: true });
  }

  private async enableCamera() {
    const tier = currentTier();
    let fresh: MediaStream;
    try {
      fresh = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: getCameraConstraints(tier).video,
      });
    } catch {
      this.toast("toast.mediaCamera");
      return;
    }
    const video = fresh.getVideoTracks()[0];
    if (!video) return;
    await applyTrackConstraints(new MediaStream([video]), "camera", tier);
    const audio = this.state.localStream?.getAudioTracks() ?? [];
    this.state.localStream?.getVideoTracks().forEach((track) => track.stop());
    const stream = new MediaStream([...audio, video]);
    this.syncOutgoingVideo(video);
    this.patch({ cameraOff: false, localStream: stream });
    this.broadcast({ type: "media-meta", cameraOff: false });
    this.applyLimitsToAll();
    window.setTimeout(() => this.applyLimitsToAll(), 400);
  }

  private syncOutgoingVideo(track: MediaStreamTrack | null) {
    for (const call of this.media.values()) {
      const pc = call.peerConnection;
      if (!pc) continue;
      const sender =
        pc.getSenders().find((s) => s.track?.kind === "video") ??
        pc.getTransceivers().find((tr) => {
          const kind = tr.sender.track?.kind ?? tr.receiver.track?.kind;
          return kind === "video";
        })?.sender;
      if (sender) {
        void sender.replaceTrack(track);
      } else if (track) {
        try {
          pc.addTrack(
            track,
            this.state.localStream ?? new MediaStream([track]),
          );
        } catch {
          // a linha de vídeo já existe nesta conexão
        }
      }
    }
  }

  private outboundStream() {
    const local = this.state.localStream;
    const mixed = new MediaStream();
    local?.getAudioTracks().forEach((track) => mixed.addTrack(track));
    if (!this.state.cameraOff) {
      const video = local?.getVideoTracks()[0];
      if (video && video.readyState === "live") mixed.addTrack(video);
    }
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
          kind: "room-join",
        });
      }
      if (this.state.sharingScreen)
        conn.send({ type: "media-meta", sharingScreen: true });
      if (this.state.cameraOff)
        conn.send({ type: "media-meta", cameraOff: true });
    });
    conn.on("data", (raw) => {
      if (this.onFileBytes(conn, raw)) return;
      this.onWire(conn, raw);
    });
    conn.on("close", () => this.onPeerLeft(conn.peer));
    conn.on("error", () => this.onPeerLeft(conn.peer));
  }

  private attachMedia(call: MediaConnection) {
    this.media.set(call.peer, call);
    call.on("stream", (stream) => {
      this.upsertRemote(call.peer, {
        stream,
        ...(stream.getVideoTracks().length === 0 ? { cameraOff: true } : {}),
      });
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

    if (this.state.callStatus !== "idle") {
      if (this.shouldRefusePeer(call.peer)) {
        this.refuseJoin(call.peer);
        call.close();
        return;
      }
      this.media.set(call.peer, call);
      if (this.state.localStream) call.answer(this.outboundStream());
      this.attachMedia(call);
      if (this.state.sharingScreen) this.openScreen(call.peer);
      return;
    }
    this.media.set(call.peer, call);
    this.attachMedia(call);
    this.patch({
      incoming: {
        peerId: call.peer,
        displayName:
          meta?.displayName || this.names.get(call.peer) || t("common.someone"),
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
      if (this.state.callStatus === "idle") {
        this.upsertRemote(msg.peerId, { displayName: msg.displayName });
        this.patch({
          incoming: {
            peerId: msg.peerId,
            displayName: msg.displayName,
          },
        });
        return;
      }
      if (this.state.isHost) {
        const already = this.roomMembers.some((p) => p.peerId === msg.peerId);
        if (!already && this.isRoomFull()) {
          this.refuseJoin(msg.peerId);
          return;
        }
        this.upsertRemote(msg.peerId, { displayName: msg.displayName });
        this.addRoomMember({
          peerId: msg.peerId,
          displayName: msg.displayName,
        });
        this.broadcast({ type: "room-peers", peers: this.roomMembers });
      } else {
        this.upsertRemote(msg.peerId, { displayName: msg.displayName });
      }
      this.maybeCall(msg.peerId);
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
      return;
    }

    if (msg.type === "file-start") {
      this.beginIncomingFile(conn.peer, msg);
      return;
    }

    if (msg.type === "file-end") {
      this.finishIncomingFile(conn.peer, msg.id);
      return;
    }

    if (msg.type === "hangup") {
      this.onPeerLeft(conn.peer);
      return;
    }

    if (msg.type === "room-ended") {
      this.resetCall("toast.roomEndedByHost");
      return;
    }

    if (msg.type === "room-full") {
      this.resetCall("toast.roomFull");
      return;
    }

    if (msg.type === "media-meta") {
      if (msg.cameraOff !== undefined) {
        this.upsertRemote(conn.peer, { cameraOff: msg.cameraOff });
      }
      if (msg.sharingScreen === true) {
        this.upsertRemote(conn.peer, { sharingScreen: true });
        this.rememberShare(conn.peer);
      } else if (msg.sharingScreen === false) {
        this.clearRemoteScreen(conn.peer);
      }
    }
  }

  private isRoomFull() {
    return this.roomMembers.length >= maxParticipants();
  }

  private shouldRefusePeer(peerId: string) {
    if (!this.state.isHost || !this.isRoomFull()) return false;
    return !this.roomMembers.some((p) => p.peerId === peerId);
  }

  private refuseJoin(peerId: string) {
    const conn = this.data.get(peerId);
    if (conn?.open) conn.send({ type: "room-full" });
    conn?.close();
    this.media.get(peerId)?.close();
    this.data.delete(peerId);
    this.media.delete(peerId);
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
      cameraOff: patch.cameraOff ?? current?.cameraOff ?? false,
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
    this.failIncomingFile(peerId);
    const remotes = this.state.remotes.filter((r) => r.peerId !== peerId);
    this.patch({
      remotes,
      screenShareOrder: this.removeShare(peerId),
      incoming:
        this.state.incoming?.peerId === peerId ? null : this.state.incoming,
    });
    if (this.state.isHost) {
      this.roomMembers = this.roomMembers.filter((p) => p.peerId !== peerId);
      this.broadcast({ type: "room-peers", peers: this.roomMembers });
      return;
    }
    if (
      peerId === this.state.hostPeerId &&
      (this.state.callStatus === "in-call" ||
        this.state.callStatus === "connecting")
    ) {
      this.resetCall("toast.roomEndedByHost");
    }
  }

  private waitForFileBuffer(conn: DataConnection) {
    const dc = conn.dataChannel;
    if (!dc || dc.bufferedAmount < FILE_BUFFER_HIGH) return Promise.resolve();
    return new Promise<void>((resolve) => {
      const tick = () => {
        if (!conn.open || dc.bufferedAmount < FILE_BUFFER_HIGH / 4) resolve();
        else window.setTimeout(tick, 30);
      };
      tick();
    });
  }

  private bytesFrom(raw: unknown): Uint8Array | null {
    let view: Uint8Array | null = null;
    if (raw instanceof ArrayBuffer) view = new Uint8Array(raw);
    else if (ArrayBuffer.isView(raw)) {
      view = new Uint8Array(raw.buffer, raw.byteOffset, raw.byteLength);
    }
    if (!view) return null;
    const copy = new Uint8Array(view.byteLength);
    copy.set(view);
    return copy;
  }

  private onFileBytes(conn: DataConnection, raw: unknown) {
    const incoming = this.incomingFiles.get(conn.peer);
    const bytes = this.bytesFrom(raw);
    if (bytes) {
      if (!incoming) return true;
      this.applyIncomingBytes(conn.peer, bytes);
      return true;
    }
    if (incoming && typeof Blob !== "undefined" && raw instanceof Blob) {
      const prev = this.incomingByteTail.get(conn.peer) ?? Promise.resolve();
      const next = prev
        .then(async () => {
          this.applyIncomingBytes(
            conn.peer,
            new Uint8Array(await raw.arrayBuffer()),
          );
        })
        .catch(() => {
          this.failIncomingFile(conn.peer);
        });
      this.incomingByteTail.set(conn.peer, next);
      return true;
    }
    return false;
  }

  private applyIncomingBytes(peerId: string, bytes: Uint8Array) {
    const incoming = this.incomingFiles.get(peerId);
    if (!incoming) return;
    const next = incoming.received + bytes.byteLength;
    if (next > incoming.size) {
      this.failIncomingFile(peerId);
      return;
    }
    incoming.buffer.set(bytes, incoming.received);
    incoming.received = next;
    const now = Date.now();
    if (now - incoming.lastPatch > 200 || next === incoming.size) {
      incoming.lastPatch = now;
      this.patchFile(incoming.id, { progress: next / incoming.size });
    }
  }

  private beginIncomingFile(
    peerId: string,
    msg: Extract<WireMessage, { type: "file-start" }>,
  ) {
    if (this.incomingFiles.has(peerId)) this.failIncomingFile(peerId);
    const size = msg.size;
    if (
      !Number.isFinite(size) ||
      size <= 0 ||
      size > MAX_FILE_BYTES.pro ||
      typeof msg.id !== "string" ||
      typeof msg.name !== "string"
    ) {
      this.toast("toast.fileFailed");
      return;
    }
    const name = safeFileName(msg.name);
    const mime =
      typeof msg.mime === "string" && msg.mime.length < 120
        ? msg.mime
        : "application/octet-stream";
    let buffer: Uint8Array;
    try {
      buffer = new Uint8Array(size);
    } catch {
      this.toast("toast.fileFailed");
      return;
    }
    this.incomingFiles.set(peerId, {
      id: msg.id,
      name,
      mime,
      size,
      received: 0,
      buffer,
      lastPatch: 0,
    });
    const message: ChatMessage = {
      id: msg.id,
      fromPeerId: msg.fromPeerId || peerId,
      fromName: msg.fromName || this.names.get(peerId) || t("common.someone"),
      text: "",
      at: msg.at || Date.now(),
      file: {
        id: msg.id,
        name,
        mime,
        size,
        status: "receiving",
        progress: 0,
        blobUrl: null,
      },
    };
    this.patch({ messages: [...this.state.messages, message] });
  }

  private finishIncomingFile(peerId: string, id: string) {
    const tail = this.incomingByteTail.get(peerId) ?? Promise.resolve();
    void tail.then(() => {
      const incoming = this.incomingFiles.get(peerId);
      if (!incoming || incoming.id !== id) return;
      this.incomingFiles.delete(peerId);
      this.incomingByteTail.delete(peerId);
      if (incoming.received !== incoming.size) {
        this.patchFile(incoming.id, { status: "error" });
        return;
      }
      const copy = new Uint8Array(incoming.buffer);
      const blob = new Blob([copy], { type: incoming.mime });
      const blobUrl = URL.createObjectURL(blob);
      this.patchFile(incoming.id, {
        status: "ready",
        progress: 1,
        blobUrl,
      });
    });
  }

  private failIncomingFile(peerId: string) {
    const incoming = this.incomingFiles.get(peerId);
    this.incomingFiles.delete(peerId);
    this.incomingByteTail.delete(peerId);
    if (incoming) this.patchFile(incoming.id, { status: "error" });
  }

  private patchFile(id: string, file: Partial<ChatFile>) {
    this.patch({
      messages: this.state.messages.map((message) => {
        if (message.id !== id || !message.file) return message;
        return { ...message, file: { ...message.file, ...file } };
      }),
    });
  }

  private revokeMessageFiles() {
    for (const message of this.state.messages) {
      if (message.file?.blobUrl) URL.revokeObjectURL(message.file.blobUrl);
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

  private resetCall(endedReason?: MessageKey) {
    if (this.ending) return;
    this.ending = true;
    for (const conn of this.data.values()) conn.close();
    for (const call of this.media.values()) call.close();
    for (const call of this.screenOut.values()) call.close();
    for (const call of this.screenIn.values()) call.close();
    this.data.clear();
    this.media.clear();
    this.screenOut.clear();
    this.screenIn.clear();
    this.incomingFiles.clear();
    this.incomingByteTail.clear();
    this.sendingFile = false;
    this.revokeMessageFiles();
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
      hostPeerId: null,
      callStatus: "idle",
      incoming: null,
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
