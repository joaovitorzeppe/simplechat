import { afterEach, describe, expect, it } from "vitest";
import {
  canSendFiles,
  currentTier,
  maxFileBytes,
  setDemoTier,
} from "@libs/quality";

describe("planos", () => {
  afterEach(() => {
    localStorage.removeItem("simplechat.demoTier");
  });

  it("permite envio de arquivo em qualquer plano", () => {
    setDemoTier("free");
    expect(canSendFiles()).toBe(true);
  });

  it("limita arquivos gratuitos a 10 MB", () => {
    setDemoTier("free");
    expect(currentTier()).toBe("free");
    expect(maxFileBytes()).toBe(10 * 1024 * 1024);
  });

  it("mantém 100 MB no plano Pro de desenvolvimento", () => {
    setDemoTier("pro");
    expect(maxFileBytes()).toBe(100 * 1024 * 1024);
  });
});
