import type { MediaConnection } from "peerjs";
import {
  acquireLocalMedia,
  cameraFlipConstraints,
  facingFromLabel,
  mediaStreamOf,
  nextCameraFlip,
  placeholderVideoTrack,
} from "./media-access";
import {
  applySenderLimits,
  applyTrackConstraints,
  getCameraConstraints,
  getDisplayConstraints,
} from "./quality";
import type { PeerSession } from "./session";
import type { WireMessage } from "./types";

/** Câmera, microfone e tela: o que sai daqui e as telas que chegam. */
export class SessionMedia {
  private readonly session: PeerSession;

  constructor(session: PeerSession) {
    this.session = session;
  }

  private get state() {
    return this.session.getState();
  }

  private screenOut = new Map<string, MediaConnection>();
  private screenIn = new Map<string, MediaConnection>();
  private screenTrack: MediaStreamTrack | null = null;
  /** Faixa preta no offer/answer enquanto a câmera real está off. */
  private placeholderVideo: MediaStreamTrack | null = null;
  /** Última câmera escolhida: religar não volta para a padrão. */
  private cameraDeviceId: string | null = null;
  private switchingCamera = false;

  onMediaMeta(from: string, msg: Extract<WireMessage, { type: "media-meta" }>) {
    if (msg.cameraOff !== undefined) {
      this.session.upsertRemote(from, { cameraOff: msg.cameraOff });
    }
    if (msg.sharingScreen === true) {
      this.session.upsertRemote(from, { sharingScreen: true });
      this.rememberShare(from);
    } else if (msg.sharingScreen === false) {
      this.clearRemoteScreen(from);
    }
  }

  forget(peerId: string) {
    this.screenOut.get(peerId)?.close();
    this.screenIn.get(peerId)?.close();
    this.screenOut.delete(peerId);
    this.screenIn.delete(peerId);
  }

  closeScreens() {
    for (const call of this.screenOut.values()) {
      call.close();
    }
    for (const call of this.screenIn.values()) {
      call.close();
    }
    this.screenOut.clear();
    this.screenIn.clear();
  }

  reset() {
    this.screenTrack?.stop();
    this.screenTrack = null;
    this.placeholderVideo?.stop();
    this.placeholderVideo = null;
    this.cameraDeviceId = null;
    this.switchingCamera = false;
    this.state.localStream?.getTracks().forEach((track) => track.stop());
  }

  unwatchDevices() {
    navigator.mediaDevices?.removeEventListener?.(
      "devicechange",
      this.onDeviceChange,
    );
  }

  /** Sem câmera nem microfone ainda dá para entrar, só ouvindo e no chat. */
  async ensureLocalStreamOrSilent() {
    try {
      await this.ensureLocalStream();
    } catch {
      this.session.patch({
        localStream: this.state.localStream ?? mediaStreamOf([]),
        cameraOff: true,
        muted: true,
      });
    }
  }

  async toggleMute() {
    const next = !this.state.muted;
    if (!next && this.session.room.selfLocked("audio")) {
      return;
    }
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
    this.session.patch({ muted: next });
  }

  async toggleCamera() {
    if (this.state.cameraOff) {
      await this.enableCamera();
    } else {
      this.disableCamera();
    }
  }

