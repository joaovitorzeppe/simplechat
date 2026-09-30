import type { DataConnection } from "peerjs";
import type { MessageKey } from "@i18n/locales";
import { t } from "@i18n/i18n";
import { rotateRoomSecret } from "./identity";
import {
  dropMute,
  muteOf,
  roomMutesFromWire,
  roomMutesToWire,
  setMuteFlag,
  type MuteKind,
} from "./mutes";
import { maxParticipants } from "./quality";
import type { PeerSession } from "./session";
import { showToast } from "./toast";
import type { PeerInfo, WireMessage } from "./types";

export const FLUSH_MS = 80;

/**
 * Sucessor determinístico: o menor peerId entre os candidatos. Como todos
 * partem da mesma lista de membros, que veio do host, cada peer chega sozinho
 * ao mesmo nome — sem negociação e sem risco de dois hosts ao mesmo tempo.
 */
export const electHost = (candidates: string[]) => {
  return candidates.length > 0 ? candidates.toSorted()[0] : null;
};

/** Membros, sala de espera, host, segredo do convite e mutes da sala. */
export class SessionRoom {
  private readonly session: PeerSession;

  constructor(session: PeerSession) {
    this.session = session;
  }

  private get state() {
    return this.session.getState();
  }

  roomMembers: PeerInfo[] = [];
  /** Removidos pelo host: não voltam com o mesmo link enquanto a sala existir. */
  banned = new Set<string>();
  /** Saídas provocadas por remoção, para o aviso não dizer que a pessoa saiu. */
  removed = new Set<string>();
  dialedPeerId: string | null = null;
  /** Nosso segredo quando somos host. Gira a cada recusa ou remoção. */
  hostSecret: string | null = null;
  /** Segredo que apresentamos ao entrar na sala de outra pessoa. */
  joinSecret: string | null = null;

  admitPeer(peerId: string) {
    if (!this.state.isHost) {
      return;
    }
    const info = this.state.pending.find((p) => p.peerId === peerId);
    if (!info) {
      return;
    }
    this.session.patch({
      pending: this.state.pending.filter((p) => p.peerId !== peerId),
    });
    if (this.isRoomFull()) {
      this.refuseJoin(peerId);
      return;
    }
    this.session.names.set(peerId, info.displayName);
    this.session.upsertRemote(peerId, { displayName: info.displayName });
    this.addRoomMember(info);
    // A chamada de mídia dele já chegou e ficou parada esperando esta decisão.
    this.session.answerQueuedMedia(peerId);
    const conn = this.session.data.get(peerId);
    if (conn) {
      this.offerExistingHost(conn);
    }
    this.broadcastRoom();
    this.session.maybeCall(peerId);
  }

  denyPeer(peerId: string) {
    if (!this.state.isHost) {
      return;
    }
    if (!this.state.pending.some((p) => p.peerId === peerId)) {
      return;
    }
    this.session.patch({
      pending: this.state.pending.filter((p) => p.peerId !== peerId),
    });
    this.banned.add(peerId);
    this.sendAndDrop(peerId, { type: "room-denied" });
    this.rotateSecret();
    this.broadcastRoom();
  }

  kickPeer = (peerId: string) => {
    if (!this.state.isHost || peerId === this.state.identity?.peerId) {
      return;
    }
    if (!this.state.remotes.some((remote) => remote.peerId === peerId)) {
      return;
    }
    this.banned.add(peerId);
    this.removed.add(peerId);
    this.setRoomMembers(this.roomMembers.filter((p) => p.peerId !== peerId));
    const conn = this.session.data.get(peerId);
    if (conn?.open) {
      void conn.send({ type: "room-kicked" });
    }
    // Quem saiu já está fora de `roomMembers`, então `activeConnections` o
    // exclui daqui em diante: ele não recebe o segredo novo e o link que tem
    // morre aqui. Os que ficaram são avisados na hora, não no timer abaixo.
    this.rotateSecret();
    this.broadcastRoom();
    // Deixa o aviso escoar antes de derrubar o canal por baixo dele.
    window.setTimeout(() => this.session.onPeerLeft(peerId), FLUSH_MS);
  };

