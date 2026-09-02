import { afterEach, describe, expect, it } from "vitest";
import { canSendFiles, currentTier, setDemoTier } from "@libs/quality";

describe("canSendFiles", () => {
  afterEach(() => {
    localStorage.removeItem("simplechat.demoTier");
  });

  it("bloqueia no plano gratuito", () => {
    setDemoTier("free");
    expect(currentTier()).toBe("free");
    expect(canSendFiles()).toBe(false);
  });

  it("libera no plano Pro", () => {
    setDemoTier("pro");
    expect(canSendFiles()).toBe(true);
  });
});
