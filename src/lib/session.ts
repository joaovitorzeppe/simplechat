import type { DataConnection, MediaConnection, Peer } from "peerjs";
import { loadRoomSecret, rotateRoomSecret } from "./identity";
import { clearInviteLocation, parseInvite } from "./invite";
import type { MessageKey } from "@i18n/locales";
import { t } from "@i18n/i18n";
import { playCallEnded } from "./sounds";
import { showToast } from "./toast";
import type { TimerAction } from "./timer";
import { CONNECT_GIVE_UP_MS, CONNECT_HINT_MS, iceGaveUpKind } from "./ice-path";
import { dropMute, type MuteKind, type MuteMap } from "./mutes";
import type { ScreenPreset } from "./quality";
import { clampDisplayName, parseWire } from "./wire-guard";
import { SessionChat } from "./session-chat";
import { SessionFiles } from "./session-files";
import { SessionMedia } from "./session-media";
import { electHost, FLUSH_MS, SessionRoom } from "./session-room";
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
  /** Quem está na sala, na ordem em que entrou. Host primeiro. */
  members: PeerInfo[];
  messages: ChatMessage[];
  muted: boolean;
  cameraOff: boolean;
  /** Duas ou mais câmeras: dá para ciclar a que está no ar. */
  canSwitchCamera: boolean;
  /** Silêncio só neste cliente: não vai para o fio. */
  localMutes: MuteMap;
  /** Silêncio mandado pelo host: vale para a sala inteira. */
  roomMutes: MuteMap;
  sharingScreen: boolean;
  screenShareOrder: string[];
  callMode: CallMode | null;
  isHost: boolean;
  hostPeerId: string | null;
  callStatus: "idle" | "connecting" | "waiting" | "in-call";
  incoming: IncomingInvite | null;
  /** Segredo da sala que o link de convite deve carregar, se conhecido. */
  roomSecret: string | null;
  /** Quem bateu na porta e ainda espera o host aprovar. Só o host preenche. */
  pending: PeerInfo[];
  /** Host pediu para sair e precisa escolher o destino da sala. */
  leavePrompt: boolean;
  /**
   * ICE nunca fechou (ou a entrada ficou presa em connecting). Vale a pena
   * trocar de rede; não é o mesmo que a pessoa ter saído.
   */
  pathHint: boolean;
};

const MAX_ICE_RETRIES = 2;
const ICE_RECOVERY_MS = 4000;
const RECONNECT_MAX_MS = 30_000;
/** Guest segura mídia lateral até `room-peers`; depois disso é intruso. */
export const HOLD_UNADMITTED_MS = 8_000;

/**
 * Sem TURN, NAT simétrico e redes corporativas simplesmente não conectam. As
 * credenciais vêm do ambiente para não ficarem versionadas; sem elas o app
 * segue funcionando só com STUN.
 */
const iceServers = (): RTCIceServer[] => {
  const servers: RTCIceServer[] = [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
  ];
  const url = import.meta.env.VITE_TURN_URL;
  const username = import.meta.env.VITE_TURN_USERNAME;
  const credential = import.meta.env.VITE_TURN_CREDENTIAL;
  if (url && username && credential) {
    servers.push({ urls: url, username, credential });
  }
  return servers;
};

export { electHost };

const initialState: SessionState = {
  view: "home",
  identity: null,
  peerReady: false,
  peerError: null,
  localStream: null,
  localScreenStream: null,
  remotes: [],
  members: [],
  messages: [],
  muted: false,
  cameraOff: false,
  canSwitchCamera: false,
  localMutes: {},
  roomMutes: {},
  sharingScreen: false,
  screenShareOrder: [],
  callMode: null,
  isHost: false,
  hostPeerId: null,
  callStatus: "idle",
  incoming: null,
  roomSecret: null,
  pending: [],
  leavePrompt: false,
  pathHint: false,
};

type Listener = () => void;

