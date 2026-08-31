import { describe, expect, it, vi } from "vitest";
import { acquireLocalMedia } from "../src/lib/media-access";

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
