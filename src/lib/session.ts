import type { DataConnection, MediaConnection, Peer } from "peerjs";
import { loadRoomSecret, rotateRoomSecret } from "./identity";
import { clearInviteLocation, parseInvite } from "./invite";
import {
  applySenderLimits,
  applyTrackConstraints,
  getCameraConstraints,
  getDisplayConstraints,
  maxFileBytes,
  maxParticipants,
} from "./quality";
import type { MessageKey } from "@i18n/locales";
import { t } from "@i18n/i18n";
import { playCallEnded } from "./sounds";
import { showToast } from "./toast";
import {
  CHAT_COOLDOWN_MS,
  cooledDown,
  MAX_TIMER_ALARMS,
  MENTION_TOAST_COOLDOWN_MS,
  safeFileName,
} from "./chat";
import {
  applyTimerAction,
  canControlTimer,
  hasActiveTimer,
  initialTimerState,
  resolveTimerState,
  stampTimerActor,
  type TimerAction,
  type TimerState,
} from "./timer";
import {
  formatCommandText,
  mentionsForCommand,
  runChatCommand,
} from "./commands";
import { ALL_MENTION, isPinged, resolveMentions } from "./mentions";
import { FILE_CHUNK } from "./file-assembly";
import {
  clearAllFileProgress,
  clearFileProgress,
  setFileProgress,
} from "./file-progress";
import { FileBridge } from "./file-transfer";
import { CONNECT_GIVE_UP_MS, CONNECT_HINT_MS, iceGaveUpKind } from "./ice-path";
import { acquireLocalMedia, mediaStreamOf, nextVideoDeviceId } from "./media-access";
import {
  dropMute,
  muteOf,
  roomMutesFromWire,
  roomMutesToWire,
  setMuteFlag,
  type MuteKind,
  type MuteMap,
} from "./mutes";
import { clampChatText, clampDisplayName, parseWire } from "./wire-guard";
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

const FILE_BUFFER_HIGH = 2_000_000;
const MAX_MESSAGES = 500;
const MAX_CONCURRENT_INCOMING = 3;
const FILE_START_COOLDOWN = 2000;
const FILE_SEND_CONCURRENCY = 3;
const FLUSH_MS = 80;
const MAX_ICE_RETRIES = 2;
const ICE_RECOVERY_MS = 4000;
const RECONNECT_MAX_MS = 30_000;

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

/**
 * Sucessor determinístico: o menor peerId entre os candidatos. Como todos
 * partem da mesma lista de membros, que veio do host, cada peer chega sozinho
 * ao mesmo nome — sem negociação e sem risco de dois hosts ao mesmo tempo.
 */
