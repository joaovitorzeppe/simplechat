import { useEffect, type RefObject } from "react";
import { getAudioContext } from "./sounds";
import { rmsFromTimeDomain, smoothSpeak } from "./speak-level";

const writeSpeak = (node: HTMLElement | null, value: number) => {
  node?.style.setProperty("--speak", value.toFixed(3));
};

type Entry = {
  stream: MediaStream;
  node: HTMLElement;
  clones: MediaStreamTrack[];
  source: MediaStreamAudioSourceNode | null;
  analyser: AnalyserNode | null;
  data: Uint8Array<ArrayBuffer> | null;
  prev: number;
  onTrack: (event: MediaStreamTrackEvent) => void;
};

/**
 * Um rAF e um AudioContext para todas as tiles. Cada tile só registra o
 * stream; o tick único atualiza `--speak` sem N loops paralelos.
 */
class SpeakBus {
  private entries = new Map<object, Entry>();
  private raf = 0;
  private mute: GainNode | null = null;

  watch(
    key: object,
    stream: MediaStream,
    node: HTMLElement,
  ) {
    this.unwatch(key);
    const entry: Entry = {
      stream,
      node,
      clones: [],
      source: null,
      analyser: null,
      data: null,
      prev: 0,
      onTrack: (event) => {
        if (event.track.kind === "audio") {
          this.rebuild(entry);
        }
      },
    };
    this.entries.set(key, entry);
    stream.addEventListener("addtrack", entry.onTrack);
    stream.addEventListener("removetrack", entry.onTrack);
    this.rebuild(entry);
    this.kick();
  }

  unwatch(key: object) {
    const entry = this.entries.get(key);
    if (!entry) {
      return;
    }
    entry.stream.removeEventListener("addtrack", entry.onTrack);
    entry.stream.removeEventListener("removetrack", entry.onTrack);
    this.teardown(entry);
    writeSpeak(entry.node, 0);
    this.entries.delete(key);
    if (this.entries.size === 0) {
      window.cancelAnimationFrame(this.raf);
      this.raf = 0;
      this.mute?.disconnect();
      this.mute = null;
    }
  }

  private rebuild(entry: Entry) {
    this.teardown(entry);
    const lives = entry.stream
      .getAudioTracks()
      .filter((track) => track.readyState === "live");
    if (!lives.length) {
      writeSpeak(entry.node, 0);
      return;
    }
    const ctx = getAudioContext();
    if (!ctx) {
      return;
    }
    try {
      entry.clones = lives.map((track) => track.clone());
    } catch {
      entry.clones = [];
    }
    const audioStream = new MediaStream(
      entry.clones.length ? entry.clones : lives,
    );
    try {
      entry.source = ctx.createMediaStreamSource(audioStream);
    } catch {
      writeSpeak(entry.node, 0);
      return;
    }
    entry.analyser = ctx.createAnalyser();
    entry.analyser.fftSize = 512;
    entry.analyser.smoothingTimeConstant = 0.12;
    // ponytail: um Gain mudo compartilhado só pra manter o grafo vivo sem
    // ouvir o clone; se o browser começar a otimizar nós órfãos, ligar
    // destination por entry de novo.
    this.mute ??= (() => {
      const gain = ctx.createGain();
      gain.gain.value = 0;
      gain.connect(ctx.destination);
      return gain;
    })();
    entry.source.connect(entry.analyser);
    entry.analyser.connect(this.mute);
    entry.data = new Uint8Array(entry.analyser.fftSize);
    entry.prev = 0;
  }

  private teardown(entry: Entry) {
    entry.source?.disconnect();
    entry.analyser?.disconnect();
    entry.source = null;
    entry.analyser = null;
    entry.data = null;
    for (const track of entry.clones) {
      track.stop();
    }
    entry.clones = [];
  }

  private kick() {
    if (this.raf || this.entries.size === 0) {
      return;
    }
    const tick = () => {
      this.raf = 0;
      if (this.entries.size === 0) {
        return;
      }
      for (const entry of this.entries.values()) {
        if (!entry.analyser || !entry.data) {
          writeSpeak(entry.node, 0);
          continue;
        }
        const open = entry.stream
          .getAudioTracks()
          .some((track) => track.enabled && track.readyState === "live");
        if (!open) {
          entry.prev = smoothSpeak(0, entry.prev);
          writeSpeak(entry.node, entry.prev);
          continue;
        }
        entry.analyser.getByteTimeDomainData(entry.data);
        entry.prev = smoothSpeak(rmsFromTimeDomain(entry.data), entry.prev);
        writeSpeak(entry.node, entry.prev);
      }
      this.raf = window.requestAnimationFrame(tick);
    };
    this.raf = window.requestAnimationFrame(tick);
  }
}

const bus = new SpeakBus();

/**
 * Lê o microfone do stream e escreve `--speak` (0–1) no elemento, sem
 * re-render. A borda da tile reage no CSS.
 */
export const useSpeakLevel = (
  stream: MediaStream | null,
  enabled: boolean,
  target: RefObject<HTMLElement | null>,
) => {
  const key = target;
  useEffect(() => {
    const node = target.current;
    if (!stream || !enabled || !node) {
      writeSpeak(node, 0);
      return;
    }
    bus.watch(key, stream, node);
    return () => bus.unwatch(key);
  }, [stream, enabled, target, key]);
};