export class PeerSession {
  private listeners = new Set<Listener>();
  private state: SessionState = initialState;
  // Sem `private` o que os domínios (session-*.ts) precisam ler ou chamar.
  peer: Peer | null = null;
  data = new Map<string, DataConnection>();
  calls = new Map<string, MediaConnection>();
  names = new Map<string, string>();
  private iceRetries = new Map<string, number>();
  private iceEverConnected = new Set<string>();
  private iceWatched = new WeakSet<RTCPeerConnection>();
  private connectHintTimer = 0;
  private connectGiveUpTimer = 0;
  private reconnectAttempts = 0;
  private reconnectTimer = 0;
  private starting = false;
  tearingDown = false;
  /** Evita toast/aviso duplicados quando `close()` reentra em `onPeerLeft`. */
  private departing = new Set<string>();
  /** Calls de guest ainda sem `room-peers` — timeout derruba se nunca admitir. */
  private unadmittedHoldTimers = new Map<string, number>();
  readonly room = new SessionRoom(this);
  readonly chat = new SessionChat(this);
  readonly files = new SessionFiles(this);
  readonly media = new SessionMedia(this);

  sendChat = (text: string) => this.chat.sendChat(text);
  votePoll = (pollId: string, option: number) => {
    this.chat.votePoll(pollId, option);
  };
  controlTimer = (messageId: string, action: TimerAction) => {
    this.chat.controlTimer(messageId, action);
  };
  sendFile = (file: File) => this.files.sendFile(file);
  toggleMute = () => this.media.toggleMute();
  toggleCamera = () => this.media.toggleCamera();
  switchCamera = () => this.media.switchCamera();
  shareScreen = (preset?: ScreenPreset) => this.media.shareScreen(preset);
  toggleLocalMute = (peerId: string, kind: MuteKind) => {
    this.room.toggleLocalMute(peerId, kind);
  };
  setRoomMute = (peerId: string, kind: MuteKind, muted: boolean) => {
    this.room.setRoomMute(peerId, kind, muted);
  };
  admitPeer = (peerId: string) => {
    this.room.admitPeer(peerId);
  };
  denyPeer = (peerId: string) => {
    this.room.denyPeer(peerId);
  };
  kickPeer = (peerId: string) => {
    this.room.kickPeer(peerId);
  };

  subscribe = (listener: Listener) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getState = () => this.state;

  patch(partial: Partial<SessionState>) {
    let changed = false;
    // As chaves de um Partial<SessionState> são chaves de SessionState.
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion
    for (const key of Object.keys(partial) as (keyof SessionState)[]) {
      if (!Object.is(this.state[key], partial[key])) {
        changed = true;
        break;
      }
    }
    if (!changed) {
      return;
    }
    this.state = { ...this.state, ...partial };
    if (partial.callStatus && partial.callStatus !== "connecting") {
      this.clearConnectWatch();
    }
    for (const listener of this.listeners) {
      listener();
    }
  }

  toast(key: MessageKey) {
    showToast(key);
  }

  async start(identity: Identity) {
    if (this.starting && this.state.identity?.peerId === identity.peerId) {
      return;
    }
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
    this.room.hostSecret = loadRoomSecret();
    this.patch({
      identity,
      peerReady: false,
      peerError: null,
      roomSecret: this.room.hostSecret,
    });

    const { Peer } = await import("peerjs");
    const peer = new Peer(identity.peerId, {
      config: { iceServers: iceServers() },
      debug: 0,
    });
    this.peer = peer;
    this.media.watchDevices();

    peer.on("open", () => {
      this.starting = false;
      this.reconnectAttempts = 0;
      this.patch({ peerReady: true, peerError: null });
    });

    peer.on("error", (err) => {
      this.starting = false;
      const type = "type" in err ? err.type : "";
      if (type === "unavailable-id") {
        this.patch({
          peerReady: false,
          peerError: "error.unavailableId",
        });
        return;
      }
      if (type === "peer-unavailable") {
        this.toast("toast.peerUnavailable");
        if (this.state.callStatus === "connecting") {
          this.resetCall();
        }
        return;
      }
      if (type === "webrtc" && this.state.callStatus === "connecting") {
        this.failPath();
        return;
      }
      this.patch({ peerError: "error.peerjs" });
    });

    peer.on("disconnected", () => {
      if (peer.destroyed) {
        return;
      }
      this.scheduleReconnect(peer);
    });

    peer.on("connection", (conn) => {
      this.attachData(conn, false);
    });

    peer.on("call", (call) => {
      void this.onIncomingCall(call);
    });
  }

