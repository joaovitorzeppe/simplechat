import type { DataConnection } from "peerjs";
import { t } from "@i18n/i18n";
import { safeFileName } from "./chat";
import { FILE_CHUNK } from "./file-assembly";
import { clearAllFileProgress, setFileProgress } from "./file-progress";
import { FileBridge } from "./file-transfer";
import { maxFileBytes } from "./quality";
import type { PeerSession } from "./session";
import { showToast } from "./toast";
import type { ChatFile, ChatMessage, WireMessage } from "./types";

const FILE_BUFFER_HIGH = 2_000_000;
const MAX_CONCURRENT_INCOMING = 3;
const FILE_START_COOLDOWN = 2000;
const FILE_SEND_CONCURRENCY = 3;

/** Arquivos do chat: envio em fatias com contrapressão e recepção por peer. */
export class SessionFiles {
  private readonly session: PeerSession;

  constructor(session: PeerSession) {
    this.session = session;
  }

  private get state() {
    return this.session.getState();
  }

  private sendingFile = false;
  bridge = new FileBridge();
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

  forget(peerId: string) {
    this.failIncomingFile(peerId);
    this.lastFileStart.delete(peerId);
  }

  reset() {
    this.incomingFiles.clear();
    this.incomingByteTail.clear();
    this.lastFileStart.clear();
    this.sendingFile = false;
    void this.bridge.abortAll();
    clearAllFileProgress();
    this.revokeMessageFiles();
  }

