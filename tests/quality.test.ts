import { afterEach, describe, expect, it } from "vitest";
import {
  canBlurBackground,
  canSendFiles,
  currentTier,
  setDemoTier,
} from "@libs/quality";

describe("canSendFiles", () => {
  afterEach(() => {
    localStorage.removeItem("simplechat.demoTier");
  });

  it("bloqueia no plano gratuito", () => {
    setDemoTier("free");
    expect(currentTier()).toBe("free");
    expect(canSendFiles()).toBe(false);
    expect(canBlurBackground()).toBe(false);
  });

  it("libera no plano Pro", () => {
    setDemoTier("pro");
    expect(canSendFiles()).toBe(true);
    expect(canBlurBackground()).toBe(true);
  });
});
