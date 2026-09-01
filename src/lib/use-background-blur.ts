import { useEffect, useState } from "react";
import {
  startBackgroundBlur,
  type BlurMode,
  type BlurPipeline,
} from "./background-blur";
import { showToast } from "./toast";

export const useBackgroundBlur = (
  source: MediaStream | null,
  enabled: boolean,
) => {
  const [processed, setProcessed] = useState<MediaStream | null>(null);
  const [mode, setMode] = useState<BlurMode | null>(null);
  const [fps, setFps] = useState(0);
  const [failed, setFailed] = useState(false);

  if (!enabled && failed) setFailed(false);

  const live = Boolean(
    source?.getVideoTracks().some((track) => track.readyState === "live"),
  );
  const active = enabled && Boolean(source) && live;
  const loading = active && !processed && !failed;

  useEffect(() => {
    if (!active || !source) return;

    let cancelled = false;
    let pipeline: BlurPipeline | null = null;
    let timer = 0;

    void startBackgroundBlur(source)
      .then((next) => {
        if (cancelled) {
          next.stop();
          return;
        }
        pipeline = next;
        setMode(next.mode);
        setProcessed(next.stream);
        if (next.mode === "canvas") {
          timer = window.setInterval(() => setFps(next.getFps()), 400);
        }
      })
      .catch(() => {
        if (cancelled) return;
        setFailed(true);
        showToast("toast.blurFailed");
      });

    return () => {
      cancelled = true;
      window.clearInterval(timer);
      pipeline?.stop();
      setProcessed(null);
      setMode(null);
      setFps(0);
    };
  }, [source, active]);

  return {
    stream: processed ?? source,
    mode: processed ? mode : null,
    fps: processed ? fps : 0,
    loading,
    failed,
  };
};