  async switchCamera() {
    if (
      this.switchingCamera ||
      this.state.cameraOff ||
      this.session.room.selfLocked("video")
    ) {
      return;
    }
    const md = navigator.mediaDevices;
    if (!md?.getUserMedia) {
      return;
    }
    let devices: MediaDeviceInfo[] = [];
    try {
      devices = (await md.enumerateDevices?.()) ?? [];
    } catch {
      return;
    }
    const cams = devices
      .filter((d) => d.kind === "videoinput")
      .filter((d) => Boolean(facingFromLabel(d.label)));
    if (cams.length < 2) {
      return;
    }
    const current = this.state.localStream?.getVideoTracks()[0];
    const settings = current?.getSettings?.();
    const flip = nextCameraFlip(cams, {
      deviceId: settings?.deviceId,
      facingMode: settings?.facingMode,
    });
    if (!flip) {
      return;
    }
    const attempts = cameraFlipConstraints(flip, cams);
    this.switchingCamera = true;
    // Tablet Android só entrega um sensor por vez: soltar antes do gum.
    current?.stop();
    try {
      const track = await this.acquireFlipTrack(md, attempts);
      if (!track) {
        throw new Error("switch");
      }
      this.cameraDeviceId =
        track.getSettings?.().deviceId ||
        ("deviceId" in flip ? flip.deviceId : this.cameraDeviceId);
      await this.replaceCameraTrack(track);
    } catch {
      this.session.toast("toast.mediaSwitchCamera");
      await this.reopenCamera();
    } finally {
      this.switchingCamera = false;
    }
  }

  private async acquireFlipTrack(
    md: MediaDevices,
    attempts: MediaTrackConstraints[],
  ) {
    // oxlint-disable no-await-in-loop
    for (const video of attempts) {
      try {
        const fresh = await md.getUserMedia({ audio: false, video });
        const track = fresh.getVideoTracks()[0];
        if (track) {
          return track;
        }
      } catch {
        // Overconstrained / NotReadable: tenta o próximo jeito
      }
    }
    // oxlint-enable no-await-in-loop
    return undefined;
  }

