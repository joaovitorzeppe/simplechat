import { useEffect, type RefObject } from "react";
import { getAudioContext } from "./sounds";
import { rmsFromTimeDomain, smoothSpeak } from "./speak-level";

const writeSpeak = (node: HTMLElement | null, value: number) => {
  node?.style.setProperty("--speak", value.toFixed(3));
};

/**
 * Lê o microfone do stream e escreve `--speak` (0–1) no elemento, sem
 * re-render. A borda da tile reage no CSS.
 */
export const useSpeakLevel = (
  stream: MediaStream | null,
  enabled: boolean,
  target: RefObject<HTMLElement | null>,
) => {
  useEffect(() => {
    const node = target.current;
    if (!stream || !enabled) {
      writeSpeak(node, 0);
      return;
    }

    let stopped = false;
    let raf = 0;
    let source: MediaStreamAudioSourceNode | null = null;
    let analyser: AnalyserNode | null = null;
    let clones: MediaStreamTrack[] = [];
    let prev = 0;
    let data: Uint8Array<ArrayBuffer> | null = null;
    let mute: GainNode | null = null;

    const teardownGraph = () => {
      window.cancelAnimationFrame(raf);
      raf = 0;
      source?.disconnect();
      analyser?.disconnect();
      mute?.disconnect();
      source = null;
      analyser = null;
      mute = null;
      for (const track of clones) track.stop();
      clones = [];
    };

    const start = () => {
      teardownGraph();
      if (stopped) return;
      const lives = stream
        .getAudioTracks()
        .filter((track) => track.readyState === "live");
      if (!lives.length) {
        writeSpeak(node, 0);
        return;
      }
      const ctx = getAudioContext();
      if (!ctx) return;
      try {
        clones = lives.map((track) => track.clone());
      } catch {
        clones = [];
      }
      const audioStream = new MediaStream(clones.length ? clones : lives);
      try {
        source = ctx.createMediaStreamSource(audioStream);
      } catch {
        writeSpeak(node, 0);
        return;
      }
      analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.12;
      mute = ctx.createGain();
      mute.gain.value = 0;
      source.connect(analyser);
      analyser.connect(mute);
      mute.connect(ctx.destination);
      data = new Uint8Array(analyser.fftSize);
      prev = 0;

      const tick = () => {
        if (stopped || !analyser || !data) return;
        const open = stream
          .getAudioTracks()
          .some((track) => track.enabled && track.readyState === "live");
        if (!open) {
          prev = smoothSpeak(0, prev);
          writeSpeak(node, prev);
          raf = window.requestAnimationFrame(tick);
          return;
        }
        analyser.getByteTimeDomainData(data);
        prev = smoothSpeak(rmsFromTimeDomain(data), prev);
        writeSpeak(node, prev);
        raf = window.requestAnimationFrame(tick);
      };
      raf = window.requestAnimationFrame(tick);
    };

    start();
    const onAudioChange = (event: MediaStreamTrackEvent) => {
      if (event.track.kind === "audio") start();
    };
    stream.addEventListener("addtrack", onAudioChange);
    stream.addEventListener("removetrack", onAudioChange);

    return () => {
      stopped = true;
      stream.removeEventListener("addtrack", onAudioChange);
      stream.removeEventListener("removetrack", onAudioChange);
      teardownGraph();
      writeSpeak(node, 0);
    };
  }, [stream, enabled, target]);
};