  async sendFile(file: File) {
    const me = this.state.identity;
    if (!me || !this.session.inRoom() || this.session.tearingDown) {
      return;
    }
    if (this.sendingFile) {
      this.session.toast("toast.fileBusy");
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
    this.session.chat.appendMessage(message);
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
      const peers = this.session.activeConnections();
      if (peers.length === 0) {
        setFileProgress(id, 1);
        this.patchFile(id, { status: "ready" });
        return;
      }
      for (const conn of peers) {
        void conn.send(start);
      }
      await this.bridge.openSend(id, file);

      // Cada peer avança no seu próprio ritmo: um destinatário congestionado
      // atrasa só a própria cópia, e o progresso mostrado é o do mais lento.
      const sent = new Map<DataConnection, number>();
      const report = () => {
        let slowest = file.size;
        for (const conn of peers) {
          slowest = Math.min(slowest, sent.get(conn) ?? 0);
        }
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
        this.session.toast("toast.fileFailed");
        return;
      }
      setFileProgress(id, 1);
      this.patchFile(id, { status: "ready" });
      if (ok < peers.length) {
        this.session.toast("toast.filePartial");
      }
    } catch {
      this.patchFile(id, { status: "error" });
      this.session.toast("toast.fileFailed");
    } finally {
      this.sendingFile = false;
      void this.bridge.closeSend(id);
    }
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
      if (this.session.tearingDown) {
        throw new Error("ended");
      }
      await this.waitForFileBuffer(conn);
      if (!conn.open) {
        return false;
      }
      const chunk = await this.bridge.readSlice(id, offset, FILE_CHUNK);
      void conn.send(chunk);
      sent.set(conn, offset + chunk.byteLength);
      report();
    }
    // oxlint-enable no-await-in-loop
    if (!conn.open) {
      return false;
    }
    void conn.send({ type: "file-end", id });
    return true;
  }

  private async mapLimited<T, R>(
    items: T[],
    limit: number,
    fn: (item: T) => Promise<R>,
  ): Promise<R[]> {
    const results: R[] = [];
    let next = 0;
    const workers = Array.from(
      { length: Math.min(limit, items.length) },
      async () => {
        while (next < items.length) {
          const index = next;
          next += 1;
          // Pool de `limit` workers: cada um processa um item por vez.
          // oxlint-disable-next-line no-await-in-loop
          results[index] = await fn(items[index]);
        }
      },
    );
    await Promise.all(workers);
    return results;
  }

  private waitForFileBuffer(conn: DataConnection) {
    const dc = conn.dataChannel;
    if (!dc || dc.bufferedAmount < FILE_BUFFER_HIGH) {
      return Promise.resolve();
    }
    const low = FILE_BUFFER_HIGH / 4;
    return new Promise<void>((resolve) => {
      // O evento não dispara se o canal fechar no meio da drenagem, daí a
      // verificação periódica de segurança em paralelo.
      const guard = window.setInterval(() => {
        if (!conn.open || dc.bufferedAmount < low) {
          settle();
        }
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
    if (raw instanceof ArrayBuffer) {
      return raw;
    }
    if (ArrayBuffer.isView(raw)) {
      const view = new Uint8Array(raw.buffer, raw.byteOffset, raw.byteLength);
      const copy = new Uint8Array(view.byteLength);
      copy.set(view);
      return copy.buffer;
    }
    if (typeof Blob !== "undefined" && raw instanceof Blob) {
      return raw;
    }
    return null;
  }

  onFileBytes(conn: DataConnection, raw: unknown) {
    const data = this.takeFileBytes(raw);
    if (!data) {
      return false;
    }
    if (!this.incomingFiles.has(conn.peer)) {
      return true;
    }
    // O remetente fatia em FILE_CHUNK. Pedaço maior é abuso de memória.
    const bytes = data instanceof Blob ? data.size : data.byteLength;
    if (bytes > FILE_CHUNK) {
      this.failIncomingFile(conn.peer);
      return true;
    }
    this.queueIncoming(conn.peer, data);
    return true;
  }

  private queueIncoming(peerId: string, data: ArrayBuffer | Blob) {
    const prev = this.incomingByteTail.get(peerId) ?? Promise.resolve();
    const next = prev
      .then(async () => {
        const incoming = this.incomingFiles.get(peerId);
        if (!incoming) {
          return;
        }
        const received = await this.bridge.push(peerId, data);
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

  /**
   * O anúncio do remetente não reserva memória: os bytes só são guardados à
   * medida que chegam, e um teto global cobre o caso de vários peers hostis
   * transmitindo ao mesmo tempo.
   */
  beginIncomingFile(
    peerId: string,
    msg: Extract<WireMessage, { type: "file-start" }>,
  ) {
    if (!this.session.room.isKnownPeer(peerId)) {
      return;
    }

    const now = Date.now();
    const previous = this.lastFileStart.get(peerId) ?? 0;
    if (now - previous < FILE_START_COOLDOWN) {
      return;
    }
    this.lastFileStart.set(peerId, now);

    if (this.incomingFiles.has(peerId)) {
      this.failIncomingFile(peerId);
    }
    if (this.incomingFiles.size >= MAX_CONCURRENT_INCOMING) {
      return;
    }

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
          this.bridge.openReceive({
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
    this.session.chat.appendMessage({
      id: localId,
      fromPeerId: peerId,
      fromName: this.session.names.get(peerId) ?? t("common.someone"),
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

  finishIncomingFile(peerId: string, remoteId: string) {
    const tail = this.incomingByteTail.get(peerId) ?? Promise.resolve();
    const done = tail.then(async () => {
      const incoming = this.incomingFiles.get(peerId);
      if (!incoming || incoming.remoteId !== remoteId) {
        return;
      }
      this.incomingFiles.delete(peerId);
      try {
        const blob = await this.bridge.finish(peerId);
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
    this.incomingByteTail.set(peerId, done);
  }

  /**
   * O abort entra na fila do peer em vez de furá-la: bytes já enfileirados do
   * arquivo que falhou não podem cair no próximo `openReceive`.
   */
  failIncomingFile(peerId: string) {
    const incoming = this.incomingFiles.get(peerId);
    this.incomingFiles.delete(peerId);
    const tail = this.incomingByteTail.get(peerId) ?? Promise.resolve();
    this.incomingByteTail.set(
      peerId,
      tail.then(() => this.bridge.abort(peerId)).catch(() => {}),
    );
    if (incoming) {
      this.patchFile(incoming.localId, { status: "error" });
    }
  }

  private patchFile(id: string, file: Partial<ChatFile>) {
    this.session.patch({
      messages: this.state.messages.map((message) => {
        if (message.id !== id || !message.file) {
          return message;
        }
        return { ...message, file: { ...message.file, ...file } };
      }),
    });
  }

  private revokeMessageFiles() {
    for (const message of this.state.messages) {
      if (!message.file) {
        continue;
      }
      if (message.file.blobUrl) {
        URL.revokeObjectURL(message.file.blobUrl);
      }
      void this.bridge.release(message.file.id);
    }
  }
}
