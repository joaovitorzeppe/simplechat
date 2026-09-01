import type {
  ImageSegmenter,
  ImageSegmenterResult,
} from "@mediapipe/tasks-vision";
import {
  categoryToAlpha,
  confidenceToAlpha,
  fillWhiteAlpha,
  personConfidence,
} from "./mask-composite";

const SEG_MAX = 256;
const BLUR_SCALE = 0.25;
const WASM_FILES = "mediapipe/wasm";
const MODEL_FILE = "models/selfie_segmenter.tflite";

export type BlurMode = "native" | "canvas";

export type BlurPipeline = {
  stream: MediaStream;
  mode: BlurMode;
  getFps: () => number;
  stop: () => void;
};

type BlurTrack = MediaStreamTrack & {
  getCapabilities?: () => MediaTrackCapabilities & {
    backgroundBlur?: boolean | boolean[];
  };
};

type BlurConstraints = MediaTrackConstraints & { backgroundBlur?: boolean };

let segmenterPromise: Promise<ImageSegmenter> | null = null;

const assetUrl = (path: string) => {
  return new URL(path, `${window.location.origin}${import.meta.env.BASE_URL}`)
    .href;
};

const loadSegmenter = async (): Promise<ImageSegmenter> => {
  if (segmenterPromise) return segmenterPromise;
  segmenterPromise = (async () => {
    const { FilesetResolver, ImageSegmenter } = await import(
      "@mediapipe/tasks-vision"
    );
    const fileset = await FilesetResolver.forVisionTasks(assetUrl(WASM_FILES));
    const options = (delegate: "GPU" | "CPU") => ({
      baseOptions: {
        modelAssetPath: assetUrl(MODEL_FILE),
        delegate,
      },
      runningMode: "VIDEO" as const,
      outputCategoryMask: false,
      outputConfidenceMasks: true,
    });
    try {
      return await ImageSegmenter.createFromOptions(fileset, options("GPU"));
    } catch {
      return await ImageSegmenter.createFromOptions(fileset, options("CPU"));
    }
  })();
  try {
    return await segmenterPromise;
  } catch (error) {
    segmenterPromise = null;
    throw error;
  }
};

const closeMask = (mask?: { close: () => void }) => {
  try {
    mask?.close();
  } catch {
    // a task já pode ter liberado
  }
};

const alphaFromResult = (
  result: ImageSegmenterResult,
): {
  alpha: Uint8ClampedArray;
  width: number;
  height: number;
} | null => {
  const confidence = result.confidenceMasks;
  if (confidence && confidence.length > 0) {
    const { width, height } = confidence[0];
    const arrays = confidence.map((mask) => mask.getAsFloat32Array());
    const alpha = confidenceToAlpha(personConfidence(arrays));
    for (const mask of confidence) closeMask(mask);
    closeMask(result.categoryMask);
    return { alpha, width, height };
  }
  const category = result.categoryMask;
  if (!category) return null;
  const { width, height } = category;
  const alpha = categoryToAlpha(category.getAsUint8Array());
  closeMask(category);
  return { alpha, width, height };
};

const nativeBlurSupported = (track: BlurTrack): boolean => {
  const supported = navigator.mediaDevices.getSupportedConstraints() as Record<
    string,
    boolean
  >;
  if (supported.backgroundBlur) return true;
  const caps = track.getCapabilities?.();
  return caps?.backgroundBlur !== undefined;
};

const applyNativeBlur = async (
  track: BlurTrack,
  enabled: boolean,
): Promise<boolean> => {
  if (!nativeBlurSupported(track)) return false;
  try {
    await track.applyConstraints({ backgroundBlur: enabled } as BlurConstraints);
    const settings = track.getSettings() as { backgroundBlur?: boolean };
    if (settings.backgroundBlur === enabled) return true;
    if (enabled) {
      try {
        await track.applyConstraints({
          backgroundBlur: false,
        } as BlurConstraints);
      } catch {
        // segue para o pipeline em canvas
      }
    }
    return false;
  } catch {
    return false;
  }
};

const startNativeBlur = async (
  source: MediaStream,
  track: BlurTrack,
): Promise<BlurPipeline | null> => {
  if (!(await applyNativeBlur(track, true))) return null;
  return {
    stream: source,
    mode: "native",
    getFps: () => 0,
    stop: () => {
      void applyNativeBlur(track, false);
    },
  };
};

