export const FILE_CHUNK = 16 * 1024;
export const MAX_INCOMING_BYTES = 150 * 1024 * 1024;

export type IncomingMeta = {
  peerId: string;
  remoteId: string;
  localId: string;
  mime: string;
  size: number;
};

/**
 * Acumula os bytes de um arquivo recebido. Prefere o OPFS para não reter
 * dezenas de megabytes na RAM; se o disco privado não existir, cai para um
 * array de pedaços — o mesmo contrato, só muda onde os bytes dormem.
 */
export class IncomingBuffer {
  received = 0;
  readonly meta: IncomingMeta;
  private chunks: Uint8Array[] = [];
  private writable: FileSystemWritableFileStream | null = null;
  private handle: FileSystemFileHandle | null = null;
  private opfsName: string | null = null;
  private readonly ready: Promise<void>;

  constructor(meta: IncomingMeta) {
    this.meta = meta;
    this.ready = this.open();
  }

  private async open() {
    try {
      const storage = navigator.storage;
      if (!storage?.getDirectory) return;
      const root = await storage.getDirectory();
      this.opfsName = `sc-file-${this.meta.localId}`;
      this.handle = await root.getFileHandle(this.opfsName, { create: true });
      this.writable = await this.handle.createWritable();
    } catch {
      this.writable = null;
      this.handle = null;
      this.opfsName = null;
    }
  }

  async push(data: ArrayBuffer | Blob, heldTotal: number) {
    await this.ready;
    const bytes =
      data instanceof Blob
        ? new Uint8Array(await data.arrayBuffer())
        : new Uint8Array(data);
    const next = this.received + bytes.byteLength;
    if (next > this.meta.size || heldTotal + bytes.byteLength > MAX_INCOMING_BYTES) {
      return false;
    }
    if (this.writable) await this.writable.write(bytes);
    else this.chunks.push(bytes);
    this.received = next;
    return true;
  }

  async finish() {
    await this.ready;
    if (this.received !== this.meta.size) {
      await this.dispose();
      return null;
    }
    if (this.writable && this.handle) {
      await this.writable.close();
      this.writable = null;
      // File do OPFS: o blob URL pode apontar pro disco. Quem chama é
      // responsável por dispose() depois de soltar o URL (release/abortAll).
      const file = await this.handle.getFile();
      this.chunks = [];
      return file;
    }
    return new Blob(this.chunks as BlobPart[], { type: this.meta.mime });
  }

  async dispose() {
    try {
      if (this.writable) await this.writable.abort();
    } catch {
      // já fechado ou nunca chegou a abrir
    }
    this.writable = null;
    this.chunks = [];
    if (!this.opfsName) return;
    try {
      const root = await navigator.storage.getDirectory();
      await root.removeEntry(this.opfsName);
    } catch {
      // sumiu sozinho ou o OPFS não está disponível
    }
    this.handle = null;
    this.opfsName = null;
  }
}

export const readFileSlice = (file: File, offset: number, length: number) => {
  return file.slice(offset, offset + length).arrayBuffer();
};
