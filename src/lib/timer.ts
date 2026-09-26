import type { ChatMessage } from "./types";

export type TimerState =
  | { status: "running"; endsAt: number }
  | { status: "paused"; remainingMs: number; byHost?: true }
  | { status: "cancelled"; byHost?: true };

export type TimerAction = "pause" | "resume" | "cancel";

export const initialTimerState = (ms: number, at: number): TimerState => ({
  status: "running",
  endsAt: at + ms,
});

export const resolveTimerState = (message: ChatMessage): TimerState | null => {
  if (message.command?.kind !== "timer") {
    return null;
  }
  return message.timer ?? initialTimerState(message.command.ms, message.at);
};

export const timerRemaining = (state: TimerState, now: number) => {
  if (state.status === "cancelled") {
    return 0;
  }
  if (state.status === "paused") {
    return Math.max(0, state.remainingMs);
  }
  return Math.max(0, state.endsAt - now);
};

export const isTimerActive = (state: TimerState, now: number) => {
  if (state.status === "cancelled") {
    return false;
  }
  if (state.status === "paused") {
    return state.remainingMs > 0;
  }
  return state.endsAt > now;
};

export const hasActiveTimer = (messages: ChatMessage[], now: number) =>
  messages.some((message) => {
    const state = resolveTimerState(message);
    return state ? isTimerActive(state, now) : false;
  });

export const canControlTimer = (
  fromPeerId: string,
  actorId: string,
  hostPeerId: string | null,
) => actorId === fromPeerId || (!!hostPeerId && actorId === hostPeerId);

export const applyTimerAction = (
  state: TimerState,
  action: TimerAction,
  now: number,
): TimerState | null => {
  if (action === "pause") {
    if (state.status !== "running") {
      return null;
    }
    const remainingMs = Math.max(0, state.endsAt - now);
    if (remainingMs <= 0) {
      return null;
    }
    return { status: "paused", remainingMs };
  }
  if (action === "resume") {
    if (state.status !== "paused" || state.remainingMs <= 0) {
      return null;
    }
    return { status: "running", endsAt: now + state.remainingMs };
  }
  if (state.status === "cancelled") {
    return null;
  }
  if (state.status === "running" && state.endsAt <= now) {
    return null;
  }
  return { status: "cancelled" };
};

/** Quem controlou: byHost vem do actor, não do payload do fio. */
export const stampTimerActor = (
  state: TimerState,
  byHost: boolean,
): TimerState => {
  if (state.status === "paused") {
    return byHost
      ? { status: "paused", remainingMs: state.remainingMs, byHost: true }
      : { status: "paused", remainingMs: state.remainingMs };
  }
  if (state.status === "cancelled") {
    return byHost
      ? { status: "cancelled", byHost: true }
      : { status: "cancelled" };
  }
  return { status: "running", endsAt: state.endsAt };
};
