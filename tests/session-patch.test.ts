import { describe, expect, it, vi } from "vitest";
import { session } from "@libs/session";

describe("session.patch", () => {
  it("não notifica ouvintes quando o valor não muda", () => {
    const listener = vi.fn();
    const stop = session.subscribe(listener);
    session.setView(session.getState().view);
    expect(listener).not.toHaveBeenCalled();
    stop();
  });
});