  private async reopenCamera() {
    const md = navigator.mediaDevices;
    if (!md?.getUserMedia) {
      return;
    }
    try {
      const fresh = await md.getUserMedia({
        audio: false,
        video: this.cameraVideoRequest(),
      });
      const track = fresh.getVideoTracks()[0];
      if (track) {
        await this.replaceCameraTrack(track);
      }
    } catch {
      // faixa velha já parou
    }
  }

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
    if (!track) {
      return;
    }
    this.screenTrack = track;
    const screenStream = new MediaStream([track]);
    await applyTrackConstraints(screenStream, "screen");
    track.addEventListener("ended", () => {
      void this.stopScreenShare();
    });
    this.session.patch({
      sharingScreen: true,
      localScreenStream: screenStream,
      screenShareOrder: this.appendShare(this.state.identity?.peerId),
    });
    this.session.broadcast({ type: "media-meta", sharingScreen: true });
    this.openScreenToAll();
  }

  async stopScreenShare() {
    for (const call of this.screenOut.values()) {
      call.close();
    }
    this.screenOut.clear();
    this.screenTrack?.stop();
    this.screenTrack = null;
    this.session.patch({
      sharingScreen: false,
      localScreenStream: null,
      screenShareOrder: this.removeShare(this.state.identity?.peerId),
    });
    this.session.broadcast({ type: "media-meta", sharingScreen: false });
  }

  private async ensureLocalStream() {
    if (this.state.localStream) {
      return this.state.localStream;
    }
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
    this.session.patch({ localStream: media.stream, cameraOff, muted });
    this.rememberCamera(media.stream);
    void this.refreshCameraSwitch();
    if (media.fallback === "audio") {
      this.session.toast("toast.mediaAudioOnly");
    } else if (media.fallback === "video") {
      this.session.toast("toast.mediaVideoOnly");
    } else if (media.fallback === "listen") {
      this.session.toast("toast.mediaListenOnly");
    }
    return media.stream;
  }

  disableCamera() {
    this.syncOutgoingTrack("video", this.heldPlaceholder());
    const audio = this.state.localStream?.getAudioTracks() ?? [];
    this.state.localStream?.getVideoTracks().forEach((track) => track.stop());
    this.session.patch({ cameraOff: true, localStream: mediaStreamOf(audio) });
    this.session.broadcast({ type: "media-meta", cameraOff: true });
  }

  private async enableCamera() {
    if (this.session.room.selfLocked("video")) {
      return;
    }
    let fresh: MediaStream;
    try {
      fresh = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: this.cameraVideoRequest(),
      });
    } catch {
      this.session.toast("toast.mediaCamera");
      return;
    }
    const video = fresh.getVideoTracks()[0];
    if (!video) {
      return;
    }
    this.rememberCamera(fresh);
    await this.replaceCameraTrack(video);
  }

  private cameraVideoBase(): MediaTrackConstraints {
    const video = getCameraConstraints().video;
    return typeof video === "object" && video ? { ...video } : {};
  }

  private cameraVideoRequest(): MediaTrackConstraints {
    const video = this.cameraVideoBase();
    if (this.cameraDeviceId) {
      video.deviceId = { ideal: this.cameraDeviceId };
    }
    return video;
  }

  private rememberCamera(stream: MediaStream) {
    const id = stream.getVideoTracks()[0]?.getSettings?.().deviceId;
    if (id) {
      this.cameraDeviceId = id;
    }
  }

  private async replaceCameraTrack(video: MediaStreamTrack) {
    await applyTrackConstraints(mediaStreamOf([video]), "camera");
    const audio = this.state.localStream?.getAudioTracks() ?? [];
    this.state.localStream?.getVideoTracks().forEach((track) => track.stop());
    const stream = mediaStreamOf([...audio, video]);
    this.syncOutgoingTrack("video", video);
    this.placeholderVideo?.stop();
    this.placeholderVideo = null;
    this.session.patch({ cameraOff: false, localStream: stream });
    this.session.broadcast({ type: "media-meta", cameraOff: false });
    this.applyLimitsToAll();
    window.setTimeout(() => this.applyLimitsToAll(), 400);
    void this.refreshCameraSwitch();
  }

  private onDeviceChange = () => {
    void this.refreshCameraSwitch();
  };

  watchDevices() {
    const md = navigator.mediaDevices;
    if (!md?.addEventListener) {
      return;
    }
    md.removeEventListener("devicechange", this.onDeviceChange);
    md.addEventListener("devicechange", this.onDeviceChange);
  }

  private async refreshCameraSwitch() {
    let n = 0;
    try {
      n =
        (await navigator.mediaDevices?.enumerateDevices?.())
          ?.filter((d) => d.kind === "videoinput")
          ?.filter((d) => Boolean(facingFromLabel(d.label)))?.length ?? 0;
    } catch {
      n = 0;
    }
    const canSwitchCamera = n >= 2;
    if (canSwitchCamera !== this.state.canSwitchCamera) {
      this.session.patch({ canSwitchCamera });
    }
  }

  private async enableMic() {
    if (this.session.room.selfLocked("audio")) {
      return;
    }
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
      this.session.toast("toast.mediaMic");
      return;
    }
    const audio = fresh.getAudioTracks()[0];
    if (!audio) {
      this.session.toast("toast.mediaMic");
      return;
    }
    this.state.localStream?.getAudioTracks().forEach((track) => track.stop());
    const video = this.state.localStream?.getVideoTracks() ?? [];
    const stream = mediaStreamOf([audio, ...video]);
    this.syncOutgoingTrack("audio", audio);
    this.session.patch({ muted: false, localStream: stream });
  }

  private syncOutgoingTrack(
    kind: "audio" | "video",
    track: MediaStreamTrack | null,
  ) {
    for (const call of this.session.calls.values()) {
      const pc = call.peerConnection;
      if (!pc) {
        continue;
      }
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

  private heldPlaceholder(): MediaStreamTrack | null {
    if (this.placeholderVideo?.readyState === "live") {
      return this.placeholderVideo;
    }
    this.placeholderVideo = placeholderVideoTrack();
    return this.placeholderVideo;
  }

  /**
   * Sempre manda uma faixa de vídeo. Sem m-line no offer, `replaceTrack`
   * depois não tem sender e o PeerJS não renegocia `addTrack`.
   */
  outboundStream() {
    const local = this.state.localStream;
    const audio = local?.getAudioTracks() ?? [];
    const live = !this.state.cameraOff
      ? local?.getVideoTracks().find((track) => track.readyState === "live")
      : undefined;
    const video = live ?? this.heldPlaceholder();
    return mediaStreamOf(video ? [...audio, video] : audio);
  }

  openScreen(peerId: string) {
    const stream = this.state.localScreenStream;
    if (!this.session.peer || this.screenOut.has(peerId) || !stream) {
      return;
    }
    const call = this.session.peer.call(peerId, stream, {
      metadata: this.session.signalMeta({ kind: "screen" }),
    });
    this.screenOut.set(peerId, call);
    call.on("close", () => this.screenOut.delete(peerId));
    call.on("error", () => this.screenOut.delete(peerId));
    window.setTimeout(() => this.applyLimitsToAll(), 400);
  }

  private openScreenToAll() {
    const ids = new Set<string>([
      ...this.session.data.keys(),
      ...this.session.calls.keys(),
      ...this.state.remotes.map((r) => r.peerId),
    ]);
    for (const peerId of ids) {
      if (peerId === this.state.identity?.peerId) {
        continue;
      }
      if (this.session.room.notAdmitted(peerId)) {
        continue;
      }
      this.openScreen(peerId);
    }
  }

  attachIncomingScreen(call: MediaConnection) {
    const previous = this.screenIn.get(call.peer);
    this.screenIn.set(call.peer, call);
    previous?.close();
    call.on("stream", (stream) => {
      this.session.upsertRemote(call.peer, {
        screenStream: stream,
        sharingScreen: true,
      });
      this.rememberShare(call.peer);
    });
    call.on("close", () => this.dropIncomingScreen(call));
    call.on("error", () => this.dropIncomingScreen(call));
  }

  private dropIncomingScreen(call: MediaConnection) {
    if (this.screenIn.get(call.peer) !== call) {
      return;
    }
    this.screenIn.delete(call.peer);
    if (!this.state.remotes.some((r) => r.peerId === call.peer)) {
      return;
    }
    this.session.upsertRemote(call.peer, {
      screenStream: null,
      sharingScreen: false,
    });
    this.forgetShare(call.peer);
  }

  private clearRemoteScreen(peerId: string) {
    const call = this.screenIn.get(peerId);
    this.screenIn.delete(peerId);
    if (call) {
      call.close();
    }
    if (!this.state.remotes.some((r) => r.peerId === peerId)) {
      return;
    }
    this.session.upsertRemote(peerId, {
      screenStream: null,
      sharingScreen: false,
    });
    this.forgetShare(peerId);
  }

  private appendShare(peerId: string | undefined) {
    if (!peerId) {
      return this.state.screenShareOrder;
    }
    if (this.state.screenShareOrder.includes(peerId)) {
      return this.state.screenShareOrder;
    }
    return [...this.state.screenShareOrder, peerId];
  }

  removeShare(peerId: string | undefined) {
    if (!peerId) {
      return this.state.screenShareOrder;
    }
    return this.state.screenShareOrder.filter((id) => id !== peerId);
  }

  rememberShare(peerId: string) {
    const screenShareOrder = this.appendShare(peerId);
    if (screenShareOrder === this.state.screenShareOrder) {
      return;
    }
    this.session.patch({ screenShareOrder });
  }

  private forgetShare(peerId: string) {
    const screenShareOrder = this.removeShare(peerId);
    if (screenShareOrder.length === this.state.screenShareOrder.length) {
      return;
    }
    this.session.patch({ screenShareOrder });
  }

  applyLimitsToAll() {
    for (const call of this.session.calls.values()) {
      const pc = call.peerConnection;
      if (!pc) {
        continue;
      }
      for (const sender of pc.getSenders()) {
        void applySenderLimits(sender, "camera");
      }
    }
    for (const call of this.screenOut.values()) {
      const pc = call.peerConnection;
      if (!pc) {
        continue;
      }
      for (const sender of pc.getSenders()) {
        void applySenderLimits(sender, "screen");
      }
    }
  }
}