  /** Silencia o áudio ou o vídeo de outra pessoa só neste cliente. */
  toggleLocalMute = (peerId: string, kind: MuteKind) => {
    if (!this.session.inRoom() || !this.canControlMute(peerId)) {
      return;
    }
    if (muteOf(this.state.roomMutes, peerId)[kind] && !this.state.isHost) {
      return;
    }
    const next = !muteOf(this.state.localMutes, peerId)[kind];
    this.session.patch({
      localMutes: setMuteFlag(this.state.localMutes, peerId, kind, next),
    });
  };

  /** Host: pede silêncio de áudio/vídeo na sala.
   * Viewers já aplicam `roomMutes` na tile (não tocam o stream). O alvo é
   * pedido a cortar as tracks via `enforceSelfLocks` — cliente modificado
   * pode ignorar e continuar enviando (só gasta banda). Em P2P puro não há
   * corte no remetente. */
  setRoomMute = (peerId: string, kind: MuteKind, muted: boolean) => {
    if (
      !this.state.isHost ||
      !this.session.inRoom() ||
      !this.canControlMute(peerId)
    ) {
      return;
    }
    this.applyRoomMute(peerId, { [kind]: muted }, false);
    this.session.broadcast({ type: "room-mute", peerId, [kind]: muted });
  };

  helloPayload() {
    return {
      ...this.session.signalMeta(),
      ...(this.joinSecret ? { secret: this.joinSecret } : {}),
    };
  }

  selfInfo(): PeerInfo | null {
    const me = this.state.identity;
    return me ? { peerId: me.peerId, displayName: me.displayName } : null;
  }

  isRoomFull() {
    return this.roomMembers.length >= maxParticipants();
  }

  /**
   * Só o host manda encerrar a sala, anunciar a lista de peers ou transferir o
   * papel de host. Antes do host estar definido vale apenas o peer que nós
   * discamos, que é o único em quem já depositamos confiança.
   */
  isRoomAuthority(peerId: string) {
    const me = this.state.identity?.peerId;
    const host = this.state.hostPeerId;
    if (host && host !== me) {
      return peerId === host;
    }
    return peerId === this.dialedPeerId;
  }

  /** Host nunca é alvo; também não silenciamos a nós mesmos por este caminho. */
  private canControlMute(peerId: string) {
    const me = this.state.identity?.peerId;
    const host = this.state.hostPeerId;
    if (!peerId || peerId === me || (host && peerId === host)) {
      return false;
    }
    return (
      this.roomMembers.some((member) => member.peerId === peerId) ||
      this.state.remotes.some((remote) => remote.peerId === peerId)
    );
  }

  private acceptRoomMuteTarget(peerId: string) {
    const me = this.state.identity?.peerId;
    const host = this.state.hostPeerId;
    if (!peerId || (host && peerId === host)) {
      return false;
    }
    if (peerId === me) {
      return true;
    }
    return (
      this.roomMembers.some((member) => member.peerId === peerId) ||
      this.state.remotes.some((remote) => remote.peerId === peerId)
    );
  }

  selfLocked(kind: MuteKind) {
    const me = this.state.identity?.peerId;
    return !!me && muteOf(this.state.roomMutes, me)[kind];
  }

  applyRoomMute(
    peerId: string,
    flags: { audio?: boolean; video?: boolean },
    notifySelf: boolean,
  ) {
    if (!this.acceptRoomMuteTarget(peerId)) {
      return;
    }
    const prev = muteOf(this.state.roomMutes, peerId);
    let map = this.state.roomMutes;
    if (flags.audio !== undefined) {
      map = setMuteFlag(map, peerId, "audio", flags.audio);
    }
    if (flags.video !== undefined) {
      map = setMuteFlag(map, peerId, "video", flags.video);
    }
    if (map !== this.state.roomMutes) {
      this.session.patch({ roomMutes: map });
    }
    this.enforceSelfLocks();
    if (!notifySelf) {
      return;
    }
    const me = this.state.identity?.peerId;
    if (peerId !== me) {
      return;
    }
    const next = muteOf(this.state.roomMutes, peerId);
    if (flags.audio !== undefined && prev.audio !== next.audio) {
      showToast(next.audio ? "toast.roomMutedAudio" : "toast.roomUnmutedAudio");
    } else if (flags.video !== undefined && prev.video !== next.video) {
      showToast(next.video ? "toast.roomMutedVideo" : "toast.roomUnmutedVideo");
    }
  }