  setView(view: View) {
    if (this.state.callStatus !== "idle" && view !== "call") {
      return;
    }
    this.patch({ view });
  }

  private scheduleReconnect(peer: Peer) {
    window.clearTimeout(this.reconnectTimer);
    const delay = Math.min(
      RECONNECT_MAX_MS,
      1000 * 2 ** this.reconnectAttempts,
    );
    this.reconnectAttempts += 1;
    this.reconnectTimer = window.setTimeout(() => {
      if (peer.destroyed || peer.open) {
        return;
      }
      peer.reconnect();
    }, delay);
  }

  /**
   * Uma conexão em `failed` não se recupera sozinha. Tentamos primeiro o ICE
   * restart, que é barato, e só depois refazemos a chamada do zero.
   * Sem nunca ter chegado em `connected`, é bloqueio de caminho (NAT/firewall),
   * não "a pessoa saiu".
   */
  private watchIce(peerId: string, pc: RTCPeerConnection) {
    if (this.iceWatched.has(pc)) {
      return;
    }
    this.iceWatched.add(pc);
    const onState = () => {
      const ice = pc.iceConnectionState;
      const conn = pc.connectionState;
      if (ice === "connected" || ice === "completed" || conn === "connected") {
        this.iceRetries.delete(peerId);
        this.iceEverConnected.add(peerId);
        if (this.state.pathHint) {
          this.patch({ pathHint: false });
        }
        return;
      }
      if (ice !== "failed" && conn !== "failed") {
        return;
      }

      const attempts = this.iceRetries.get(peerId) ?? 0;
      if (attempts >= MAX_ICE_RETRIES) {
        this.handleIceGaveUp(peerId);
        return;
      }
      this.iceRetries.set(peerId, attempts + 1);
      try {
        pc.restartIce();
      } catch {
        // navegadores antigos não expõem restartIce
      }
      window.setTimeout(() => {
        if (
          pc.iceConnectionState !== "failed" &&
          pc.connectionState !== "failed"
        ) {
          return;
        }
        this.redialPeer(peerId);
      }, ICE_RECOVERY_MS);
    };
    pc.addEventListener("iceconnectionstatechange", onState);
    pc.addEventListener("connectionstatechange", onState);
  }

  private handleIceGaveUp(peerId: string) {
    if (iceGaveUpKind(this.iceEverConnected.has(peerId)) === "path") {
      this.failPath(peerId);
      return;
    }
    this.onPeerLeft(peerId);
  }

  private failPath(peerId?: string) {
    if (this.state.callStatus === "connecting") {
      this.resetCall("toast.networkPath");
      return;
    }
    this.patch({ pathHint: true });
    if (!peerId) {
      return;
    }
    const name =
      this.state.remotes.find((r) => r.peerId === peerId)?.displayName ??
      this.names.get(peerId) ??
      t("common.someone");
    showToast("toast.networkPathPeer", { name }, 8000);
    this.onPeerLeft(peerId, { silent: true });
  }

  private armConnectWatch() {
    this.clearConnectWatch();
    this.connectHintTimer = window.setTimeout(() => {
      if (this.state.callStatus !== "connecting") {
        return;
      }
      this.patch({ pathHint: true });
    }, CONNECT_HINT_MS);
    this.connectGiveUpTimer = window.setTimeout(() => {
      if (this.state.callStatus !== "connecting") {
        return;
      }
      this.failPath();
    }, CONNECT_GIVE_UP_MS);
  }

  private clearConnectWatch() {
    window.clearTimeout(this.connectHintTimer);
    window.clearTimeout(this.connectGiveUpTimer);
    this.connectHintTimer = 0;
    this.connectGiveUpTimer = 0;
  }

  private redialPeer(peerId: string) {
    const me = this.state.identity?.peerId;
    if (!me || this.state.callStatus === "idle" || this.tearingDown) {
      return;
    }
    const stale = this.calls.get(peerId);
    this.calls.delete(peerId);
    stale?.close();
    // Só o lado de ID menor disca, igual ao caminho normal, para evitar glare.
    if (me < peerId) {
      this.openMedia(peerId);
    }
  }

