import { afterEach, describe, expect, it, vi } from "vitest";
import { getToast, showPlainToast, showToast } from "@libs/toast";

describe("toast", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("showPlainToast sets message without i18n key", () => {
    showPlainToast("Microfone bloqueado pelo host");
    expect(getToast()).toEqual({ message: "Microfone bloqueado pelo host" });
  });

  it("showToast still uses i18n key", () => {
    showToast("toast.leftCall");
    expect(getToast()?.key).toBe("toast.leftCall");
    expect(getToast()?.message).toBeUndefined();
  });

  it("clears toast after timeout", () => {
    vi.useFakeTimers();
    showPlainToast("ok", 1000);
    expect(getToast()?.message).toBe("ok");
    vi.advanceTimersByTime(1000);
    expect(getToast()).toBeNull();
  });
});
