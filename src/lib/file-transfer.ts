import {
  IncomingBuffer,
  readFileSlice,
  type IncomingMeta,
} from "./file-assembly";

type WorkerOk = { buffer?: ArrayBuffer; blob?: Blob; received?: number };

/**
 * RTCDataChannel e o PeerJS vivem na thread da UI — o canal não é transferível.
 * O worker entra só onde o custo é CPU e memória: fatiar o File no envio e
 * montar o Blob na recepção (de preferência no OPFS). Sem Worker, o mesmo
 * código roda aqui; os testes e o Safari antigo caem nisso automaticamente.
 */
export class FileBridge {
  private worker: Worker | null = null;
  private seq = 1;
  private pending = new Map<
    number,
    { resolve: (value: WorkerOk) => void; reject: (error: Error) => void }
  >();
  private sends = new Map<string, File>();
  private recvs = new Map<string, IncomingBuffer>();

  constructor() {
    this.worker = this.spawn();
  }

  private spawn() {
    if (typeof Worker === "undefined") return null;
    if (import.meta.env.MODE === "test") return null;
    try {
      const worker = new Worker(new URL("./file-worker.ts", import.meta.url), {
        type: "module",
      });
      worker.addEventListener("message", (event: MessageEvent) => {
        const data = event.data as
          | { id: number; type: "ok" } & WorkerOk
          | { id: number; type: "err"; message: string };
        const pending = this.pending.get(data.id);
        if (!pending) return;
        this.pending.delete(data.id);
        if (data.type === "err") pending.reject(new Error(data.message));
        else pending.resolve(data);
      });
      worker.addEventListener("error", () => this.dropWorker());
      worker.addEventListener("messageerror", () => this.dropWorker());
      return worker;
    } catch {
      return null;
    }
  }

  private dropWorker() {
    for (const pending of this.pending.values()) {
      pending.reject(new Error("worker"));
    }
    this.pending.clear();
    this.worker?.terminate();
    this.worker = null;
  }

  private request(
    message: Record<string, unknown>,
    transfer: Transferable[] = [],
  ) {
    const worker = this.worker;
    if (!worker) return null;
    const id = this.seq++;
    return new Promise<WorkerOk>((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      worker.postMessage({ ...message, id }, transfer);
    });
  }

  private held() {
    let total = 0;
    for (const incoming of this.recvs.values()) total += incoming.received;
    return total;
  }

  async openSend(fileId: string, file: File) {
    const remote = this.request({ type: "send-open", fileId, file });
    if (remote) {
      await remote;
      return;
    }
    this.sends.set(fileId, file);
  }

  async readSlice(fileId: string, offset: number, length: number) {
    const remote = this.request({ type: "send-slice", fileId, offset, length });
    if (remote) {
      const result = await remote;
      if (!result.buffer) throw new Error("empty slice");
      return result.buffer;
    }
    const file = this.sends.get(fileId);
    if (!file) throw new Error("missing send");
    return readFileSlice(file, offset, length);
  }

  async closeSend(fileId: string) {
    const remote = this.request({ type: "send-close", fileId });
    if (remote) {
      await remote.catch(() => undefined);
      return;
    }
    this.sends.delete(fileId);
  }

  async openReceive(meta: IncomingMeta) {
    const remote = this.request({ type: "recv-open", meta });
    if (remote) {
      await remote;
      return;
    }
    await this.recvs.get(meta.peerId)?.dispose();
    this.recvs.set(meta.peerId, new IncomingBuffer(meta));
  }

  async push(peerId: string, data: ArrayBuffer | Blob) {
    const transfer = data instanceof ArrayBuffer ? [data] : [];
    const remote = this.request(
      {
        type: "recv-push",
        peerId,
        ...(data instanceof ArrayBuffer ? { buffer: data } : { blob: data }),
      },
      transfer,
    );
    if (remote) {
      const result = await remote;
      return result.received ?? 0;
    }
    const incoming = this.recvs.get(peerId);
    if (!incoming) return null;
    const ok = await incoming.push(data, this.held());
    return ok ? incoming.received : null;
  }

  async finish(peerId: string) {
    const remote = this.request({ type: "recv-finish", peerId });
    if (remote) {
      const result = await remote;
      return result.blob ?? null;
    }
    const incoming = this.recvs.get(peerId);
    this.recvs.delete(peerId);
    return incoming ? incoming.finish() : null;
  }

  async abort(peerId: string) {
    const remote = this.request({ type: "recv-abort", peerId });
    if (remote) {
      await remote.catch(() => undefined);
      return;
    }
    await this.recvs.get(peerId)?.dispose();
    this.recvs.delete(peerId);
  }

  async abortAll() {
    const remote = this.request({ type: "abort-all" });
    if (remote) {
      await remote.catch(() => undefined);
      this.sends.clear();
      return;
    }
    await Promise.all(
      [...this.recvs.values()].map((incoming) => incoming.dispose()),
    );
    this.recvs.clear();
    this.sends.clear();
  }
}