  enforceSelfLocks() {
    const me = this.state.identity?.peerId;
    if (!me) {
      return;
    }
    const flags = muteOf(this.state.roomMutes, me);
    if (flags.audio) {
      this.state.localStream?.getAudioTracks().forEach((track) => {
        track.enabled = false;
      });
      if (!this.state.muted) {
        this.session.patch({ muted: true });
      }
    }
    if (flags.video && !this.state.cameraOff) {
      this.session.media.disableCamera();
    }
  }

  /**
   * A sala é a lista que o host anuncia, e ninguém entra por fora dela. Para o
   * host isso é a decisão dele na sala de espera; para os demais é a lista que
   * ele mandou — senão cada convidado seria uma porta lateral sem tranca, já
   * que todos conhecem o peerId de todos.
   */
  notAdmitted(peerId: string) {
    if (peerId === this.dialedPeerId) {
      return false;
    }
    return !this.roomMembers.some((p) => p.peerId === peerId);
  }

  shouldRefusePeer(peerId: string) {
    if (!this.state.isHost || !this.isRoomFull()) {
      return false;
    }
    return !this.roomMembers.some((p) => p.peerId === peerId);
  }

  refuseJoin(peerId: string) {
    this.sendAndDrop(peerId, { type: "room-full" });
  }

  /**
   * Envia o último recado e só então derruba: fechar na mesma volta do laço
   * de eventos descartaria a mensagem antes de ela sair do canal.
   */
  sendAndDrop(peerId: string, message: WireMessage) {
    const conn = this.session.data.get(peerId);
    const call = this.session.calls.get(peerId);
    if (conn?.open) {
      void conn.send(message);
    }
    this.session.data.delete(peerId);
    this.session.calls.delete(peerId);
    window.setTimeout(() => {
      conn?.close();
      call?.close();
    }, FLUSH_MS);
  }

  knock(peerId: string, displayName: string, conn: DataConnection) {
    if (this.state.pending.some((p) => p.peerId === peerId)) {
      return;
    }
    this.session.patch({
      pending: [...this.state.pending, { peerId, displayName }],
    });
    if (conn.open) {
      void conn.send({ type: "room-waiting" });
    }
  }