  async createRoom() {
    await this.media.ensureLocalStreamOrSilent();
    const me = this.room.selfInfo();
    this.room.setRoomMembers(me ? [me] : []);
    this.room.joinSecret = null;
    // Sala nova ⇒ link novo: quem tinha o convite antigo não bate na porta.
    this.room.hostSecret = rotateRoomSecret();
    this.beginCall(true, me?.peerId ?? "");
    this.patch({ callStatus: "in-call", roomSecret: this.room.hostSecret });
  }

  async joinRoom(hostId: string) {
    const invite = parseInvite(hostId);
    const id = invite?.peerId ?? "";
    if (!id || !this.peer || id === this.state.identity?.peerId) {
      return;
    }
    if (this.state.callStatus !== "idle") {
      return;
    }
    this.room.joinSecret = invite?.secret ?? null;
    this.room.dialedPeerId = id;
    this.beginCall(false, id);
    this.patch({ callStatus: "connecting", roomSecret: this.room.joinSecret });
    await this.media.ensureLocalStreamOrSilent();
    this.openData(id, {
      type: "hello",
      ...this.room.helloPayload(),
      kind: "room-join",
    });
    this.armConnectWatch();
  }

  async acceptIncoming() {
    const incoming = this.state.incoming;
    if (!incoming) {
      return;
    }
    await this.media.ensureLocalStreamOrSilent();
    this.room.dialedPeerId = incoming.peerId;
    this.beginCall(false, incoming.peerId);
    const queued = this.calls.get(incoming.peerId);
    if (queued) {
      queued.answer(this.media.outboundStream());
    }
    const conn = this.data.get(incoming.peerId);
    if (conn?.open) {
      void conn.send({
        type: "hello",
        ...this.room.helloPayload(),
        kind: "room-join",
      });
    }
    this.patch({ incoming: null, callStatus: "in-call" });
    this.media.applyLimitsToAll();
  }

  rejectIncoming() {
    const incoming = this.state.incoming;
    if (!incoming) {
      return;
    }
    this.data.get(incoming.peerId)?.close();
    this.calls.get(incoming.peerId)?.close();
    this.data.delete(incoming.peerId);
    this.calls.delete(incoming.peerId);
    this.patch({ incoming: null });
  }

  hangUp() {
    if (this.tearingDown) {
      return;
    }
    if (this.state.callStatus === "idle" && this.state.view !== "call") {
      return;
    }
    // Sair como host apaga a sala de todo mundo, então a decisão é dele: passar
    // o bastão ou encerrar. Sozinho não há o que decidir.
    if (this.state.isHost && this.state.remotes.length > 0) {
      this.patch({ leavePrompt: true });
      return;
    }
    playCallEnded();
    const hostLeaving = this.state.isHost;
    showToast(hostLeaving ? "toast.callEnded" : "toast.leftCall");
    if (hostLeaving) {
      this.broadcast({ type: "room-ended" });
    } else {
      this.broadcast({
        type: "hangup",
        displayName: this.state.identity?.displayName,
      });
    }
    this.resetCall();
  }

  cancelLeave() {
    if (this.state.leavePrompt) {
      this.patch({ leavePrompt: false });
    }
  }

  endRoomForAll() {
    if (!this.state.isHost || this.tearingDown) {
      return;
    }
    this.patch({ leavePrompt: false });
    playCallEnded();
    showToast("toast.callEnded");
    this.broadcast({ type: "room-ended" });
    this.resetCall();
  }

  transferHostAndLeave() {
    if (!this.state.isHost || this.tearingDown) {
      return;
    }
    const successor = electHost(
      this.state.remotes.map((remote) => remote.peerId),
    );
    if (!successor) {
      this.endRoomForAll();
      return;
    }
    const name = this.names.get(successor) ?? t("common.someone");
    this.patch({ leavePrompt: false });
    this.broadcast({ type: "host-transfer", hostPeerId: successor });
    this.broadcast({
      type: "hangup",
      displayName: this.state.identity?.displayName,
    });
    playCallEnded();
    showToast("toast.hostHandedOver", { name });
    this.resetCall();
  }

