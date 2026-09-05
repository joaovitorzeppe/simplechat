import { describe, expect, it } from "vitest";
import {
  applyTimerAction,
  canControlTimer,
  hasActiveTimer,
  initialTimerState,
  isTimerActive,
  timerRemaining,
} from "@libs/timer";
import type { ChatMessage } from "@libs/types";

const timerMsg = (
  partial: Partial<ChatMessage> & { at: number; ms: number },
): ChatMessage => ({
  id: partial.id ?? "t1",
  fromPeerId: partial.fromPeerId ?? "ana",
  fromName: partial.fromName ?? "Ana",
  text: "Timer",
  at: partial.at,
  command: { kind: "timer", ms: partial.ms },
  ...(partial.timer ? { timer: partial.timer } : {}),
});

describe("timer", () => {
  it("conta restante e detecta ativo", () => {
    const running = initialTimerState(10_000, 1_000);
    expect(timerRemaining(running, 4_000)).toBe(7_000);
    expect(isTimerActive(running, 4_000)).toBe(true);
    expect(isTimerActive(running, 11_000)).toBe(false);
    expect(isTimerActive({ status: "paused", remainingMs: 3_000 }, 99)).toBe(
      true,
    );
    expect(isTimerActive({ status: "cancelled" }, 99)).toBe(false);
  });

  it("pausa, retoma e cancela", () => {
    const running = initialTimerState(10_000, 0);
    const paused = applyTimerAction(running, "pause", 4_000);
    expect(paused).toEqual({ status: "paused", remainingMs: 6_000 });
    expect(applyTimerAction(paused!, "resume", 20_000)).toEqual({
      status: "running",
      endsAt: 26_000,
    });
    expect(applyTimerAction(paused!, "cancel", 20_000)).toEqual({
      status: "cancelled",
    });
    expect(applyTimerAction(running, "resume", 1_000)).toBeNull();
  });

  it("só autor e host controlam", () => {
    expect(canControlTimer("ana", "ana", "host")).toBe(true);
    expect(canControlTimer("ana", "host", "host")).toBe(true);
    expect(canControlTimer("ana", "bia", "host")).toBe(false);
  });

  it("detecta timer ativo na lista", () => {
    const messages = [
      timerMsg({ at: 0, ms: 5_000, timer: { status: "cancelled" } }),
      timerMsg({
        id: "t2",
        at: 0,
        ms: 10_000,
        timer: { status: "paused", remainingMs: 2_000 },
      }),
    ];
    expect(hasActiveTimer(messages, 99_000)).toBe(true);
    expect(
      hasActiveTimer(
        [timerMsg({ at: 0, ms: 5_000, timer: { status: "cancelled" } })],
        99_000,
      ),
    ).toBe(false);
  });
});