  assumeHost(newHostId: string, youKey: MessageKey, otherKey: MessageKey) {
    const me = this.state.identity?.peerId;
    if (!me || !newHostId) {
      return;
    }
    const roomMutes = dropMute(this.state.roomMutes, newHostId);
    const localMutes = dropMute(this.state.localMutes, newHostId);
    if (newHostId === me) {
      // Como host, ninguém acima de nós manda: a confiança no peer discado
      // deixa de valer e a sala passa a ser anunciada por nós.
      this.dialedPeerId = null;
      this.session.patch({
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
    this.session.patch({
      isHost: false,
      hostPeerId: newHostId,
      roomMutes,
      localMutes,
    });
    showToast(otherKey, {
      name: this.session.names.get(newHostId) ?? t("common.someone"),
    });
  }

  /**
   * Host sumiu sem se despedir. Em vez de derrubar a sala, quem sobra elege o
   * substituto. Com uma pessoa só não há sala para manter.
   */
  handleHostGone(goneHostId: string) {
    const me = this.state.identity?.peerId;
    if (!me || this.state.callStatus !== "in-call") {
      this.session.resetCall("toast.roomEndedByHost");
      return;
    }
    this.setRoomMembers(
      this.roomMembers.filter((p) => p.peerId !== goneHostId),
    );
    const pool = (
      this.roomMembers.length > 0
        ? this.roomMembers.map((p) => p.peerId)
        : [me, ...this.state.remotes.map((remote) => remote.peerId)]
    ).filter((id) => id !== goneHostId);
    if (pool.filter((id) => id !== me).length === 0) {
      this.session.resetCall("toast.hostDroppedAlone");
      return;
    }
    const successor = electHost(pool);
    if (!successor) {
      this.session.resetCall("toast.roomEndedByHost");
      return;
    }
    this.assumeHost(
      successor,
      "toast.hostDroppedYouHost",
      "toast.hostDroppedNewHost",
    );
  }

  setRoomMembers(next: PeerInfo[]) {
    this.roomMembers = next;
    this.session.patch({ members: next });
  }

  addRoomMember(info: PeerInfo) {
    if (!this.roomMembers.some((p) => p.peerId === info.peerId)) {
      this.setRoomMembers([...this.roomMembers, info]);
    }
  }

  offerExistingHost(conn: DataConnection) {
    const me = this.state.identity?.peerId;
    if (
      !me ||
      !this.state.isHost ||
      this.state.callStatus !== "in-call" ||
      !conn.open
    ) {
      return;
    }
    void conn.send({ type: "room-host", hostPeerId: me });
  }

  becomeGuest(hostPeerId: string) {
    const me = this.state.identity?.peerId;
    if (!hostPeerId || hostPeerId === me) {
      return;
    }
    if (this.state.isHost && this.state.callStatus === "in-call") {
      return;
    }
    if (!this.state.isHost && this.state.hostPeerId === hostPeerId) {
      return;
    }
    this.session.patch({
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
  broadcastRoom() {
    const mutes = roomMutesToWire(
      this.state.roomMutes,
      this.state.identity?.peerId ?? null,
    );
    this.session.broadcast({
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
    this.session.patch({ roomSecret: this.hostSecret });
  }

  isKnownPeer(peerId: string) {
    return (
      this.roomMembers.some((p) => p.peerId === peerId) ||
      this.state.remotes.some((r) => r.peerId === peerId)
    );
  }

  onHello(conn: DataConnection, msg: Extract<WireMessage, { type: "hello" }>) {
    const from = conn.peer;
    this.session.names.set(from, msg.displayName);
    if (this.state.callStatus === "idle") {
      this.session.upsertRemote(from, { displayName: msg.displayName });
      this.session.patch({
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
      this.session.upsertRemote(from, { displayName: msg.displayName });
      this.addRoomMember({ peerId: from, displayName: msg.displayName });
      this.offerExistingHost(conn);
      this.broadcastRoom();
    } else {
      // Convidado não admite ninguém: quem vale está na lista do host, que
      // chega por `room-peers`. Se ainda não chegou, o hello espera lá.
      if (this.notAdmitted(from)) {
        return;
      }
      this.session.upsertRemote(from, { displayName: msg.displayName });
    }
    this.session.maybeCall(from);
  }

  onRoomPeers(from: string, msg: Extract<WireMessage, { type: "room-peers" }>) {
    this.becomeGuest(msg.hostPeerId || from);
    this.setRoomMembers(msg.peers);
    if (msg.secret) {
      // Guardamos para reapresentar numa reconexão e para que o convite
      // mostrado aqui continue válido depois de o host girar o segredo.
      this.joinSecret = msg.secret;
      if (this.state.roomSecret !== msg.secret) {
        this.session.patch({ roomSecret: msg.secret });
      }
    }
    if (msg.mutes !== undefined) {
      this.session.patch({
        roomMutes: roomMutesFromWire(msg.mutes, this.state.hostPeerId),
      });
      this.enforceSelfLocks();
    }
    for (const peer of msg.peers) {
      if (peer.peerId === this.state.identity?.peerId) {
        continue;
      }
      this.session.names.set(peer.peerId, peer.displayName);
      this.session.upsertRemote(peer.peerId, {
        displayName: peer.displayName,
      });
      // Mídia lateral pode ter chegado antes desta lista — atende o hold.
      this.session.answerQueuedMedia(peer.peerId);
      this.session.maybeConnect(peer.peerId);
      this.session.maybeCall(peer.peerId);
    }
    if (this.state.callStatus !== "in-call") {
      this.session.patch({ callStatus: "in-call" });
    }
  }

  forget(peerId: string) {
    this.setRoomMembers(this.roomMembers.filter((p) => p.peerId !== peerId));
  }

  reset() {
    this.setRoomMembers([]);
    this.banned.clear();
    this.removed.clear();
    this.dialedPeerId = null;
    this.joinSecret = null;
  }
}
