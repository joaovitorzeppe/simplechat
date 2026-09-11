import { describe, expect, it, vi } from "vitest";
import {
  acquireLocalMedia,
  canShareScreen,
  nextCameraFlip,
  placeholderVideoTrack,
} from "@libs/media-access";

const track = (kind: "audio" | "video") =>
  ({
    kind,
    enabled: true,
    readyState: "live",
    stop: vi.fn(),
  }) as unknown as MediaStreamTrack;

const streamOf = (...kinds: ("audio" | "video")[]) => {
  const tracks = kinds.map(track);
  return {
    getTracks: () => tracks,
    getAudioTracks: () => tracks.filter((item) => item.kind === "audio"),
    getVideoTracks: () => tracks.filter((item) => item.kind === "video"),
  } as unknown as MediaStream;
};

describe("acquireLocalMedia", () => {
  it("usa áudio e vídeo quando os dois vêm", async () => {
    const gum = vi.fn(async () => streamOf("audio", "video"));
    const media = await acquireLocalMedia(gum, { audio: true, video: true });
    expect(media.fallback).toBe("none");
    expect(media.cameraOff).toBe(false);
    expect(media.muted).toBe(false);
    expect(gum).toHaveBeenCalledOnce();
  });

  it("cai para só áudio se a câmera falhar", async () => {
    const gum = vi.fn(async (constraints: MediaStreamConstraints) => {
      if (constraints.video) throw new Error("sem camera");
      return streamOf("audio");
    });
    const media = await acquireLocalMedia(gum, { audio: true, video: true });
    expect(media.fallback).toBe("audio");
    expect(media.cameraOff).toBe(true);
    expect(media.muted).toBe(false);
    expect(media.stream.getAudioTracks()).toHaveLength(1);
    expect(media.stream.getVideoTracks()).toHaveLength(0);
  });

  it("cai para só vídeo se o microfone falhar", async () => {
    const gum = vi.fn(async (constraints: MediaStreamConstraints) => {
      if (constraints.audio) throw new Error("sem mic");
      return streamOf("video");
    });
    const media = await acquireLocalMedia(gum, { audio: true, video: true });
    expect(media.fallback).toBe("video");
    expect(media.cameraOff).toBe(false);
    expect(media.muted).toBe(true);
  });

  it("entra só ouvindo quando nada é permitido", async () => {
    const gum = vi.fn(async () => {
      throw new Error("negado");
    });
    const media = await acquireLocalMedia(gum, { audio: true, video: true });
    expect(media.fallback).toBe("listen");
    expect(media.cameraOff).toBe(true);
    expect(media.muted).toBe(true);
    expect(media.stream.getTracks?.() ?? []).toHaveLength(0);
  });

  it("para na hora se a permissão for negada", async () => {
    const gum = vi.fn(async () => {
      throw new DOMException("Permission denied", "NotAllowedError");
    });
    const media = await acquireLocalMedia(gum, { audio: true, video: true });
    expect(media.fallback).toBe("listen");
    expect(gum).toHaveBeenCalledOnce();
  });

  it("entra só ouvindo quando getUserMedia não existe", async () => {
    const media = await acquireLocalMedia(undefined, {
      audio: true,
      video: true,
    });
    expect(media.fallback).toBe("listen");
    expect(media.muted).toBe(true);
    expect(media.cameraOff).toBe(true);
  });

  it("aceita o primeiro stream mesmo se só tiver áudio", async () => {
    const gum = vi.fn(async () => streamOf("audio"));
    const media = await acquireLocalMedia(gum, { audio: true, video: true });
    expect(media.fallback).toBe("audio");
    expect(media.cameraOff).toBe(true);
    expect(gum).toHaveBeenCalledOnce();
  });
});

describe("placeholderVideoTrack", () => {
  it("é null sem captureStream", () => {
    expect(placeholderVideoTrack()).toBeNull();
  });

  it("devolve a faixa do canvas quando dá para capturar", () => {
    const proto = HTMLCanvasElement.prototype as HTMLCanvasElement & {
      captureStream?: (fps?: number) => MediaStream;
    };
    const prev = proto.captureStream;
    const ctx = HTMLCanvasElement.prototype.getContext;
    proto.captureStream = () => streamOf("video");
    HTMLCanvasElement.prototype.getContext = (() =>
      ({ fillRect() {} })) as unknown as typeof ctx;
    try {
      expect(placeholderVideoTrack()?.kind).toBe("video");
    } finally {
      proto.captureStream = prev;
      HTMLCanvasElement.prototype.getContext = ctx;
    }
  });
});

describe("canShareScreen", () => {
  it("é true quando getDisplayMedia existe", () => {
    expect(
      canShareScreen({
        getDisplayMedia: vi.fn(),
      } as unknown as MediaDevices),
    ).toBe(true);
  });

  it("é false sem mediaDevices ou sem getDisplayMedia", () => {
    expect(canShareScreen(undefined)).toBe(false);
    expect(canShareScreen({} as MediaDevices)).toBe(false);
  });
});

describe("nextCameraFlip", () => {
  const cam = (deviceId: string, label = "") => ({
    kind: "videoinput" as const,
    deviceId,
    label,
  });

  it("no iPhone só alterna frente e traseira, ignora extra traseira", () => {
    const iphone = [
      cam("front", "Front Camera"),
      cam("dual", "Back Dual Wide Camera"),
      cam("ultra", "Back Ultra Wide Camera"),
      cam("tele", "Back Telephoto Camera"),
    ];
    expect(
      nextCameraFlip(iphone, { deviceId: "front", facingMode: "user" }),
    ).toEqual({ facingMode: "environment" });
    expect(
      nextCameraFlip(iphone, { deviceId: "ultra", facingMode: "environment" }),
    ).toEqual({ facingMode: "user" });
    expect(
      nextCameraFlip(iphone, { deviceId: "tele", facingMode: "environment" }),
    ).toEqual({ facingMode: "user" });
  });

  it("usa o rótulo se facingMode não veio", () => {
    expect(
      nextCameraFlip(
        [cam("front", "Front Camera"), cam("back", "Back Camera")],
        { deviceId: "front" },
      ),
    ).toEqual({ facingMode: "environment" });
  });

  it("cicla id só quando não há frente/trás", () => {
    expect(nextCameraFlip([cam("a"), cam("b")], { deviceId: "a" })).toEqual({
      deviceId: "b",
    });
    expect(nextCameraFlip([cam("a"), cam("b")], { deviceId: "b" })).toEqual({
      deviceId: "a",
    });
  });

  it("é null com menos de duas câmeras", () => {
    expect(nextCameraFlip([cam("a")], { deviceId: "a" })).toBeNull();
  });
});
