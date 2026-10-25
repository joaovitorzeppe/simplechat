import { describe, expect, it, vi } from "vitest";
import {
  applySenderLimits,
  applyTrackConstraints,
  getDisplayConstraints,
  LIMITS,
  videoBitrate,
  MAX_FILE_BYTES,
  MAX_PARTICIPANTS,
  maxFileBytes,
  maxParticipants,
} from "@libs/quality";

describe("limites", () => {
  it("usa o teto único do sistema", () => {
    expect(MAX_PARTICIPANTS).toBe(12);
    expect(MAX_FILE_BYTES).toBe(100 * 1024 * 1024);
    expect(maxParticipants()).toBe(12);
    expect(maxFileBytes()).toBe(100 * 1024 * 1024);
    expect(LIMITS.camera).toMatchObject({
      width: 1280,
      height: 720,
      frameRate: 30,
    });
    expect(LIMITS.screen).toEqual({
      frameRate: 30,
      maxBitrate: 8_000_000,
    });
  });

  it("pede tela nativa, sem downscale, com áudio da aba ou do sistema", () => {
    expect(getDisplayConstraints()).toMatchObject({
      audio: true,
      systemAudio: "include",
      video: {
        frameRate: { ideal: 30, max: 30 },
      },
    });
  });

  it("marca track de tela como detalhe", async () => {
    const video = {
      kind: "video",
      contentHint: "",
      applyConstraints: vi.fn(async () => undefined),
    };
    const stream = {
      getVideoTracks: () => [video],
    } as unknown as MediaStream;
    await applyTrackConstraints(stream, "screen");
    expect(video.contentHint).toBe("detail");
    expect(video.applyConstraints).toHaveBeenCalledWith({
      frameRate: { ideal: 30, max: 30 },
    });
  });

  it("prioriza resolução no sender de tela", async () => {
    const params = { encodings: [{}] } as RTCRtpSendParameters;
    const sender = {
      track: { kind: "video" },
      getParameters: () => params,
      setParameters: vi.fn(async () => undefined),
    } as unknown as RTCRtpSender;
    await applySenderLimits(sender, "screen");
    expect(params.degradationPreference).toBe("maintain-resolution");
    expect(params.encodings[0].maxBitrate).toBe(12_000_000);
    expect(params.encodings[0].maxFramerate).toBe(30);
  });

  it("fluido baixa a resolução e pede 60 fps", async () => {
    expect(getDisplayConstraints("smooth").video).toMatchObject({
      width: { ideal: 1920 },
      height: { ideal: 1080 },
      frameRate: { ideal: 60, max: 60 },
    });
    const params = { encodings: [{}] } as RTCRtpSendParameters;
    const sender = {
      track: {
        kind: "video",
        getSettings: () => ({ width: 3840 }),
      },
      getParameters: () => params,
      setParameters: vi.fn(async () => undefined),
    } as unknown as RTCRtpSender;
    await applySenderLimits(sender, "screen", "smooth");
    expect(params.degradationPreference).toBe("maintain-framerate");
    expect(params.encodings[0].maxFramerate).toBe(60);
    expect(params.encodings[0].scaleResolutionDownBy).toBe(2);
    expect(params.encodings[0].maxBitrate).toBe(12_000_000);
  });

  it("sobe só a tela na dupla e divide a partir de três", () => {
    expect(videoBitrate("camera", 1)).toBe(2_500_000);
    expect(videoBitrate("screen", 1)).toBe(12_000_000);
    expect(videoBitrate("camera", 2)).toBe(1_250_000);
    expect(videoBitrate("screen", 2)).toBe(4_000_000);
    expect(videoBitrate("camera", 11)).toBe(400_000);
    expect(videoBitrate("screen", 11)).toBe(1_000_000);
  });

  it("dá prioridade alta ao microfone e deixa o áudio da tela como está", async () => {
    const sender = () => {
      const params = { encodings: [{}] } as RTCRtpSendParameters;
      return {
        params,
        sender: {
          track: { kind: "audio" },
          getParameters: () => params,
          setParameters: vi.fn(async () => undefined),
        } as unknown as RTCRtpSender,
      };
    };
    const mic = sender();
    await applySenderLimits(mic.sender, "camera", "sharp", 1);
    expect(mic.params.encodings[0]).toMatchObject({
      priority: "high",
      networkPriority: "high",
    });
    expect(mic.params.encodings[0].maxBitrate).toBeUndefined();
    const screenAudio = sender();
    await applySenderLimits(screenAudio.sender, "screen", "sharp", 1);
    expect(screenAudio.sender.setParameters).not.toHaveBeenCalled();
  });
});