export const electHost = (candidates: string[]) => {
  return candidates.length > 0 ? candidates.toSorted()[0] : null;
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
  private peer: Peer | null = null;
  private data = new Map<string, DataConnection>();
  private media = new Map<string, MediaConnection>();
  private screenOut = new Map<string, MediaConnection>();
  private screenIn = new Map<string, MediaConnection>();
  private names = new Map<string, string>();
  private roomMembers: PeerInfo[] = [];
  /** Removidos pelo host: não voltam com o mesmo link enquanto a sala existir. */
  private banned = new Set<string>();
  /** Saídas provocadas por remoção, para o aviso não dizer que a pessoa saiu. */
  private removed = new Set<string>();
  private screenTrack: MediaStreamTrack | null = null;
  /** Última câmera escolhida: religar não volta para a padrão. */
  private cameraDeviceId: string | null = null;
  private switchingCamera = false;
  private dialedPeerId: string | null = null;
  /** Nosso segredo quando somos host. Gira a cada recusa ou remoção. */
  private hostSecret: string | null = null;
  /** Segredo que apresentamos ao entrar na sala de outra pessoa. */
  private joinSecret: string | null = null;
  private iceRetries = new Map<string, number>();
  private iceEverConnected = new Set<string>();
  private iceWatched = new WeakSet<RTCPeerConnection>();
  private connectHintTimer = 0;
  private connectGiveUpTimer = 0;
  private reconnectAttempts = 0;
  private reconnectTimer = 0;
  private starting = false;
  private tearingDown = false;
  private sendingFile = false;
  private files = new FileBridge();
  private incomingFiles = new Map<
    string,
    {
      remoteId: string;
      localId: string;
      name: string;
      mime: string;
      size: number;
    }
  >();
  private incomingByteTail = new Map<string, Promise<void>>();
  private lastFileStart = new Map<string, number>();
  private lastChatAt = new Map<string, number>();
  private lastMentionToastAt = 0;
  private timerAlarms = new Map<string, number>();
  /** Evita toast/aviso duplicados quando `close()` reentra em `onPeerLeft`. */
  private departing = new Set<string>();

  subscribe = (listener: Listener) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getState = () => this.state;

  private patch(partial: Partial<SessionState>) {
    let changed = false;
    for (const key of Object.keys(partial) as (keyof SessionState)[]) {
      if (!Object.is(this.state[key], partial[key])) {
        changed = true;
        break;
      }
    }
    if (!changed) return;
    this.state = { ...this.state, ...partial };
    if (partial.callStatus && partial.callStatus !== "connecting") {
      this.clearConnectWatch();
    }
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
    this.hostSecret = loadRoomSecret();
    this.patch({
      identity,
      peerReady: false,
      peerError: null,
      roomSecret: this.hostSecret,
    });

    const { Peer } = await import("peerjs");
    const peer = new Peer(identity.peerId, {
      config: { iceServers: iceServers() },
      debug: 0,
    });
    this.peer = peer;
    this.watchDevices();

    peer.on("open", () => {
      this.starting = false;
      this.reconnectAttempts = 0;
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
      if (type === "webrtc" && this.state.callStatus === "connecting") {
        this.failPath();
        return;
      }
      this.patch({ peerError: "error.peerjs" });
    });

    peer.on("disconnected", () => {
      if (peer.destroyed) return;
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
    if (this.state.callStatus !== "idle" && view !== "call") return;
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
      if (peer.destroyed || peer.open) return;
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
    if (this.iceWatched.has(pc)) return;
    this.iceWatched.add(pc);
    const onState = () => {
      const ice = pc.iceConnectionState;
      const conn = pc.connectionState;
      if (ice === "connected" || ice === "completed" || conn === "connected") {
        this.iceRetries.delete(peerId);
        this.iceEverConnected.add(peerId);
        if (this.state.pathHint) this.patch({ pathHint: false });
        return;
      }
      if (ice !== "failed" && conn !== "failed") return;

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
        )
          return;
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
    if (!peerId) return;
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
      if (this.state.callStatus !== "connecting") return;
      this.patch({ pathHint: true });
    }, CONNECT_HINT_MS);
    this.connectGiveUpTimer = window.setTimeout(() => {
      if (this.state.callStatus !== "connecting") return;
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
    if (!me || this.state.callStatus === "idle" || this.tearingDown) return;
    this.media.get(peerId)?.close();
    this.media.delete(peerId);
    // Só o lado de ID menor disca, igual ao caminho normal, para evitar glare.
    if (me < peerId) this.openMedia(peerId);
  }

  async createRoom() {
    try {
      await this.ensureLocalStream();
    } catch {
      this.patch({
        localStream: this.state.localStream ?? mediaStreamOf([]),
        cameraOff: true,
        muted: true,
      });
    }
    const me = this.selfInfo();
    this.roomMembers = me ? [me] : [];
    this.joinSecret = null;
    // Sala nova ⇒ link novo: quem tinha o convite antigo não bate na porta.
    this.hostSecret = rotateRoomSecret();
    this.beginCall(true, me?.peerId ?? "");
    this.patch({ callStatus: "in-call", roomSecret: this.hostSecret });
  }

  async joinRoom(hostId: string) {
    const invite = parseInvite(hostId);
    const id = invite?.peerId ?? "";
    if (!id || !this.peer || id === this.state.identity?.peerId) return;
    if (this.state.callStatus !== "idle") return;
    try {
      await this.ensureLocalStream();
    } catch {
      this.patch({
        localStream: this.state.localStream ?? mediaStreamOf([]),
        cameraOff: true,
        muted: true,
      });
    }
    this.joinSecret = invite?.secret ?? null;
    this.dialedPeerId = id;
    this.beginCall(false, id);
    this.openData(id, {
      type: "hello",
      ...this.helloPayload(),
      kind: "room-join",
    });
    this.patch({ callStatus: "connecting", roomSecret: this.joinSecret });
    this.armConnectWatch();
  }

  async acceptIncoming() {
    const incoming = this.state.incoming;
    if (!incoming) return;
    try {
      await this.ensureLocalStream();
    } catch {
      this.patch({
        localStream: this.state.localStream ?? mediaStreamOf([]),
        cameraOff: true,
        muted: true,
      });
    }
    this.dialedPeerId = incoming.peerId;
    this.beginCall(false, incoming.peerId);
    const queued = this.media.get(incoming.peerId);
    if (queued) queued.answer(this.outboundStream());
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

  admitPeer(peerId: string) {
    if (!this.state.isHost) return;
    const info = this.state.pending.find((p) => p.peerId === peerId);
    if (!info) return;
    this.patch({
      pending: this.state.pending.filter((p) => p.peerId !== peerId),
    });
    if (this.isRoomFull()) {
      this.refuseJoin(peerId);
      return;
    }
    this.names.set(peerId, info.displayName);
    this.upsertRemote(peerId, { displayName: info.displayName });
    this.addRoomMember(info);
    // A chamada de mídia dele já chegou e ficou parada esperando esta decisão.
    const queued = this.media.get(peerId);
    if (queued) queued.answer(this.outboundStream());
    const conn = this.data.get(peerId);
    if (conn) this.offerExistingHost(conn);
    this.broadcastRoom();
    this.maybeCall(peerId);
  }

  denyPeer(peerId: string) {
    if (!this.state.isHost) return;
    if (!this.state.pending.some((p) => p.peerId === peerId)) return;
    this.patch({
      pending: this.state.pending.filter((p) => p.peerId !== peerId),
    });
    this.banned.add(peerId);
    this.sendAndDrop(peerId, { type: "room-denied" });
    this.rotateSecret();
    this.broadcastRoom();
  }

  kickPeer = (peerId: string) => {
    if (!this.state.isHost || peerId === this.state.identity?.peerId) return;
    if (!this.state.remotes.some((remote) => remote.peerId === peerId)) return;
    this.banned.add(peerId);
    this.removed.add(peerId);
    this.roomMembers = this.roomMembers.filter((p) => p.peerId !== peerId);
    const conn = this.data.get(peerId);
    if (conn?.open) conn.send({ type: "room-kicked" });
    // Quem saiu já está fora de `roomMembers`, então `activeConnections` o
    // exclui daqui em diante: ele não recebe o segredo novo e o link que tem
    // morre aqui. Os que ficaram são avisados na hora, não no timer abaixo.
    this.rotateSecret();
    this.broadcastRoom();
    // Deixa o aviso escoar antes de derrubar o canal por baixo dele.
    window.setTimeout(() => this.onPeerLeft(peerId), FLUSH_MS);
  };

  hangUp() {
    if (this.tearingDown) return;
    if (this.state.callStatus === "idle" && this.state.view !== "call") return;
    // Sair como host apaga a sala de todo mundo, então a decisão é dele: passar
    // o bastão ou encerrar. Sozinho não há o que decidir.
    if (this.state.isHost && this.state.remotes.length > 0) {
      this.patch({ leavePrompt: true });
      return;
    }
    playCallEnded();
    const hostLeaving = this.state.isHost;
    showToast(hostLeaving ? "toast.callEnded" : "toast.leftCall");
    if (hostLeaving) this.broadcast({ type: "room-ended" });
    else
      this.broadcast({
        type: "hangup",
        displayName: this.state.identity?.displayName,
      });
    this.resetCall();
  }

  cancelLeave() {
    if (this.state.leavePrompt) this.patch({ leavePrompt: false });
  }

  endRoomForAll() {
    if (!this.state.isHost || this.tearingDown) return;
    this.patch({ leavePrompt: false });
    playCallEnded();
    showToast("toast.callEnded");
    this.broadcast({ type: "room-ended" });
    this.resetCall();
  }

  transferHostAndLeave() {
    if (!this.state.isHost || this.tearingDown) return;
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

  sendChat(text: string) {
    const trimmed = clampChatText(text.trim());
    const me = this.state.identity;
    if (!trimmed || !me || !this.inRoom()) return false;
    const command = runChatCommand(trimmed, this.roomMembers);
    if (command) {
      if (!command.ok) {
        showToast(command.error);
        return false;
      }
      if (command.command.kind === "timer") {
        if (hasActiveTimer(this.state.messages, Date.now())) {
          showToast("chat.command.timerBusy");
          return false;
        }
      }
      const mentions = mentionsForCommand(command.command);
      if (command.command.kind === "emote") {
        for (const id of resolveMentions(command.command.action, this.roomMembers)) {
          if (!mentions.includes(id)) mentions.push(id);
        }
      }
      // /me e /moeda mostram @nome — precisa estar em mentions pra pintar.
      if (
        (command.command.kind === "emote" || command.command.kind === "coin") &&
        !mentions.includes(me.peerId)
      ) {
        mentions.push(me.peerId);
      }
      const at = Date.now();
      const message: ChatMessage = {
        id: crypto.randomUUID(),
        fromPeerId: me.peerId,
        fromName: me.displayName,
        text: formatCommandText(command.command, t, me.displayName),
        at,
        command: command.command,
        ...(command.command.kind === "timer"
          ? { timer: initialTimerState(command.command.ms, at) }
          : {}),
        ...(mentions.length ? { mentions } : {}),
      };
      this.appendMessage(message);
      if (command.command.kind !== "help") {
        const { timer: _timer, ...chat } = message;
        this.broadcast({ type: "chat", ...chat });
      }
      return true;
    }
    const mentions = resolveMentions(trimmed, this.roomMembers);
    const message: ChatMessage = {
      id: crypto.randomUUID(),
      fromPeerId: me.peerId,
      fromName: me.displayName,
      text: trimmed,
      at: Date.now(),
      ...(mentions.length ? { mentions } : {}),
    };
    this.appendMessage(message);
    this.broadcast({ type: "chat", ...message });
    return true;
  }

  votePoll(pollId: string, option: number) {
    const me = this.state.identity;
    if (!me || !this.inRoom()) return;
    if (!this.applyPollVote(pollId, me.peerId, option)) return;
    this.broadcast({ type: "poll-vote", id: pollId, option });
  }

  controlTimer(messageId: string, action: TimerAction) {
    const me = this.state.identity;
    if (!me || !this.inRoom()) return;
    const next = this.applyTimerControl(messageId, me.peerId, action, Date.now());
    if (!next) return;
    this.broadcast({ type: "timer-control", id: messageId, timer: next });
  }

  async sendFile(file: File) {
    const me = this.state.identity;
    if (!me || !this.inRoom() || this.tearingDown) return;
    if (this.sendingFile) {
      this.toast("toast.fileBusy");
      return;
    }
    const max = maxFileBytes();
    if (file.size <= 0 || file.size > max) {
      showToast("toast.fileTooBig", {
        max: Math.round(max / (1024 * 1024)),
      });
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
        blobUrl,
      },
    };
    this.appendMessage(message);
    this.sendingFile = true;
    try {
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
      const peers = this.activeConnections();
      if (peers.length === 0) {
        setFileProgress(id, 1);
        this.patchFile(id, { status: "ready" });
        return;
      }
      for (const conn of peers) conn.send(start);
      await this.files.openSend(id, file);

      // Cada peer avança no seu próprio ritmo: um destinatário congestionado
      // atrasa só a própria cópia, e o progresso mostrado é o do mais lento.
      const sent = new Map<DataConnection, number>();
      const report = () => {
        let slowest = file.size;
        for (const conn of peers)
          slowest = Math.min(slowest, sent.get(conn) ?? 0);
        setFileProgress(id, Math.min(1, slowest / file.size));
      };

      const results = await this.mapLimited(
        peers,
        FILE_SEND_CONCURRENCY,
        (conn) => this.streamFileTo(conn, id, file.size, sent, report),
      );
      const ok = results.filter(Boolean).length;
      if (ok === 0) {
        this.patchFile(id, { status: "error" });
        this.toast("toast.fileFailed");
        return;
      }
      setFileProgress(id, 1);
      this.patchFile(id, { status: "ready" });
      if (ok < peers.length) this.toast("toast.filePartial");
    } catch {
      this.patchFile(id, { status: "error" });
      this.toast("toast.fileFailed");
    } finally {
      this.sendingFile = false;
      void this.files.closeSend(id);
    }
  }

  async toggleMute() {
    const next = !this.state.muted;
    if (!next && this.selfLocked("audio")) return;
    const live =
      this.state.localStream
        ?.getAudioTracks()
        .filter((track) => track.readyState === "live") ?? [];
    if (!next && live.length === 0) {
      await this.enableMic();
      return;
    }
    live.forEach((track) => {
      track.enabled = !next;
    });
    this.patch({ muted: next });
  }

  async toggleCamera() {
    if (this.state.cameraOff) await this.enableCamera();
    else this.disableCamera();
  }

  async switchCamera() {
    if (
      this.switchingCamera ||
      this.state.cameraOff ||
      this.selfLocked("video")
    )
      return;
    const md = navigator.mediaDevices;
    if (!md?.getUserMedia) return;
    let devices: MediaDeviceInfo[] = [];
    try {
      devices = (await md.enumerateDevices?.()) ?? [];
    } catch {
      return;
    }
    const cams = devices.filter((d) => d.kind === "videoinput");
    if (cams.length < 2) return;
    const current = this.state.localStream?.getVideoTracks()[0];
    const currentId = current?.getSettings?.().deviceId;
    const nextId = nextVideoDeviceId(cams, currentId);
    const facing = current?.getSettings?.().facingMode;
    const video: MediaTrackConstraints = {
      ...this.cameraVideoBase(),
      ...(nextId
        ? { deviceId: { exact: nextId } }
        : {
            facingMode: {
              exact: facing === "environment" ? "user" : "environment",
            },
          }),
    };
    this.switchingCamera = true;
    try {
      const fresh = await md.getUserMedia({ audio: false, video });
      const track = fresh.getVideoTracks()[0];
      if (!track) return;
      this.cameraDeviceId = track.getSettings?.().deviceId || nextId || null;
      await this.replaceCameraTrack(track);
    } catch {
      this.toast("toast.mediaSwitchCamera");
    } finally {
      this.switchingCamera = false;
    }
  }

  /** Silencia o áudio ou o vídeo de outra pessoa só neste cliente. */
  toggleLocalMute = (peerId: string, kind: MuteKind) => {
    if (!this.inRoom() || !this.canControlMute(peerId)) return;
    if (muteOf(this.state.roomMutes, peerId)[kind] && !this.state.isHost)
      return;
    const next = !muteOf(this.state.localMutes, peerId)[kind];
    this.patch({
      localMutes: setMuteFlag(this.state.localMutes, peerId, kind, next),
    });
  };

  /** Host: pede silêncio de áudio/vídeo na sala.
   * Viewers já aplicam `roomMutes` na tile (não tocam o stream). O alvo é
   * pedido a cortar as tracks via `enforceSelfLocks` — cliente modificado
   * pode ignorar e continuar enviando (só gasta banda). Em P2P puro não há
   * corte no remetente. */
  setRoomMute = (peerId: string, kind: MuteKind, muted: boolean) => {
    if (!this.state.isHost || !this.inRoom() || !this.canControlMute(peerId))
      return;
    this.applyRoomMute(peerId, { [kind]: muted }, false);
    this.broadcast({ type: "room-mute", peerId, [kind]: muted });
  };

  async shareScreen() {
    if (this.state.sharingScreen) {
      await this.stopScreenShare();
      return;
    }
    let display: MediaStream;
    try {
      display = await navigator.mediaDevices.getDisplayMedia(
        getDisplayConstraints(),
      );
    } catch {
      return;
    }
    const track = display.getVideoTracks()[0];
    if (!track) return;
    this.screenTrack = track;
    const screenStream = new MediaStream([track]);
    await applyTrackConstraints(screenStream, "screen");
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
    if (stream) await applyTrackConstraints(stream, "camera");
    if (this.screenTrack) {
      await applyTrackConstraints(new MediaStream([this.screenTrack]), "screen");
    }
    this.applyLimitsToAll();
  }

  /** Só o que o broker pode ver: nunca o secret da sala. */
  private signalMeta(extra?: Record<string, string>) {
    const me = this.state.identity;
    return {
      displayName: clampDisplayName(me?.displayName ?? t("common.someone")),
      peerId: me?.peerId ?? "",
      ...extra,
    };
  }

  private helloPayload() {
    return {
      ...this.signalMeta(),
      ...(this.joinSecret ? { secret: this.joinSecret } : {}),
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
      pending: [],
      leavePrompt: false,
      localMutes: {},
      roomMutes: {},
    });
  }

  private async ensureLocalStream() {
    if (this.state.localStream) return this.state.localStream;
    const gum = navigator.mediaDevices?.getUserMedia?.bind(
      navigator.mediaDevices,
    );
    const media = await acquireLocalMedia(gum, getCameraConstraints());
    await applyTrackConstraints(media.stream, "camera");
    if (!media.muted) {
      media.stream.getAudioTracks().forEach((track) => {
        track.enabled = !this.state.muted;
      });
    }
    const cameraOff = media.cameraOff || this.state.cameraOff;
    const muted = media.muted || this.state.muted;
    this.patch({ localStream: media.stream, cameraOff, muted });
    this.rememberCamera(media.stream);
    void this.refreshCameraSwitch();
    if (media.fallback === "audio") this.toast("toast.mediaAudioOnly");
    else if (media.fallback === "video") this.toast("toast.mediaVideoOnly");
    else if (media.fallback === "listen") this.toast("toast.mediaListenOnly");
    return media.stream;
  }

  private disableCamera() {
    this.syncOutgoingTrack("video", null);
    const audio = this.state.localStream?.getAudioTracks() ?? [];
    this.state.localStream?.getVideoTracks().forEach((track) => track.stop());
    this.patch({ cameraOff: true, localStream: mediaStreamOf(audio) });
    this.broadcast({ type: "media-meta", cameraOff: true });
  }

  private async enableCamera() {
    if (this.selfLocked("video")) return;
    let fresh: MediaStream;
    try {
      fresh = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: this.cameraVideoRequest(),
      });
    } catch {
      this.toast("toast.mediaCamera");
      return;
    }
    const video = fresh.getVideoTracks()[0];
    if (!video) return;
    this.rememberCamera(fresh);
    await this.replaceCameraTrack(video);
  }

  private cameraVideoBase(): MediaTrackConstraints {
    const video = getCameraConstraints().video;
    return typeof video === "object" && video ? { ...video } : {};
  }

  private cameraVideoRequest(): MediaTrackConstraints {
    const video = this.cameraVideoBase();
    if (this.cameraDeviceId) video.deviceId = { ideal: this.cameraDeviceId };
    return video;
  }

  private rememberCamera(stream: MediaStream) {
    const id = stream.getVideoTracks()[0]?.getSettings?.().deviceId;
    if (id) this.cameraDeviceId = id;
  }

  private async replaceCameraTrack(video: MediaStreamTrack) {
    await applyTrackConstraints(new MediaStream([video]), "camera");
    const audio = this.state.localStream?.getAudioTracks() ?? [];
    this.state.localStream?.getVideoTracks().forEach((track) => track.stop());
    const stream = mediaStreamOf([...audio, video]);
    this.syncOutgoingTrack("video", video);
    this.patch({ cameraOff: false, localStream: stream });
    this.broadcast({ type: "media-meta", cameraOff: false });
    this.applyLimitsToAll();
    window.setTimeout(() => this.applyLimitsToAll(), 400);
    void this.refreshCameraSwitch();
  }

  private onDeviceChange = () => {
    void this.refreshCameraSwitch();
  };

  private watchDevices() {
    const md = navigator.mediaDevices;
    if (!md?.addEventListener) return;
    md.removeEventListener("devicechange", this.onDeviceChange);
    md.addEventListener("devicechange", this.onDeviceChange);
  }

  private async refreshCameraSwitch() {
    let n = 0;
    try {
      n =
        (await navigator.mediaDevices?.enumerateDevices?.())?.filter(
          (d) => d.kind === "videoinput",
        ).length ?? 0;
    } catch {
      n = 0;
    }
    const canSwitchCamera = n >= 2;
    if (canSwitchCamera !== this.state.canSwitchCamera) {
      this.patch({ canSwitchCamera });
    }
  }

  private async enableMic() {
    if (this.selfLocked("audio")) return;
    let fresh: MediaStream;
    try {
      fresh = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
        },
        video: false,
      });
    } catch {
      this.toast("toast.mediaMic");
      return;
    }
    const audio = fresh.getAudioTracks()[0];
    if (!audio) {
      this.toast("toast.mediaMic");
      return;
    }
    this.state.localStream?.getAudioTracks().forEach((track) => track.stop());
    const video = this.state.localStream?.getVideoTracks() ?? [];
    const stream = mediaStreamOf([audio, ...video]);
    this.syncOutgoingTrack("audio", audio);
    this.patch({ muted: false, localStream: stream });
  }

  private syncOutgoingTrack(
    kind: "audio" | "video",
    track: MediaStreamTrack | null,
  ) {
    for (const call of this.media.values()) {
      const pc = call.peerConnection;
      if (!pc) continue;
      const sender =
        pc.getSenders().find((s) => s.track?.kind === kind) ??
        pc.getTransceivers().find((tr) => {
          const found = tr.sender.track?.kind ?? tr.receiver.track?.kind;
          return found === kind;
        })?.sender;
      if (sender) {
        void sender.replaceTrack(track);
      } else if (track) {
        try {
          pc.addTrack(track, this.state.localStream ?? mediaStreamOf([track]));
        } catch {
          // a linha já existe nesta conexão
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
      metadata: this.signalMeta(),
    });
    this.attachData(conn, true, first);
  }

  private openMedia(peerId: string) {
    if (!this.peer || this.media.has(peerId)) return;
    const call = this.peer.call(peerId, this.outboundStream(), {
      metadata: this.signalMeta({ kind: "camera" }),
    });
    this.attachMedia(call);
    if (this.state.sharingScreen) this.openScreen(peerId);
  }

  private openScreen(peerId: string) {
    const stream = this.state.localScreenStream;
    if (!this.peer || this.screenOut.has(peerId) || !stream) return;
    const call = this.peer.call(peerId, stream, {
      metadata: this.signalMeta({ kind: "screen" }),
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
      if (peerId === this.state.identity?.peerId) continue;
      if (this.notAdmitted(peerId)) continue;
      this.openScreen(peerId);
    }
  }

  private attachData(
    conn: DataConnection,
    outgoing: boolean,
    first?: WireMessage,
  ) {
    this.data.set(conn.peer, conn);
    const watchDataIce = () => {
      if (conn.peerConnection) this.watchIce(conn.peer, conn.peerConnection);
    };
    watchDataIce();
    conn.on("iceStateChanged", watchDataIce);
    conn.on("open", () => {
      watchDataIce();
      this.iceEverConnected.add(conn.peer);
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
      this.offerExistingHost(conn);
    });
    conn.on("data", (raw) => {
      if (this.onFileBytes(conn, raw)) return;
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
    this.media.set(call.peer, call);
    call.on("stream", (stream) => {
      if (call.peerConnection) this.watchIce(call.peer, call.peerConnection);
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
    const metaName = this.nameFromMeta(meta?.displayName, call.peer);
    if (meta?.kind === "screen") {
      if (
        this.state.callStatus === "idle" ||
        this.banned.has(call.peer) ||
        this.notAdmitted(call.peer)
      ) {
        call.close();
        return;
      }
      call.answer();
      this.attachIncomingScreen(call);
      this.names.set(call.peer, metaName);
      this.upsertRemote(call.peer, {
        displayName: metaName,
        sharingScreen: true,
      });
      this.rememberShare(call.peer);
      return;
    }

    if (this.state.callStatus !== "idle") {
      if (this.banned.has(call.peer)) {
        call.close();
        return;
      }
      if (this.shouldRefusePeer(call.peer)) {
        this.refuseJoin(call.peer);
        call.close();
        return;
      }
      if (this.notAdmitted(call.peer)) {
        // Só o host tem uma decisão pendente: ele segura a chamada sem atender
        // até aprovar (`admitPeer` responde depois). Para os demais, quem não
        // está na lista da sala simplesmente não é atendido.
        if (!this.state.isHost) {
          call.close();
          return;
        }
        this.attachMedia(call);
        return;
      }
      this.attachMedia(call);
      call.answer(this.outboundStream());
      if (this.state.sharingScreen) this.openScreen(call.peer);
      return;
    }
    this.media.set(call.peer, call);
    this.attachMedia(call);
    this.patch({
      incoming: {
        peerId: call.peer,
        displayName: metaName,
      },
    });
  }

  private nameFromMeta(raw: unknown, peerId: string) {
    const clamped =
      typeof raw === "string" ? clampDisplayName(raw.trim()) : "";
    return clamped || this.names.get(peerId) || t("common.someone");
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
    const msg = parseWire(raw);
    if (!msg) return;

    // `conn.peer` é a única identidade que o broker garante. Tudo que o payload
    // afirma sobre quem enviou é ignorado.
    const from = conn.peer;

    // Quem está na sala de espera só pode se apresentar. Nada do que mande
    // além disso conta enquanto o host não decidir.
    if (msg.type !== "hello" && this.notAdmitted(from)) return;

    if (msg.type === "hello") {
      this.names.set(from, msg.displayName);
      if (this.state.callStatus === "idle") {
        this.upsertRemote(from, { displayName: msg.displayName });
        this.patch({
          incoming: { peerId: from, displayName: msg.displayName },
        });
        return;
      }
      if (this.state.isHost) {
        // Quem já é membro ou foi discado por nós não passa pela sala de
        // espera: a aprovação já aconteceu, explícita ou implicitamente.
        const known =
          this.roomMembers.some((p) => p.peerId === from) ||
          from === this.dialedPeerId;
        if (!known) {
          if (this.banned.has(from)) {
            this.sendAndDrop(from, { type: "room-denied" });
            return;
          }
          // Sem o segredo certo nem chega a incomodar o host: é link velho,
          // de antes de alguém ser removido, ou chave garimpada no broker.
          if (!this.hostSecret || msg.secret !== this.hostSecret) {
            this.sendAndDrop(from, { type: "room-denied", reason: "stale" });
            return;
          }
          if (this.isRoomFull()) {
            this.refuseJoin(from);
            return;
          }
          this.knock(from, msg.displayName, conn);
          return;
        }
        this.upsertRemote(from, { displayName: msg.displayName });
        this.addRoomMember({ peerId: from, displayName: msg.displayName });
        this.offerExistingHost(conn);
        this.broadcastRoom();
      } else {
        // Convidado não admite ninguém: quem vale está na lista do host, que
        // chega por `room-peers`. Se ainda não chegou, o hello espera lá.
        if (this.notAdmitted(from)) return;
        this.upsertRemote(from, { displayName: msg.displayName });
      }
      this.maybeCall(from);
      return;
    }

    if (msg.type === "room-host") {
      if (!this.isRoomAuthority(from)) return;
      this.becomeGuest(msg.hostPeerId);
      return;
    }

    if (msg.type === "room-peers") {
      if (!this.isRoomAuthority(from)) return;
      this.becomeGuest(msg.hostPeerId || from);
      this.roomMembers = msg.peers;
      if (msg.secret) {
        // Guardamos para reapresentar numa reconexão e para que o convite
        // mostrado aqui continue válido depois de o host girar o segredo.
        this.joinSecret = msg.secret;
        if (this.state.roomSecret !== msg.secret)
          this.patch({ roomSecret: msg.secret });
      }
      if (msg.mutes !== undefined) {
        this.patch({
          roomMutes: roomMutesFromWire(msg.mutes, this.state.hostPeerId),
        });
        this.enforceSelfLocks();
      }
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
      if (!this.inRoom()) return;
      const now = Date.now();
      if (!cooledDown(this.lastChatAt.get(from), now, CHAT_COOLDOWN_MS)) return;
      this.lastChatAt.set(from, now);
      const mentions = (msg.mentions ?? []).filter(
        (id) =>
          id === ALL_MENTION ||
          this.roomMembers.some((member) => member.peerId === id),
      );
      this.appendMessage({
        // Mesmo id do fio: poll-vote/timer-control apontam pra ele.
        id: msg.id,
        fromPeerId: from,
        fromName: this.names.get(from) ?? t("common.someone"),
        text: msg.text,
        at: now,
        ...(mentions.length ? { mentions } : {}),
        ...(msg.command ? { command: msg.command } : {}),
      });
      const me = this.state.identity?.peerId;
      if (
        me &&
        isPinged(mentions, me, from) &&
        cooledDown(this.lastMentionToastAt, now, MENTION_TOAST_COOLDOWN_MS)
      ) {
        this.lastMentionToastAt = now;
        showToast(
          mentions.includes(ALL_MENTION)
            ? "toast.mentionedAll"
            : "toast.mentioned",
          { name: this.names.get(from) ?? t("common.someone") },
        );
      }
      return;
    }

    if (msg.type === "poll-vote") {
      if (!this.inRoom()) return;
      this.applyPollVote(msg.id, from, msg.option);
      return;
    }

    if (msg.type === "timer-control") {
      if (!this.inRoom()) return;
      this.applyTimerControl(msg.id, from, null, Date.now(), msg.timer);
      return;
    }

    if (msg.type === "file-start") {
      if (!this.inRoom()) return;
      this.beginIncomingFile(from, msg);
      return;
    }

    if (msg.type === "file-end") {
      this.finishIncomingFile(from, msg.id);
      return;
    }

    if (msg.type === "hangup") {
      this.onPeerLeft(from);
      return;
    }

    if (msg.type === "room-ended") {
      if (!this.isRoomAuthority(from)) return;
      this.resetCall("toast.roomEndedByHost");
      return;
    }

    if (msg.type === "room-full") {
      if (!this.isRoomAuthority(from)) return;
      this.resetCall("toast.roomFull");
      return;
    }

    if (msg.type === "room-waiting") {
      if (!this.isRoomAuthority(from)) return;
      if (this.state.callStatus === "connecting")
        this.patch({ callStatus: "waiting" });
      return;
    }

    if (msg.type === "room-denied") {
      if (!this.isRoomAuthority(from)) return;
      this.resetCall(
        msg.reason === "stale" ? "toast.inviteStale" : "toast.joinDenied",
      );
      return;
    }

    if (msg.type === "room-kicked") {
      if (!this.isRoomAuthority(from)) return;
      this.resetCall("toast.kicked");
      return;
    }

    if (msg.type === "host-transfer") {
      if (!this.isRoomAuthority(from)) return;
      this.roomMembers = this.roomMembers.filter((p) => p.peerId !== from);
      this.assumeHost(
        msg.hostPeerId,
        "toast.hostLeftYouHost",
        "toast.hostLeftNewHost",
      );
      return;
    }

    if (msg.type === "room-mute") {
      if (!this.isRoomAuthority(from)) return;
      this.applyRoomMute(
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
      if (msg.cameraOff !== undefined) {
        this.upsertRemote(from, { cameraOff: msg.cameraOff });
      }
      if (msg.sharingScreen === true) {
        this.upsertRemote(from, { sharingScreen: true });
        this.rememberShare(from);
      } else if (msg.sharingScreen === false) {
        this.clearRemoteScreen(from);
      }
    }
  }

  private isRoomFull() {
    return this.roomMembers.length >= maxParticipants();
  }

  /** Já dentro da sala, e não parado na porta nem fora de chamada. */
  private inRoom() {
    const status = this.state.callStatus;
    return status === "connecting" || status === "in-call";
  }

  /**
   * Só o host manda encerrar a sala, anunciar a lista de peers ou transferir o
   * papel de host. Antes do host estar definido vale apenas o peer que nós
   * discamos, que é o único em quem já depositamos confiança.
   */
  private isRoomAuthority(peerId: string) {
    const me = this.state.identity?.peerId;
    const host = this.state.hostPeerId;
    if (host && host !== me) return peerId === host;
    return peerId === this.dialedPeerId;
  }

  /** Host nunca é alvo; também não silenciamos a nós mesmos por este caminho. */
  private canControlMute(peerId: string) {
    const me = this.state.identity?.peerId;
    const host = this.state.hostPeerId;
    if (!peerId || peerId === me || (host && peerId === host)) return false;
    return (
      this.roomMembers.some((member) => member.peerId === peerId) ||
      this.state.remotes.some((remote) => remote.peerId === peerId)
    );
  }

  private acceptRoomMuteTarget(peerId: string) {
    const me = this.state.identity?.peerId;
    const host = this.state.hostPeerId;
    if (!peerId || (host && peerId === host)) return false;
    if (peerId === me) return true;
    return (
      this.roomMembers.some((member) => member.peerId === peerId) ||
      this.state.remotes.some((remote) => remote.peerId === peerId)
    );
  }

  private selfLocked(kind: MuteKind) {
    const me = this.state.identity?.peerId;
    return !!me && muteOf(this.state.roomMutes, me)[kind];
  }

  private applyRoomMute(
    peerId: string,
    flags: { audio?: boolean; video?: boolean },
    notifySelf: boolean,
  ) {
    if (!this.acceptRoomMuteTarget(peerId)) return;
    const prev = muteOf(this.state.roomMutes, peerId);
    let map = this.state.roomMutes;
    if (flags.audio !== undefined)
      map = setMuteFlag(map, peerId, "audio", flags.audio);
    if (flags.video !== undefined)
      map = setMuteFlag(map, peerId, "video", flags.video);
    if (map !== this.state.roomMutes) this.patch({ roomMutes: map });
    this.enforceSelfLocks();
    if (!notifySelf) return;
    const me = this.state.identity?.peerId;
    if (peerId !== me) return;
    const next = muteOf(this.state.roomMutes, peerId);
    if (flags.audio !== undefined && prev.audio !== next.audio) {
      showToast(next.audio ? "toast.roomMutedAudio" : "toast.roomUnmutedAudio");
    } else if (flags.video !== undefined && prev.video !== next.video) {
      showToast(next.video ? "toast.roomMutedVideo" : "toast.roomUnmutedVideo");
    }
  }

  private enforceSelfLocks() {
    const me = this.state.identity?.peerId;
    if (!me) return;
    const flags = muteOf(this.state.roomMutes, me);
    if (flags.audio) {
      this.state.localStream?.getAudioTracks().forEach((track) => {
        track.enabled = false;
      });
      if (!this.state.muted) this.patch({ muted: true });
    }
    if (flags.video && !this.state.cameraOff) this.disableCamera();
  }

  private appendMessage(message: ChatMessage) {
    const withTimer =
      message.command?.kind === "timer" && !message.timer
        ? {
            ...message,
            timer: initialTimerState(message.command.ms, message.at),
          }
        : message;
    const messages = [...this.state.messages, withTimer];
    if (messages.length > MAX_MESSAGES) {
      const dropped = messages.splice(0, messages.length - MAX_MESSAGES);
      for (const old of dropped) {
        this.clearTimerAlarm(old.id);
        if (!old.file) continue;
        if (old.file.blobUrl) URL.revokeObjectURL(old.file.blobUrl);
        void this.files.release(old.file.id);
        clearFileProgress(old.file.id);
      }
    }
    this.patch({ messages });
    this.scheduleTimerAlarm(withTimer);
  }

  /**
   * Aplica pausa/retomada/cancelamento. Se `remoteTimer` vier do fio, usa esse
   * estado (relógio de quem controlou); senão calcula a ação localmente.
   */
  private applyTimerControl(
    messageId: string,
    actorId: string,
    action: TimerAction | null,
    now: number,
    remoteTimer?: TimerState,
  ) {
    const index = this.state.messages.findIndex((msg) => msg.id === messageId);
    if (index < 0) return null;
    const message = this.state.messages[index];
    if (!message || message.command?.kind !== "timer") return null;
    if (!canControlTimer(message.fromPeerId, actorId, this.state.hostPeerId)) {
      return null;
    }
    const current = resolveTimerState(message);
    if (!current) return null;
    const raw =
      remoteTimer ?? (action ? applyTimerAction(current, action, now) : null);
    if (!raw) return null;
    const next = stampTimerActor(
      raw,
      !!this.state.hostPeerId && actorId === this.state.hostPeerId,
    );
    if (
      current.status === next.status &&
      ((current.status === "running" &&
        next.status === "running" &&
        current.endsAt === next.endsAt) ||
        (current.status === "paused" &&
          next.status === "paused" &&
          current.remainingMs === next.remainingMs &&
          !!current.byHost === !!next.byHost) ||
        (current.status === "cancelled" &&
          next.status === "cancelled" &&
          !!current.byHost === !!next.byHost))
    ) {
      return null;
    }
    const updated = { ...message, timer: next };
    const messages = [...this.state.messages];
    messages[index] = updated;
    this.patch({ messages });
    this.scheduleTimerAlarm(updated);
    return next;
  }

  private applyPollVote(pollId: string, peerId: string, option: number) {
    const index = this.state.messages.findLastIndex(
      (msg) => msg.command?.kind === "poll" && msg.command.id === pollId,
    );
    if (index < 0) return false;
    const message = this.state.messages[index];
    if (!message || message.command?.kind !== "poll") return false;
    if (option < 0 || option >= message.command.options.length) return false;
    if (message.pollVotes?.[peerId] === option) return false;
    const next = [...this.state.messages];
    next[index] = {
      ...message,
      pollVotes: { ...message.pollVotes, [peerId]: option },
    };
    this.patch({ messages: next });
    return true;
  }

  private scheduleTimerAlarm(message: ChatMessage) {
    if (message.command?.kind !== "timer") return;
    this.clearTimerAlarm(message.id);
    const state = resolveTimerState(message);
    if (!state || state.status !== "running") return;
    if (this.timerAlarms.size >= MAX_TIMER_ALARMS) return;
    const remaining = state.endsAt - Date.now();
    if (remaining <= 0) {
      showToast("chat.command.timerDone");
      return;
    }
    const timeout = window.setTimeout(() => {
      this.timerAlarms.delete(message.id);
      showToast("chat.command.timerDone");
    }, remaining);
    this.timerAlarms.set(message.id, timeout);
  }

  private clearTimerAlarm(id: string) {
    const timeout = this.timerAlarms.get(id);
    if (timeout === undefined) return;
    window.clearTimeout(timeout);
    this.timerAlarms.delete(id);
  }

  private clearAllTimerAlarms() {
    for (const timeout of this.timerAlarms.values()) window.clearTimeout(timeout);
    this.timerAlarms.clear();
  }

  /**
   * A sala é a lista que o host anuncia, e ninguém entra por fora dela. Para o
   * host isso é a decisão dele na sala de espera; para os demais é a lista que
   * ele mandou — senão cada convidado seria uma porta lateral sem tranca, já
   * que todos conhecem o peerId de todos.
   */
  private notAdmitted(peerId: string) {
    if (peerId === this.dialedPeerId) return false;
    return !this.roomMembers.some((p) => p.peerId === peerId);
  }

  private shouldRefusePeer(peerId: string) {
    if (!this.state.isHost || !this.isRoomFull()) return false;
    return !this.roomMembers.some((p) => p.peerId === peerId);
  }

  private refuseJoin(peerId: string) {
    this.sendAndDrop(peerId, { type: "room-full" });
  }

  /**
   * Envia o último recado e só então derruba: fechar na mesma volta do laço
   * de eventos descartaria a mensagem antes de ela sair do canal.
   */
  private sendAndDrop(peerId: string, message: WireMessage) {
    const conn = this.data.get(peerId);
    const call = this.media.get(peerId);
    if (conn?.open) conn.send(message);
    this.data.delete(peerId);
    this.media.delete(peerId);
    window.setTimeout(() => {
      conn?.close();
      call?.close();
    }, FLUSH_MS);
  }

  private knock(peerId: string, displayName: string, conn: DataConnection) {
    if (this.state.pending.some((p) => p.peerId === peerId)) return;
    this.patch({ pending: [...this.state.pending, { peerId, displayName }] });
    if (conn.open) conn.send({ type: "room-waiting" });
    showToast("toast.knock", { name: displayName });
  }

  private assumeHost(
    newHostId: string,
    youKey: MessageKey,
    otherKey: MessageKey,
  ) {
    const me = this.state.identity?.peerId;
    if (!me || !newHostId) return;
    const roomMutes = dropMute(this.state.roomMutes, newHostId);
    const localMutes = dropMute(this.state.localMutes, newHostId);
    if (newHostId === me) {
      // Como host, ninguém acima de nós manda: a confiança no peer discado
      // deixa de valer e a sala passa a ser anunciada por nós.
      this.dialedPeerId = null;
      this.patch({
        isHost: true,
        hostPeerId: me,
        pending: [],
        roomMutes,
        localMutes,
      });
      this.broadcastRoom();
      showToast(youKey);
      return;
    }
    this.patch({
      isHost: false,
      hostPeerId: newHostId,
      roomMutes,
      localMutes,
    });
    showToast(otherKey, {
      name: this.names.get(newHostId) ?? t("common.someone"),
    });
  }

  /**
   * Host sumiu sem se despedir. Em vez de derrubar a sala, quem sobra elege o
   * substituto. Com uma pessoa só não há sala para manter.
   */
  private handleHostGone(goneHostId: string) {
    const me = this.state.identity?.peerId;
    if (!me || this.state.callStatus !== "in-call") {
      this.resetCall("toast.roomEndedByHost");
      return;
    }
    this.roomMembers = this.roomMembers.filter((p) => p.peerId !== goneHostId);
    const pool = (
      this.roomMembers.length > 0
        ? this.roomMembers.map((p) => p.peerId)
        : [me, ...this.state.remotes.map((remote) => remote.peerId)]
    ).filter((id) => id !== goneHostId);
    if (pool.filter((id) => id !== me).length === 0) {
      this.resetCall("toast.hostDroppedAlone");
      return;
    }
    const successor = electHost(pool);
    if (!successor) {
      this.resetCall("toast.roomEndedByHost");
      return;
    }
    this.assumeHost(
      successor,
      "toast.hostDroppedYouHost",
      "toast.hostDroppedNewHost",
    );
  }

  private addRoomMember(info: PeerInfo) {
    if (!this.roomMembers.some((p) => p.peerId === info.peerId)) {
      this.roomMembers = [...this.roomMembers, info];
    }
  }

  private offerExistingHost(conn: DataConnection) {
    const me = this.state.identity?.peerId;
    if (
      !me ||
      !this.state.isHost ||
      this.state.callStatus !== "in-call" ||
      !conn.open
    )
      return;
    conn.send({ type: "room-host", hostPeerId: me });
  }

  private becomeGuest(hostPeerId: string) {
    const me = this.state.identity?.peerId;
    if (!hostPeerId || hostPeerId === me) return;
    if (this.state.isHost && this.state.callStatus === "in-call") return;
    if (!this.state.isHost && this.state.hostPeerId === hostPeerId) return;
    this.patch({
      isHost: false,
      hostPeerId,
      localMutes: dropMute(this.state.localMutes, hostPeerId),
      roomMutes: dropMute(this.state.roomMutes, hostPeerId),
    });
  }

  /**
   * Só quem já foi admitido recebe isto — `activeConnections` exclui a sala de
   * espera —, então mandar o segredo junto é seguro e deixa qualquer membro
   * convidar com um link que funciona, inclusive depois de um giro.
   */
  private broadcastRoom() {
    const mutes = roomMutesToWire(
      this.state.roomMutes,
      this.state.identity?.peerId ?? null,
    );
    this.broadcast({
      type: "room-peers",
      peers: this.roomMembers,
      hostPeerId: this.state.identity?.peerId ?? "",
      ...(this.hostSecret ? { secret: this.hostSecret } : {}),
      mutes,
    });
  }

  /** Invalida os links já distribuídos, para que uma saída forçada seja final. */
  private rotateSecret() {
    this.hostSecret = rotateRoomSecret();
    this.patch({ roomSecret: this.hostSecret });
  }

  private maybeConnect(peerId: string) {
    const me = this.state.identity?.peerId;
    if (!me || peerId === me || this.data.has(peerId)) return;
    if (me < peerId) this.openData(peerId);
  }

  private maybeCall(peerId: string) {
    const me = this.state.identity?.peerId;
    if (!me || peerId === me) return;
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

  private onPeerLeft(peerId: string, opts?: { silent?: boolean }) {
    if (this.tearingDown) return;
    if (this.departing.has(peerId)) return;
    this.departing.add(peerId);
    try {
      this.finishPeerLeft(peerId, opts);
    } finally {
      this.departing.delete(peerId);
    }
  }

  private finishPeerLeft(peerId: string, opts?: { silent?: boolean }) {
    const wasInCall = this.state.remotes.some((r) => r.peerId === peerId);
    this.iceRetries.delete(peerId);
    this.iceEverConnected.delete(peerId);
    const name =
      this.state.remotes.find((r) => r.peerId === peerId)?.displayName ??
      this.names.get(peerId) ??
      t("common.someone");
    const hostGone =
      peerId === this.state.hostPeerId && this.state.callStatus !== "idle";
    this.data.get(peerId)?.close();
    this.media.get(peerId)?.close();
    this.screenOut.get(peerId)?.close();
    this.screenIn.get(peerId)?.close();
    this.data.delete(peerId);
    this.media.delete(peerId);
    this.screenOut.delete(peerId);
    this.screenIn.delete(peerId);
    this.failIncomingFile(peerId);
    this.lastChatAt.delete(peerId);
    this.lastFileStart.delete(peerId);
    const remotes = this.state.remotes.filter((r) => r.peerId !== peerId);
    this.roomMembers = this.roomMembers.filter((p) => p.peerId !== peerId);
    this.patch({
      remotes,
      screenShareOrder: this.removeShare(peerId),
      pending: this.state.pending.filter((p) => p.peerId !== peerId),
      incoming:
        this.state.incoming?.peerId === peerId ? null : this.state.incoming,
      localMutes: dropMute(this.state.localMutes, peerId),
      roomMutes: dropMute(this.state.roomMutes, peerId),
    });
    if (this.state.isHost) {
      this.broadcastRoom();
    } else if (hostGone) {
      if (wasInCall) this.appendLeaveNotice(peerId, name);
      this.handleHostGone(peerId);
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
        this.removed.delete(peerId) ? "toast.removed" : "toast.peerLeft",
        {
          name,
        },
      );
      this.appendLeaveNotice(peerId, name);
    }
  }

  private appendLeaveNotice(peerId: string, name: string) {
    this.appendMessage({
      id: crypto.randomUUID(),
      fromPeerId: peerId,
      fromName: name,
      text: "",
      at: Date.now(),
      system: "left",
    });
  }

  /**
   * Lê o arquivo em fatias no worker. O canal continua aqui: só mandamos o
   * próximo pedaço quando o buffer do DataChannel esvazia.
   * @returns false se o peer caiu antes do file-end.
   */
  private async streamFileTo(
    conn: DataConnection,
    id: string,
    size: number,
    sent: Map<DataConnection, number>,
    report: () => void,
  ): Promise<boolean> {
    // O sequencial aqui é o ponto: cada pedaço só é lido depois que o canal
    // tem espaço, e é isso que segura a memória em um pedaço por vez.
    // oxlint-disable no-await-in-loop
    for (let offset = 0; offset < size; offset += FILE_CHUNK) {
      if (this.tearingDown) throw new Error("ended");
      await this.waitForFileBuffer(conn);
      if (!conn.open) return false;
      const chunk = await this.files.readSlice(id, offset, FILE_CHUNK);
      conn.send(chunk);
      sent.set(conn, offset + chunk.byteLength);
      report();
    }
    // oxlint-enable no-await-in-loop
    if (!conn.open) return false;
    conn.send({ type: "file-end", id });
    return true;
  }

  private async mapLimited<T, R>(
    items: T[],
    limit: number,
    fn: (item: T) => Promise<R>,
  ): Promise<R[]> {
    const results = new Array<R>(items.length);
    let next = 0;
    const workers = Array.from(
      { length: Math.min(limit, items.length) },
      async () => {
        while (next < items.length) {
          const index = next;
          next += 1;
          results[index] = await fn(items[index]!);
        }
      },
    );
    await Promise.all(workers);
    return results;
  }

  private waitForFileBuffer(conn: DataConnection) {
    const dc = conn.dataChannel;
    if (!dc || dc.bufferedAmount < FILE_BUFFER_HIGH) return Promise.resolve();
    const low = FILE_BUFFER_HIGH / 4;
    return new Promise<void>((resolve) => {
      // O evento não dispara se o canal fechar no meio da drenagem, daí a
      // verificação periódica de segurança em paralelo.
      const guard = window.setInterval(() => {
        if (!conn.open || dc.bufferedAmount < low) settle();
      }, 250);
      const settle = () => {
        window.clearInterval(guard);
        dc.removeEventListener("bufferedamountlow", settle);
        resolve();
      };
      dc.bufferedAmountLowThreshold = low;
      dc.addEventListener("bufferedamountlow", settle);
    });
  }

  private takeFileBytes(raw: unknown): ArrayBuffer | Blob | null {
    // Um ArrayBuffer chega exclusivo por mensagem, então dá para adotá-lo sem
    // copiar e transferir ao worker. Já uma view pode apontar para um buffer
    // maior: copiamos só os bytes úteis.
    if (raw instanceof ArrayBuffer) return raw;
    if (ArrayBuffer.isView(raw)) {
      const view = new Uint8Array(raw.buffer, raw.byteOffset, raw.byteLength);
      const copy = new Uint8Array(view.byteLength);
      copy.set(view);
      return copy.buffer;
    }
    if (typeof Blob !== "undefined" && raw instanceof Blob) return raw;
    return null;
  }

  private onFileBytes(conn: DataConnection, raw: unknown) {
    const data = this.takeFileBytes(raw);
    if (!data) return false;
    if (!this.incomingFiles.has(conn.peer)) return true;
    this.queueIncoming(conn.peer, data);
    return true;
  }

  private queueIncoming(peerId: string, data: ArrayBuffer | Blob) {
    const prev = this.incomingByteTail.get(peerId) ?? Promise.resolve();
    const next = prev
      .then(async () => {
        const incoming = this.incomingFiles.get(peerId);
        if (!incoming) return;
        const received = await this.files.push(peerId, data);
        if (received === null) {
          this.failIncomingFile(peerId);
          return;
        }
        setFileProgress(incoming.localId, received / incoming.size);
      })
      .catch(() => {
        this.failIncomingFile(peerId);
      });
    this.incomingByteTail.set(peerId, next);
  }

  private isKnownPeer(peerId: string) {
    return (
      this.roomMembers.some((p) => p.peerId === peerId) ||
      this.state.remotes.some((r) => r.peerId === peerId)
    );
  }

  /**
   * O anúncio do remetente não reserva memória: os bytes só são guardados à
   * medida que chegam, e um teto global cobre o caso de vários peers hostis
   * transmitindo ao mesmo tempo.
   */
  private beginIncomingFile(
    peerId: string,
    msg: Extract<WireMessage, { type: "file-start" }>,
  ) {
    if (!this.isKnownPeer(peerId)) return;

    const now = Date.now();
    const previous = this.lastFileStart.get(peerId) ?? 0;
    if (now - previous < FILE_START_COOLDOWN) return;
    this.lastFileStart.set(peerId, now);

    if (this.incomingFiles.has(peerId)) this.failIncomingFile(peerId);
    if (this.incomingFiles.size >= MAX_CONCURRENT_INCOMING) return;

    const name = safeFileName(msg.name);
    const localId = crypto.randomUUID();
    this.incomingFiles.set(peerId, {
      remoteId: msg.id,
      localId,
      name,
      mime: msg.mime,
      size: msg.size,
    });
    const prev = this.incomingByteTail.get(peerId) ?? Promise.resolve();
    this.incomingByteTail.set(
      peerId,
      prev
        .then(() =>
          this.files.openReceive({
            peerId,
            remoteId: msg.id,
            localId,
            mime: msg.mime,
            size: msg.size,
          }),
        )
        .catch(() => {
          this.failIncomingFile(peerId);
        }),
    );
    this.appendMessage({
      id: localId,
      fromPeerId: peerId,
      fromName: this.names.get(peerId) ?? t("common.someone"),
      text: "",
      at: now,
      file: {
        id: localId,
        name,
        mime: msg.mime,
        size: msg.size,
        status: "receiving",
        blobUrl: null,
      },
    });
  }

  private finishIncomingFile(peerId: string, remoteId: string) {
    const tail = this.incomingByteTail.get(peerId) ?? Promise.resolve();
    void tail.then(async () => {
      const incoming = this.incomingFiles.get(peerId);
      if (!incoming || incoming.remoteId !== remoteId) return;
      this.incomingFiles.delete(peerId);
      this.incomingByteTail.delete(peerId);
      try {
        const blob = await this.files.finish(peerId);
        if (!blob) {
          this.patchFile(incoming.localId, { status: "error" });
          return;
        }
        setFileProgress(incoming.localId, 1);
        const typed =
          blob.type && blob.type !== "application/octet-stream"
            ? blob
            : new Blob([blob], { type: incoming.mime });
        this.patchFile(incoming.localId, {
          status: "ready",
          blobUrl: URL.createObjectURL(typed),
        });
      } catch {
        this.patchFile(incoming.localId, { status: "error" });
      }
    });
  }

  private failIncomingFile(peerId: string) {
    const incoming = this.incomingFiles.get(peerId);
    this.incomingFiles.delete(peerId);
    this.incomingByteTail.delete(peerId);
    void this.files.abort(peerId);
    if (incoming) this.patchFile(incoming.localId, { status: "error" });
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
      if (!message.file) continue;
      if (message.file.blobUrl) URL.revokeObjectURL(message.file.blobUrl);
      void this.files.release(message.file.id);
    }
  }

  /**
   * Conexões que já valem como sala. Quem está na porta tem data channel
   * aberto para poder ser avisado, mas não entra em nada que seja conversa.
   */
  private activeConnections() {
    const open: DataConnection[] = [];
    for (const [peerId, conn] of this.data) {
      if (conn.open && !this.notAdmitted(peerId)) open.push(conn);
    }
    return open;
  }

  private broadcast(message: WireMessage) {
    for (const conn of this.activeConnections()) conn.send(message);
  }

  private applyLimitsToAll() {
    for (const call of this.media.values()) {
      const pc = call.peerConnection;
      if (!pc) continue;
      for (const sender of pc.getSenders()) {
        void applySenderLimits(sender, "camera");
      }
    }
    for (const call of this.screenOut.values()) {
      const pc = call.peerConnection;
      if (!pc) continue;
      for (const sender of pc.getSenders()) {
        void applySenderLimits(sender, "screen");
      }
    }
  }

  /**
   * O desligamento é síncrono do início ao fim: `tearingDown` vale só enquanto
   * este método roda, então nenhum evento consegue se intercalar e ser
   * descartado por engano. As data connections são as únicas que esperam, o
   * bastante para o último aviso escoar pelo canal antes do fechamento.
   */
  private resetCall(endedReason?: MessageKey) {
    if (this.tearingDown) return;
    this.tearingDown = true;
    const draining = [...this.data.values()];
    window.setTimeout(() => {
      for (const conn of draining) conn.close();
    }, FLUSH_MS);
    for (const call of this.media.values()) call.close();
    for (const call of this.screenOut.values()) call.close();
    for (const call of this.screenIn.values()) call.close();
    this.data.clear();
    this.media.clear();
    this.screenOut.clear();
    this.screenIn.clear();
    this.incomingFiles.clear();
    this.incomingByteTail.clear();
    this.lastFileStart.clear();
    this.lastChatAt.clear();
    this.lastMentionToastAt = 0;
    this.clearAllTimerAlarms();
    this.sendingFile = false;
    void this.files.abortAll();
    clearAllFileProgress();
    this.revokeMessageFiles();
    this.roomMembers = [];
    this.banned.clear();
    this.removed.clear();
    this.dialedPeerId = null;
    this.joinSecret = null;
    this.screenTrack?.stop();
    this.screenTrack = null;
    this.cameraDeviceId = null;
    this.switchingCamera = false;
    this.state.localStream?.getTracks().forEach((track) => track.stop());
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
      roomSecret: this.hostSecret,
      pending: [],
      leavePrompt: false,
      pathHint: false,
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
    navigator.mediaDevices?.removeEventListener?.(
      "devicechange",
      this.onDeviceChange,
    );
    this.peer?.destroy();
    this.peer = null;
  }
}

export const session = new PeerSession();
