import { Peer, type DataConnection, type MediaConnection } from 'peerjs'
import {
  appendHistoryMessage,
  endHistoryCall,
  startHistoryCall,
  touchHistoryParticipants,
} from './db'
import {
  applySenderLimits,
  applyTrackConstraints,
  currentTier,
  getCameraConstraints,
  getDisplayConstraints,
  type MediaKind,
} from './quality'
import type {
  CallMode,
  ChatMessage,
  Identity,
  IncomingInvite,
  PeerInfo,
  RemotePeer,
  View,
  WireMessage,
} from './types'

export type SessionState = {
  view: View
  identity: Identity | null
  peerReady: boolean
  peerError: string | null
  toast: string | null
  localStream: MediaStream | null
  remotes: RemotePeer[]
  messages: ChatMessage[]
  muted: boolean
  cameraOff: boolean
  sharingScreen: boolean
  callMode: CallMode | null
  isHost: boolean
  callStatus: 'idle' | 'connecting' | 'in-call'
  incoming: IncomingInvite | null
  activeCallId: string | null
}

const STUN = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
}

const initialState: SessionState = {
  view: 'home',
  identity: null,
  peerReady: false,
  peerError: null,
  toast: null,
  localStream: null,
  remotes: [],
  messages: [],
  muted: false,
  cameraOff: false,
  sharingScreen: false,
  callMode: null,
  isHost: false,
  callStatus: 'idle',
  incoming: null,
  activeCallId: null,
}

type Listener = () => void

export class PeerSession {
  private listeners = new Set<Listener>()
  private state: SessionState = initialState
  private peer: Peer | null = null
  private data = new Map<string, DataConnection>()
  private media = new Map<string, MediaConnection>()
  private names = new Map<string, string>()
  private roomMembers: PeerInfo[] = []
  private screenTrack: MediaStreamTrack | null = null
  private toastTimer = 0
  private starting = false