export const startBackgroundBlur = async (
  source: MediaStream,
): Promise<BlurPipeline> => {
  const videoTrack = source.getVideoTracks()[0] as BlurTrack | undefined;
  if (!videoTrack || videoTrack.readyState !== "live") {
    throw new Error("sem vídeo");
  }

  const native = await startNativeBlur(source, videoTrack);
  if (native) return native;

  const segmenter = await loadSegmenter();
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.autoplay = true;
  video.setAttribute("playsinline", "");
  video.srcObject = source;

  const host = document.createElement("div");
  host.setAttribute("aria-hidden", "true");
  host.style.cssText =
    "position:fixed;left:-9999px;top:0;width:160px;height:90px;overflow:hidden;pointer-events:none;opacity:0.01";
  video.style.width = "160px";
  video.style.height = "90px";

  const outCanvas = document.createElement("canvas");
  const personCanvas = document.createElement("canvas");
  const blurCanvas = document.createElement("canvas");
  const featherCanvas = document.createElement("canvas");
  const segCanvas = document.createElement("canvas");
  const maskCanvas = document.createElement("canvas");
  const outCtx = outCanvas.getContext("2d");
  const personCtx = personCanvas.getContext("2d");
  const blurCtx = blurCanvas.getContext("2d");
  const featherCtx = featherCanvas.getContext("2d");
  const segCtx = segCanvas.getContext("2d");
  const maskCtx = maskCanvas.getContext("2d");
  if (
    !outCtx ||
    !personCtx ||
    !blurCtx ||
    !featherCtx ||
    !segCtx ||
    !maskCtx
  ) {
    throw new Error("canvas");
  }

  host.append(video, outCanvas);
  document.body.append(host);
  await video.play();

  let running = true;
  let busy = false;
  let frames = 0;
  let fps = 0;
  let fpsStamp = performance.now();
  let lastTs = 0;
  let raf = 0;
  let maskImage: ImageData | null = null;
  const outStream = outCanvas.captureStream(30);
  const outTrack = outStream.getVideoTracks()[0];
  if (outTrack) outTrack.contentHint = "motion";

  const resize = () => {
    const vw = video.videoWidth;
    const vh = video.videoHeight;
    if (!vw || !vh) return false;
    if (outCanvas.width !== vw || outCanvas.height !== vh) {
      outCanvas.width = vw;
      outCanvas.height = vh;
      personCanvas.width = vw;
      personCanvas.height = vh;
      featherCanvas.width = vw;
      featherCanvas.height = vh;
      blurCanvas.width = Math.max(1, Math.round(vw * BLUR_SCALE));
      blurCanvas.height = Math.max(1, Math.round(vh * BLUR_SCALE));
      const scale = Math.min(1, SEG_MAX / Math.max(vw, vh));
      segCanvas.width = Math.max(1, Math.round(vw * scale));
      segCanvas.height = Math.max(1, Math.round(vh * scale));
    }
    return true;
  };

  const paint = (result: ImageSegmenterResult) => {
    const parsed = alphaFromResult(result);
    if (!parsed) return;
    const { alpha, width, height } = parsed;
    if (
      !maskImage ||
      maskCanvas.width !== width ||
      maskCanvas.height !== height
    ) {
      maskCanvas.width = width;
      maskCanvas.height = height;
      maskImage = maskCtx.createImageData(width, height);
    }
    fillWhiteAlpha(maskImage.data, alpha);
    maskCtx.putImageData(maskImage, 0, 0);

    const w = outCanvas.width;
    const h = outCanvas.height;
    const blurPx = Math.max(8, Math.round(w / 40));
    const smallBlur = Math.max(2, Math.round(blurPx * BLUR_SCALE));
    const featherPx = Math.max(4, Math.round(blurPx / 3));

    blurCtx.filter = `blur(${smallBlur}px)`;
    blurCtx.drawImage(video, 0, 0, blurCanvas.width, blurCanvas.height);
    blurCtx.filter = "none";
    outCtx.drawImage(blurCanvas, 0, 0, w, h);

    featherCtx.clearRect(0, 0, w, h);
    featherCtx.filter = `blur(${featherPx}px)`;
    featherCtx.drawImage(maskCanvas, 0, 0, w, h);
    featherCtx.filter = "none";

    personCtx.globalCompositeOperation = "copy";
    personCtx.drawImage(video, 0, 0, w, h);
    personCtx.globalCompositeOperation = "destination-in";
    personCtx.drawImage(featherCanvas, 0, 0);
    personCtx.globalCompositeOperation = "source-over";
    outCtx.drawImage(personCanvas, 0, 0);
    frames += 1;
  };

  const tick = (now: number) => {
    if (!running) return;
    if (document.visibilityState !== "visible") {
      schedule();
      return;
    }
    if (!resize()) {
      schedule();
      return;
    }
    if (!busy && video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
      const ts = now <= lastTs ? lastTs + 1 : now;
      lastTs = ts;
      busy = true;
      try {
        segCtx.drawImage(video, 0, 0, segCanvas.width, segCanvas.height);
        segmenter.segmentForVideo(segCanvas, ts, (result) => {
          try {
            if (running) paint(result);
          } finally {
            busy = false;
          }
        });
      } catch {
        busy = false;
      }
    }
    const elapsed = now - fpsStamp;
    if (elapsed >= 500) {
      fps = Math.round((frames * 1000) / elapsed);
      frames = 0;
      fpsStamp = now;
    }
    schedule();
  };

  const schedule = () => {
    if (!running) return;
    raf = window.requestAnimationFrame((now) => tick(now));
  };

  schedule();

  return {
    stream: outStream,
    mode: "canvas",
    getFps: () => fps,
    stop: () => {
      running = false;
      window.cancelAnimationFrame(raf);
      for (const track of outStream.getTracks()) track.stop();
      video.pause();
      video.srcObject = null;
      host.remove();
    },
  };
};
