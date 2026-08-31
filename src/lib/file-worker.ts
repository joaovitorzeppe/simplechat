import {
  IncomingBuffer,
  readFileSlice,
  type IncomingMeta,
} from "./file-assembly";

type InMessage =
  | { id: number; type: "send-open"; fileId: string; file: File }
  | {
      id: number;
      type: "send-slice";
      fileId: string;
      offset: number;
      length: number;
    }
  | { id: number; type: "send-close"; fileId: string }
  | { id: number; type: "recv-open"; meta: IncomingMeta }
  | {
      id: number;
      type: "recv-push";
      peerId: string;
      buffer?: ArrayBuffer;
      blob?: Blob;
    }
  | { id: number; type: "recv-finish"; peerId: string }
  | { id: number; type: "recv-abort"; peerId: string }
  | { id: number; type: "abort-all" };

type OutMessage =
  | { id: number; type: "ok"; buffer?: ArrayBuffer; blob?: Blob; received?: number }
  | { id: number; type: "err"; message: string };

const sends = new Map<string, File>();
const recvs = new Map<string, IncomingBuffer>();

const held = () => {
  let total = 0;
  for (const incoming of recvs.values()) total += incoming.received;
  return total;
};

const reply = (message: OutMessage, transfer: Transferable[] = []) => {
  self.postMessage(message, { transfer });
};

const onMessage = async (event: MessageEvent<InMessage>) => {
  const msg = event.data;
  try {
    switch (msg.type) {
      case "send-open":
        sends.set(msg.fileId, msg.file);
        reply({ id: msg.id, type: "ok" });
        return;
      case "send-slice": {
        const file = sends.get(msg.fileId);
        if (!file) throw new Error("missing send");
        const buffer = await readFileSlice(file, msg.offset, msg.length);
        reply({ id: msg.id, type: "ok", buffer }, [buffer]);
        return;
      }
      case "send-close":
        sends.delete(msg.fileId);
        reply({ id: msg.id, type: "ok" });
        return;
      case "recv-open":
        await recvs.get(msg.meta.peerId)?.dispose();
        recvs.set(msg.meta.peerId, new IncomingBuffer(msg.meta));
        reply({ id: msg.id, type: "ok" });
        return;
      case "recv-push": {
        const incoming = recvs.get(msg.peerId);
        if (!incoming) throw new Error("missing recv");
        const data = msg.buffer ?? msg.blob;
        if (!data) throw new Error("missing bytes");
        const ok = await incoming.push(data, held());
        if (!ok) throw new Error("overflow");
        reply({ id: msg.id, type: "ok", received: incoming.received });
        return;
      }
      case "recv-finish": {
        const incoming = recvs.get(msg.peerId);
        recvs.delete(msg.peerId);
        const blob = incoming ? await incoming.finish() : null;
        if (!blob) throw new Error("incomplete");
        reply({ id: msg.id, type: "ok", blob });
        return;
      }
      case "recv-abort":
        await recvs.get(msg.peerId)?.dispose();
        recvs.delete(msg.peerId);
        reply({ id: msg.id, type: "ok" });
        return;
      case "abort-all":
        await Promise.all([...recvs.values()].map((incoming) => incoming.dispose()));
        recvs.clear();
        sends.clear();
        reply({ id: msg.id, type: "ok" });
        return;
      default:
        throw new Error("unknown");
    }
  } catch (error) {
    reply({
      id: msg.id,
      type: "err",
      message: error instanceof Error ? error.message : "fail",
    });
  }
};

self.addEventListener("message", (event: MessageEvent<InMessage>) => {
  void onMessage(event);
});