  subscribe = (listener: Listener) => {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  getState = () => this.state

  private patch(partial: Partial<SessionState>) {
    this.state = { ...this.state, ...partial }
    for (const listener of this.listeners) listener()
  }

  private toast(message: string) {
    window.clearTimeout(this.toastTimer)
    this.patch({ toast: message })
    this.toastTimer = window.setTimeout(() => this.patch({ toast: null }), 3200)
  }

  async start(identity: Identity) {
    if (this.starting && this.state.identity?.peerId === identity.peerId) return
    if (this.peer && this.state.identity?.peerId === identity.peerId && this.state.peerReady) {
      this.patch({ identity })
      return
    }
    this.starting = true
    this.destroyPeer()
    this.patch({ identity, peerReady: false, peerError: null })

    const peer = new Peer(identity.peerId, { config: STUN, debug: 0 })
    this.peer = peer

    peer.on('open', () => {
      this.starting = false
      this.patch({ peerReady: true, peerError: null })
    })

    peer.on('error', (err) => {
      this.starting = false
      const type = 'type' in err ? String(err.type) : ''
      if (type === 'unavailable-id') {
        this.patch({
          peerReady: false,
          peerError: 'Esta chave ainda está ocupada no broker. Recarregue em alguns segundos.',
        })
        return
      }
      if (type === 'peer-unavailable') {
        this.toast('Pessoa não encontrada. Confira a chave.')
        if (this.state.callStatus === 'connecting') this.resetCall(false)
        return
      }
      this.patch({ peerError: err.message || 'Falha no PeerJS' })
    })

    peer.on('disconnected', () => {
      if (peer.destroyed) return
      peer.reconnect()
    })

    peer.on('connection', (conn) => {
      this.attachData(conn, false)
    })

    peer.on('call', (call) => {
      void this.onIncomingCall(call)
    })
  }

  setView(view: View) {
    if (this.state.callStatus !== 'idle' && view !== 'call') return
    this.patch({ view })
  }

  async startDirect(remoteId: string) {
    const id = remoteId.trim()
    if (!id || !this.peer || id === this.state.identity?.peerId) return
    try {
      await this.ensureLocalStream()
    } catch {
      this.toast('Permita câmera e microfone para ligar.')
      return
    }
    this.beginCall('direct', false)
    this.openData(id, { type: 'hello', ...this.helloPayload(), kind: 'direct' })
    this.openMedia(id)
    this.patch({ callStatus: 'connecting' })
  }

  async createRoom() {
    try {
      await this.ensureLocalStream()
    } catch {
      this.toast('Permita câmera e microfone para criar a sala.')
      return
    }
    this.roomMembers = this.selfInfo() ? [this.selfInfo()!] : []
    this.beginCall('room', true)
    this.patch({ callStatus: 'in-call' })
  }

  async joinRoom(hostId: string) {
    const id = hostId.trim()
    if (!id || !this.peer || id === this.state.identity?.peerId) return
    try {
      await this.ensureLocalStream()
    } catch {
      this.toast('Permita câmera e microfone para entrar na sala.')
      return
    }
    this.beginCall('room', false)
    this.openData(id, { type: 'hello', ...this.helloPayload(), kind: 'room-join' })
    this.patch({ callStatus: 'connecting' })
  }

  async acceptIncoming() {
    const incoming = this.state.incoming
    if (!incoming) return
    try {
      await this.ensureLocalStream()
    } catch {
      this.toast('Permita câmera e microfone para atender.')
      return
    }
    this.beginCall(incoming.kind === 'room' ? 'room' : 'direct', incoming.kind === 'room')
    const queued = this.media.get(incoming.peerId)
    if (queued && this.state.localStream) queued.answer(this.outboundStream())
    const conn = this.data.get(incoming.peerId)
    if (conn?.open) {
      conn.send({ type: 'hello', ...this.helloPayload(), kind: incoming.kind === 'room' ? 'room-join' : 'direct' })
    }
    this.patch({ incoming: null, callStatus: 'in-call' })
    this.applyLimitsToAll()
  }

  rejectIncoming() {
    const incoming = this.state.incoming
    if (!incoming) return
    this.data.get(incoming.peerId)?.close()
    this.media.get(incoming.peerId)?.close()
    this.data.delete(incoming.peerId)
    this.media.delete(incoming.peerId)
    this.patch({ incoming: null })
  }

  hangUp() {
    if (this.state.isHost && this.state.callMode === 'room') {
      this.broadcast({ type: 'room-ended' })
    }
    this.resetCall(true)
  }

  sendChat(text: string) {
    const trimmed = text.trim()
    const me = this.state.identity
    if (!trimmed || !me) return
    const message: ChatMessage = {
      id: crypto.randomUUID(),
      fromPeerId: me.peerId,
      fromName: me.displayName,
      text: trimmed,
      at: Date.now(),
    }
    this.patch({ messages: [...this.state.messages, message] })
    this.broadcast({ type: 'chat', ...message })
    if (this.state.activeCallId) {
      void appendHistoryMessage({ ...message, callId: this.state.activeCallId })
    }
  }

  toggleMute() {
    const next = !this.state.muted
    this.state.localStream?.getAudioTracks().forEach((track) => {
      track.enabled = !next
    })
    this.patch({ muted: next })
  }

  toggleCamera() {
    const next = !this.state.cameraOff
    if (!this.state.sharingScreen) {
      this.state.localStream?.getVideoTracks().forEach((track) => {
        track.enabled = !next
      })
    }
    this.patch({ cameraOff: next })
  }

  async shareScreen() {
    if (this.state.sharingScreen) {
      await this.stopScreenShare()
      return
    }
    const tier = currentTier()
    let display: MediaStream
    try {
      display = await navigator.mediaDevices.getDisplayMedia(getDisplayConstraints(tier))
    } catch {
      return
    }
    const track = display.getVideoTracks()[0]
    if (!track) return
    this.screenTrack = track
    await applyTrackConstraints(display, 'screen', tier)
    await this.replaceOutgoingVideo(track, 'screen')
    track.addEventListener('ended', () => {
      void this.stopScreenShare()
    })
    this.patch({ sharingScreen: true })
    this.broadcast({ type: 'media-meta', sharingScreen: true })
  }

  async stopScreenShare() {
    const camera = this.state.localStream?.getVideoTracks()[0]
    this.screenTrack?.stop()
    this.screenTrack = null
    if (camera) {
      camera.enabled = !this.state.cameraOff
      await this.replaceOutgoingVideo(camera, 'camera')
    }
    this.patch({ sharingScreen: false })
    this.broadcast({ type: 'media-meta', sharingScreen: false })
  }

  async reapplyQuality() {
    const stream = this.state.localStream
    if (!stream) return
    const kind: MediaKind = this.state.sharingScreen ? 'screen' : 'camera'
    await applyTrackConstraints(this.screenTrack ? new MediaStream([this.screenTrack]) : stream, kind, currentTier())
    this.applyLimitsToAll()
  }

  private helloPayload() {
    const me = this.state.identity
    return { displayName: me?.displayName ?? 'Alguém', peerId: me?.peerId ?? '' }
  }

  private selfInfo(): PeerInfo | null {
    const me = this.state.identity
    return me ? { peerId: me.peerId, displayName: me.displayName } : null
  }

  private beginCall(mode: CallMode, isHost: boolean) {
    const callId = crypto.randomUUID()
    const me = this.selfInfo()
    this.patch({
      view: 'call',
      callMode: mode,
      isHost,
      callStatus: 'connecting',
      messages: [],
      remotes: [],
      activeCallId: callId,
    })
    if (me) {
      void startHistoryCall({
        id: callId,
        mode,
        startedAt: Date.now(),
        endedAt: null,
        participants: [me],
      })
    }
  }

  private async ensureLocalStream() {
    if (this.state.localStream && this.state.localStream.active) return this.state.localStream
    const tier = currentTier()
    let stream: MediaStream
    try {
      stream = await navigator.mediaDevices.getUserMedia(getCameraConstraints(tier))
    } catch {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true })
    }
    await applyTrackConstraints(stream, 'camera', tier)
    stream.getAudioTracks().forEach((track) => {
      track.enabled = !this.state.muted
    })
    stream.getVideoTracks().forEach((track) => {
      track.enabled = !this.state.cameraOff
    })
    this.patch({ localStream: stream })
    return stream
  }

  private outboundStream() {
    const local = this.state.localStream
    const mixed = new MediaStream()
    local?.getAudioTracks().forEach((track) => mixed.addTrack(track))
    const video = this.screenTrack ?? local?.getVideoTracks()[0]
    if (video) mixed.addTrack(video)
    return mixed
  }

  private openData(peerId: string, first?: WireMessage) {
    if (!this.peer || this.data.has(peerId)) return
    const conn = this.peer.connect(peerId, { reliable: true, metadata: this.helloPayload() })
    this.attachData(conn, true, first)
  }

  private openMedia(peerId: string) {
    if (!this.peer || this.media.has(peerId) || !this.state.localStream) return
    const call = this.peer.call(peerId, this.outboundStream(), { metadata: this.helloPayload() })
    this.attachMedia(call)
  }

  private attachData(conn: DataConnection, outgoing: boolean, first?: WireMessage) {
    this.data.set(conn.peer, conn)
    conn.on('open', () => {
      if (outgoing && first) conn.send(first)
      else if (outgoing && this.state.callMode) {
        conn.send({
          type: 'hello',
          ...this.helloPayload(),
          kind: this.state.callMode === 'room' ? 'room-join' : 'direct',
        })
      }
    })
    conn.on('data', (raw) => {
      this.onWire(conn, raw)
    })
    conn.on('close', () => this.onPeerLeft(conn.peer))
    conn.on('error', () => this.onPeerLeft(conn.peer))
  }

  private attachMedia(call: MediaConnection) {
    this.media.set(call.peer, call)
    call.on('stream', (stream) => {
      this.upsertRemote(call.peer, { stream })
      if (this.state.callStatus !== 'in-call') this.patch({ callStatus: 'in-call' })
      window.setTimeout(() => this.applyLimitsToAll(), 400)
    })
    call.on('close', () => this.onPeerLeft(call.peer))
    call.on('error', () => this.onPeerLeft(call.peer))
  }

  private async onIncomingCall(call: MediaConnection) {
    this.media.set(call.peer, call)
    if (this.state.callStatus !== 'idle') {
      if (this.state.localStream) call.answer(this.outboundStream())
      this.attachMedia(call)
      return
    }
    this.attachMedia(call)
    const meta = call.metadata as { displayName?: string } | undefined
    this.patch({
      incoming: {
        peerId: call.peer,
        displayName: meta?.displayName || this.names.get(call.peer) || 'Alguém',
        kind: 'direct',
      },
    })
  }

  private onWire(conn: DataConnection, raw: unknown) {
    const msg = raw as WireMessage
    if (!msg || typeof msg !== 'object' || !('type' in msg)) return

    if (msg.type === 'hello') {
      this.names.set(msg.peerId, msg.displayName)
      this.upsertRemote(msg.peerId, { displayName: msg.displayName })
      if (this.state.callStatus === 'idle') {
        this.patch({
          incoming: {
            peerId: msg.peerId,
            displayName: msg.displayName,
            kind: msg.kind === 'room-join' ? 'room' : 'direct',
          },
        })
        return
      }
      if (this.state.callMode === 'room' && this.state.isHost && msg.kind === 'room-join') {
        this.addRoomMember({ peerId: msg.peerId, displayName: msg.displayName })
        this.broadcast({ type: 'room-peers', peers: this.roomMembers })
        this.maybeCall(msg.peerId)
      }
      if (this.state.callMode === 'direct') this.maybeCall(msg.peerId)
      this.syncHistoryPeers()
      return
    }

    if (msg.type === 'room-peers') {
      this.roomMembers = msg.peers
      for (const peer of msg.peers) {
        if (peer.peerId === this.state.identity?.peerId) continue
        this.names.set(peer.peerId, peer.displayName)
        this.upsertRemote(peer.peerId, { displayName: peer.displayName })
        this.maybeConnect(peer.peerId)
        this.maybeCall(peer.peerId)
      }
      if (this.state.callStatus !== 'in-call') this.patch({ callStatus: 'in-call' })
      this.syncHistoryPeers()
      return
    }

    if (msg.type === 'chat') {
      const message: ChatMessage = {
        id: msg.id,
        fromPeerId: msg.fromPeerId,
        fromName: msg.fromName,
        text: msg.text,
        at: msg.at,
      }
      this.patch({ messages: [...this.state.messages, message] })
      if (this.state.activeCallId) {
        void appendHistoryMessage({ ...message, callId: this.state.activeCallId })
      }
      return
    }

    if (msg.type === 'room-ended') {
      this.toast('A sala foi encerrada pelo host.')
      this.resetCall(true)
      return
    }

    if (msg.type === 'media-meta') {
      this.upsertRemote(conn.peer, { sharingScreen: msg.sharingScreen })
    }
  }

  private addRoomMember(info: PeerInfo) {
    if (!this.roomMembers.some((p) => p.peerId === info.peerId)) {
      this.roomMembers = [...this.roomMembers, info]
    }
  }

  private maybeConnect(peerId: string) {
    const me = this.state.identity?.peerId
    if (!me || peerId === me || this.data.has(peerId)) return
    if (me < peerId) this.openData(peerId)
  }

  private maybeCall(peerId: string) {
    const me = this.state.identity?.peerId
    if (!me || peerId === me || this.media.has(peerId) || !this.state.localStream) return
    if (me < peerId) this.openMedia(peerId)
  }

  private upsertRemote(peerId: string, patch: Partial<RemotePeer>) {
    const current = this.state.remotes.find((r) => r.peerId === peerId)
    const next: RemotePeer = {
      peerId,
      displayName: patch.displayName ?? current?.displayName ?? this.names.get(peerId) ?? 'Alguém',
      stream: patch.stream === undefined ? (current?.stream ?? null) : patch.stream,
      sharingScreen: patch.sharingScreen ?? current?.sharingScreen ?? false,
    }
    const remotes = current
      ? this.state.remotes.map((r) => (r.peerId === peerId ? next : r))
      : [...this.state.remotes, next]
    this.patch({ remotes })
  }

  private onPeerLeft(peerId: string) {
    this.data.get(peerId)?.close()
    this.media.get(peerId)?.close()
    this.data.delete(peerId)
    this.media.delete(peerId)
    const remotes = this.state.remotes.filter((r) => r.peerId !== peerId)
    this.patch({ remotes })
    if (this.state.isHost && this.state.callMode === 'room') {
      this.roomMembers = this.roomMembers.filter((p) => p.peerId !== peerId)
      this.broadcast({ type: 'room-peers', peers: this.roomMembers })
    }
    if (
      this.state.callMode === 'direct' &&
      remotes.length === 0 &&
      this.state.callStatus === 'in-call'
    ) {
      this.toast('A outra pessoa encerrou a chamada.')
      this.resetCall(true)
    }
    if (
      this.state.callMode === 'room' &&
      !this.state.isHost &&
      remotes.length === 0 &&
      this.state.callStatus === 'in-call'
    ) {
      this.toast('A sala acabou.')
      this.resetCall(true)
    }
  }

  private broadcast(message: WireMessage) {
    for (const conn of this.data.values()) {
      if (conn.open) conn.send(message)
    }
  }

  private applyLimitsToAll() {
    const kind: MediaKind = this.state.sharingScreen ? 'screen' : 'camera'
    const tier = currentTier()
    for (const call of this.media.values()) {
      const pc = call.peerConnection
      if (!pc) continue
      for (const sender of pc.getSenders()) {
        void applySenderLimits(sender, kind, tier)
      }
    }
  }

  private async replaceOutgoingVideo(track: MediaStreamTrack, kind: MediaKind) {
    const tier = currentTier()
    for (const call of this.media.values()) {
      const sender = call.peerConnection?.getSenders().find((s) => s.track?.kind === 'video')
      if (!sender) continue
      try {
        await sender.replaceTrack(track)
        await applySenderLimits(sender, kind, tier)
      } catch {
        // ignore
      }
    }
  }

  private syncHistoryPeers() {
    const callId = this.state.activeCallId
    const me = this.selfInfo()
    if (!callId || !me) return
    const participants = [me, ...this.state.remotes.map((r) => ({ peerId: r.peerId, displayName: r.displayName }))]
    void touchHistoryParticipants(callId, participants)
  }

  private resetCall(endHistory: boolean) {
    if (endHistory && this.state.activeCallId) {
      void endHistoryCall(this.state.activeCallId)
    }
    for (const conn of this.data.values()) conn.close()
    for (const call of this.media.values()) call.close()
    this.data.clear()
    this.media.clear()
    this.roomMembers = []
    this.screenTrack?.stop()
    this.screenTrack = null
    this.state.localStream?.getTracks().forEach((track) => track.stop())
    this.names.clear()
    this.patch({
      view: 'home',
      localStream: null,
      remotes: [],
      messages: [],
      sharingScreen: false,
      muted: false,
      cameraOff: false,
      callMode: null,
      isHost: false,
      callStatus: 'idle',
      incoming: null,
      activeCallId: null,
    })
  }

  private destroyPeer() {
    this.peer?.destroy()
    this.peer = null
  }
}

export const session = new PeerSession()
