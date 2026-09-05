import { describe, expect, it } from "vitest";
import {
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
    expect(LIMITS.screen).toMatchObject({
      width: 1920,
      height: 1080,
      frameRate: 30,
    });
  });
});
