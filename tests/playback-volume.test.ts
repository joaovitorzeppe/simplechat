import { describe, expect, it } from "vitest";
import {
  getPlaybackVolume,
  playbackKey,
  setPlaybackVolume,
} from "@libs/playback-volume";

describe("volume local", () => {
  it("separa câmera e tela e limita entre 0 e 1", () => {
    const camera = playbackKey("ana", false);
    const screen = playbackKey("ana", true);
    expect(camera).not.toBe(screen);
    setPlaybackVolume(camera, 0.4);
    setPlaybackVolume(screen, 2);
    expect(getPlaybackVolume(camera)).toBe(0.4);
    expect(getPlaybackVolume(screen)).toBe(1);
    setPlaybackVolume(screen, -1);
    expect(getPlaybackVolume(screen)).toBe(0);
  });
});