  /** Só o que o broker pode ver: nunca o secret da sala. */
  signalMeta(extra?: Record<string, string>) {
    const me = this.state.identity;
    return {
      displayName: clampDisplayName(me?.displayName ?? t("common.someone")),
      peerId: me?.peerId ?? "",
      ...extra,
    };
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
      pending: [],
      leavePrompt: false,
      localMutes: {},
      roomMutes: {},
    });
  }

  private openData(peerId: string, first?: WireMessage) {
    if (!this.peer || this.data.has(peerId)) {
      return;
    }
    const conn = this.peer.connect(peerId, {
      reliable: true,
      metadata: this.signalMeta(),
    });
    this.attachData(conn, true, first);
  }

  private openMedia(peerId: string) {
    if (!this.peer || this.calls.has(peerId)) {
      return;
    }
    const call = this.peer.call(peerId, this.media.outboundStream(), {
      metadata: this.signalMeta({ kind: "camera" }),
    });
    this.attachMedia(call);
    if (this.state.sharingScreen) {
      this.media.openScreen(peerId);
    }
  }

  private attachData(
    conn: DataConnection,
    outgoing: boolean,
    first?: WireMessage,
  ) {
    this.data.set(conn.peer, conn);
    const watchDataIce = () => {
      if (conn.peerConnection) {
        this.watchIce(conn.peer, conn.peerConnection);
      }
    };
    watchDataIce();
    conn.on("iceStateChanged", watchDataIce);
    conn.on("open", () => {
      watchDataIce();
      this.iceEverConnected.add(conn.peer);
      if (outgoing && first) {
        void conn.send(first);
      } else if (outgoing && this.state.callMode) {
        void conn.send({
          type: "hello",
          ...this.room.helloPayload(),
          kind: "room-join",
        });
      }
      if (this.state.sharingScreen) {
        void conn.send({ type: "media-meta", sharingScreen: true });
      }
      void conn.send({ type: "media-meta", cameraOff: this.state.cameraOff });
      this.room.offerExistingHost(conn);
    });
    conn.on("data", (raw) => {
      if (this.files.onFileBytes(conn, raw)) {
        return;
      }
      this.onWire(conn, raw);
    });
    conn.on("close", () => this.onPeerLeft(conn.peer));
    conn.on("error", () => {
      if (!conn.open && this.state.callStatus === "connecting") {
        this.failPath(conn.peer);
        return;
      }
      this.onPeerLeft(conn.peer);
    });
  }

  private attachMedia(call: MediaConnection) {
    this.calls.set(call.peer, call);
    // `redialPeer` fecha a chamada antiga de propósito: o fim dela não é saída.
    const leftIfCurrent = () => {
      if (this.calls.get(call.peer) === call) {
        this.onPeerLeft(call.peer);
      }
    };
    call.on("stream", (stream) => {
      if (call.peerConnection) {
        this.watchIce(call.peer, call.peerConnection);
      }
      this.upsertRemote(call.peer, {
        stream,
        ...(stream.getVideoTracks().length === 0 ? { cameraOff: true } : {}),
      });
      const onRemoteEnded = () => {
        if (stream.getTracks().some((track) => track.readyState === "live")) {
          return;
        }
        leftIfCurrent();
      };
      for (const track of stream.getTracks()) {
        track.addEventListener("ended", onRemoteEnded);
      }
      if (this.state.callStatus !== "in-call") {
        this.patch({ callStatus: "in-call" });
      }
      window.setTimeout(() => this.media.applyLimitsToAll(), 400);
    });
    call.on("close", leftIfCurrent);
    call.on("error", leftIfCurrent);
  }

  private async onIncomingCall(call: MediaConnection) {
    // Metadata vem do outro peer: campos `unknown` até serem checados.
    const meta: { displayName?: unknown; kind?: unknown } | undefined =
      typeof call.metadata === "object" && call.metadata !== null
        ? call.metadata
        : undefined;
    const metaName = this.nameFromMeta(meta?.displayName, call.peer);
    if (meta?.kind === "screen") {
      if (
        this.state.callStatus === "idle" ||
        this.room.banned.has(call.peer) ||
        this.room.notAdmitted(call.peer)
      ) {
        call.close();
        return;
      }
      call.answer();
      this.media.attachIncomingScreen(call);
      this.names.set(call.peer, metaName);
      this.upsertRemote(call.peer, {
        displayName: metaName,
        sharingScreen: true,
      });
      this.media.rememberShare(call.peer);
      return;
    }

    if (this.state.callStatus !== "idle") {
      if (this.room.banned.has(call.peer)) {
        call.close();
        return;
      }
      if (this.room.shouldRefusePeer(call.peer)) {
        this.room.refuseJoin(call.peer);
        call.close();
        return;
      }
      if (this.room.notAdmitted(call.peer)) {
        // Host: sala de espera até admit/deny. Guest: `room-peers` pode atrasar
        // em relação à mídia do mesh — segura sem atender; fechar aqui faria o
        // dialer cair em onPeerLeft/forget e os convidados nunca se veriam.
        this.attachMedia(call);
        if (!this.state.isHost) {
          this.scheduleUnadmittedHold(call.peer);
        }
        return;
      }
      this.attachMedia(call);
      call.answer(this.media.outboundStream());
      if (this.state.sharingScreen) {
        this.media.openScreen(call.peer);
      }
      return;
    }
    this.calls.set(call.peer, call);
    this.attachMedia(call);
    this.patch({
      incoming: {
        peerId: call.peer,
        displayName: metaName,
      },
    });
  }

  private nameFromMeta(raw: unknown, peerId: string) {
    const clamped = typeof raw === "string" ? clampDisplayName(raw.trim()) : "";
    return clamped || this.names.get(peerId) || t("common.someone");
  }

  private onWire(conn: DataConnection, raw: unknown) {
    const msg = parseWire(raw);
    if (!msg) {
      return;
    }

    // `conn.peer` é a única identidade que o broker garante. Tudo que o payload
    // afirma sobre quem enviou é ignorado.
    const from = conn.peer;

    // Quem está na sala de espera só pode se apresentar. Nada do que mande
    // além disso conta enquanto o host não decidir.
    if (msg.type !== "hello" && this.room.notAdmitted(from)) {
      return;
    }

    if (msg.type === "hello") {
      this.room.onHello(conn, msg);
      return;
    }

    if (msg.type === "room-host") {
      if (!this.room.isRoomAuthority(from)) {
        return;
      }
      this.room.becomeGuest(msg.hostPeerId);
      return;
    }

    if (msg.type === "room-peers") {
      if (!this.room.isRoomAuthority(from)) {
        return;
      }
      this.room.onRoomPeers(from, msg);
      return;
    }

    if (msg.type === "chat") {
      if (!this.inRoom()) {
        return;
      }
      this.chat.receive(from, msg);
      return;
    }

    if (msg.type === "poll-vote") {
      if (!this.inRoom()) {
        return;
      }
      this.chat.applyPollVote(msg.id, from, msg.option);
      return;
    }

    if (msg.type === "timer-control") {
      if (!this.inRoom()) {
        return;
      }
      this.chat.applyTimerControl(msg.id, from, null, Date.now(), msg.timer);
      return;
    }

    if (msg.type === "file-start") {
      if (!this.inRoom()) {
        return;
      }
      this.files.beginIncomingFile(from, msg);
      return;
    }

    if (msg.type === "file-end") {
      this.files.finishIncomingFile(from, msg.id);
      return;
    }

    if (msg.type === "hangup") {
      this.onPeerLeft(from);
      return;
    }

    if (msg.type === "room-ended") {
      if (!this.room.isRoomAuthority(from)) {
        return;
      }
      this.resetCall("toast.roomEndedByHost");
      return;
    }

    if (msg.type === "room-full") {
      if (!this.room.isRoomAuthority(from)) {
        return;
      }
      this.resetCall("toast.roomFull");
      return;
    }

    if (msg.type === "room-waiting") {
      if (!this.room.isRoomAuthority(from)) {
        return;
      }
      if (this.state.callStatus === "connecting") {
        this.patch({ callStatus: "waiting" });
      }
      return;
    }

    if (msg.type === "room-denied") {
      if (!this.room.isRoomAuthority(from)) {
        return;
      }
      this.resetCall(
        msg.reason === "stale" ? "toast.inviteStale" : "toast.joinDenied",
      );
      return;
    }

    if (msg.type === "room-kicked") {
      if (!this.room.isRoomAuthority(from)) {
        return;
      }
      this.resetCall("toast.kicked");
      return;
    }

    if (msg.type === "host-transfer") {
      if (!this.room.isRoomAuthority(from)) {
        return;
      }
      this.room.forget(from);
      this.room.assumeHost(
        msg.hostPeerId,
        "toast.hostLeftYouHost",
        "toast.hostLeftNewHost",
      );
      return;
    }

    if (msg.type === "room-mute") {
      if (!this.room.isRoomAuthority(from)) {
        return;
      }
      this.room.applyRoomMute(
        msg.peerId,
        {
          ...(msg.audio !== undefined ? { audio: msg.audio } : {}),
          ...(msg.video !== undefined ? { video: msg.video } : {}),
        },
        true,
      );
      return;
    }

    if (msg.type === "media-meta") {
      this.media.onMediaMeta(from, msg);
    }
  }

  /** Já dentro da sala, e não parado na porta nem fora de chamada. */
  inRoom() {
    const status = this.state.callStatus;
    return status === "connecting" || status === "in-call";
  }

  maybeConnect(peerId: string) {
    const me = this.state.identity?.peerId;
    if (!me || peerId === me || this.data.has(peerId)) {
      return;
    }
    if (me < peerId) {
      this.openData(peerId);
    }
  }

  maybeCall(peerId: string) {
    const me = this.state.identity?.peerId;
    if (!me || peerId === me) {
      return;
    }
    if (!this.calls.has(peerId) && me < peerId) {
      this.openMedia(peerId);
    } else if (this.state.sharingScreen) {
      this.media.openScreen(peerId);
    }
  }

  /** Atende mídia que chegou antes da admissão / `room-peers`. */
  answerQueuedMedia(peerId: string) {
    this.clearUnadmittedHold(peerId);
    const queued = this.calls.get(peerId);
    if (!queued || queued.open) {
      return;
    }
    queued.answer(this.media.outboundStream());
    if (this.state.sharingScreen) {
      this.media.openScreen(peerId);
    }
  }

  private scheduleUnadmittedHold(peerId: string) {
    this.clearUnadmittedHold(peerId);
    const timer = window.setTimeout(() => {
      this.unadmittedHoldTimers.delete(peerId);
      if (!this.room.notAdmitted(peerId)) {
        return;
      }
      const call = this.calls.get(peerId);
      if (call && !call.open) {
        call.close();
      }
    }, HOLD_UNADMITTED_MS);
    this.unadmittedHoldTimers.set(peerId, timer);
  }

  private clearUnadmittedHold(peerId: string) {
    const timer = this.unadmittedHoldTimers.get(peerId);
    if (timer) {
      window.clearTimeout(timer);
      this.unadmittedHoldTimers.delete(peerId);
    }
  }

  upsertRemote(peerId: string, patch: Partial<RemotePeer>) {
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
    if (
      current &&
      current.displayName === next.displayName &&
      current.stream === next.stream &&
      current.screenStream === next.screenStream &&
      current.sharingScreen === next.sharingScreen &&
      current.cameraOff === next.cameraOff
    ) {
      return;
    }
    const remotes = current
      ? this.state.remotes.map((r) => (r.peerId === peerId ? next : r))
      : [...this.state.remotes.filter((r) => r.peerId !== peerId), next];
    this.patch({ remotes });
    if (!current) {
      this.media.applyLimitsToAll();
    }
  }

  onPeerLeft(peerId: string, opts?: { silent?: boolean }) {
    if (this.tearingDown) {
      return;
    }
    if (this.departing.has(peerId)) {
      return;
    }
    this.departing.add(peerId);
    try {
      this.finishPeerLeft(peerId, opts);
    } finally {
      this.departing.delete(peerId);
    }
  }

  private finishPeerLeft(peerId: string, opts?: { silent?: boolean }) {
    const wasInCall = this.state.remotes.some((r) => r.peerId === peerId);
    this.clearUnadmittedHold(peerId);
    this.iceRetries.delete(peerId);
    this.iceEverConnected.delete(peerId);
    const name =
      this.state.remotes.find((r) => r.peerId === peerId)?.displayName ??
      this.names.get(peerId) ??
      t("common.someone");
    const hostGone =
      peerId === this.state.hostPeerId && this.state.callStatus !== "idle";
    this.data.get(peerId)?.close();
    this.calls.get(peerId)?.close();
    this.media.forget(peerId);
    this.data.delete(peerId);
    this.calls.delete(peerId);
    this.files.forget(peerId);
    this.chat.forget(peerId);
    const remotes = this.state.remotes.filter((r) => r.peerId !== peerId);
    this.room.forget(peerId);
    this.patch({
      remotes,
      screenShareOrder: this.media.removeShare(peerId),
      pending: this.state.pending.filter((p) => p.peerId !== peerId),
      incoming:
        this.state.incoming?.peerId === peerId ? null : this.state.incoming,
      localMutes: dropMute(this.state.localMutes, peerId),
      roomMutes: dropMute(this.state.roomMutes, peerId),
    });
    this.media.applyLimitsToAll();
    if (this.state.isHost) {
      this.room.broadcastRoom();
    } else if (hostGone) {
      if (wasInCall) {
        this.chat.appendLeaveNotice(peerId, name);
      }
      this.room.handleHostGone(peerId);
      return;
    }
    if (
      wasInCall &&
      !hostGone &&
      !opts?.silent &&
      (this.state.callStatus === "in-call" ||
        this.state.callStatus === "connecting")
    ) {
      showToast(
        this.room.removed.delete(peerId) ? "toast.removed" : "toast.peerLeft",
        {
          name,
        },
      );
      this.chat.appendLeaveNotice(peerId, name);
    }
  }

  /**
   * Conexões que já valem como sala. Quem está na porta tem data channel
   * aberto para poder ser avisado, mas não entra em nada que seja conversa.
   */
  activeConnections() {
    const open: DataConnection[] = [];
    for (const [peerId, conn] of this.data) {
      if (conn.open && !this.room.notAdmitted(peerId)) {
        open.push(conn);
      }
    }
    return open;
  }

  broadcast(message: WireMessage) {
    for (const conn of this.activeConnections()) {
      void conn.send(message);
    }
  }

  /**
   * O desligamento é síncrono do início ao fim: `tearingDown` vale só enquanto
   * este método roda, então nenhum evento consegue se intercalar e ser
   * descartado por engano. As data connections são as únicas que esperam, o
   * bastante para o último aviso escoar pelo canal antes do fechamento.
   */
  resetCall(endedReason?: MessageKey) {
    if (this.tearingDown) {
      return;
    }
    this.tearingDown = true;
    const draining = [...this.data.values()];
    window.setTimeout(() => {
      for (const conn of draining) {
        // O `close` chegaria com a sessão já zerada e seria tratado como saída.
        conn.removeAllListeners();
        conn.close();
      }
    }, FLUSH_MS);
    for (const call of this.calls.values()) {
      call.close();
    }
    this.media.closeScreens();
    this.data.clear();
    this.calls.clear();
    this.files.reset();
    this.chat.reset();
    this.room.reset();
    this.media.reset();
    this.names.clear();
    if (endedReason) {
      playCallEnded();
      showToast(
        endedReason,
        undefined,
        endedReason === "toast.networkPath" ? 8000 : 4500,
      );
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
      canSwitchCamera: false,
      localMutes: {},
      roomMutes: {},
      callMode: null,
      isHost: false,
      hostPeerId: null,
      callStatus: "idle",
      incoming: null,
      // De volta à home, o convite exibido volta a ser o da nossa própria sala.
      roomSecret: this.room.hostSecret,
      pending: [],
      leavePrompt: false,
      pathHint: false,
      members: [],
    });
    this.iceRetries.clear();
    this.iceEverConnected.clear();
    this.departing.clear();
    this.clearConnectWatch();
    this.tearingDown = false;
    clearInviteLocation();
  }

  private destroyPeer() {
    window.clearTimeout(this.reconnectTimer);
    this.media.unwatchDevices();
    this.peer?.destroy();
    this.peer = null;
  }
}

export const session = new PeerSession();
