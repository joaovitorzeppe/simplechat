import { describe, expect, it, vi } from "vitest";
import {
  applySenderLimits,
  applyTrackConstraints,
  getDisplayConstraints,
  LIMITS,
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

  it("pede tela nativa, sem downscale", () => {
    expect(getDisplayConstraints().video).toEqual({
      frameRate: { ideal: 30, max: 30 },
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
    expect(params.encodings[0].maxBitrate).toBe(8_000_000);
  });
});
