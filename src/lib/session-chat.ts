import { t } from "@i18n/i18n";
import {
  CHAT_COOLDOWN_MS,
  cooledDown,
  MAX_TIMER_ALARMS,
  MENTION_TOAST_COOLDOWN_MS,
} from "./chat";
import {
  formatCommandText,
  mentionsForCommand,
  runChatCommand,
} from "./commands";
import { clearFileProgress } from "./file-progress";
import { ALL_MENTION, isPinged, resolveMentions } from "./mentions";
import type { PeerSession } from "./session";
import {
  applyTimerAction,
  canControlTimer,
  hasActiveTimer,
  initialTimerState,
  resolveTimerState,
  stampTimerActor,
  type TimerAction,
  type TimerState,
} from "./timer";
import { showToast } from "./toast";
import type { ChatMessage, WireMessage } from "./types";
import { clampChatText } from "./wire-guard";

const MAX_MESSAGES = 500;

/** Mensagens, comandos, enquetes e timers do chat da sala. */
export class SessionChat {
  private readonly session: PeerSession;

  constructor(session: PeerSession) {
    this.session = session;
  }

  private get state() {
    return this.session.getState();
  }

  private lastChatAt = new Map<string, number>();
  private lastMentionToastAt = 0;
  private timerAlarms = new Map<string, number>();

  receive(from: string, msg: Extract<WireMessage, { type: "chat" }>) {
    const now = Date.now();
    if (!cooledDown(this.lastChatAt.get(from), now, CHAT_COOLDOWN_MS)) {
      return;
    }
    this.lastChatAt.set(from, now);
    // Os ids vêm do remetente. Repetir um já visto desviaria votos de outra
    // enquete ou o controle de outro timer.
    const pollId = msg.command?.kind === "poll" ? msg.command.id : null;
    if (
      this.state.messages.some(
        (m) =>
          m.id === msg.id ||
          (m.command?.kind === "poll" && m.command.id === pollId),
      )
    ) {
      return;
    }
    const mentions = (msg.mentions ?? []).filter(
      (id) =>
        id === ALL_MENTION ||
        this.session.room.roomMembers.some((member) => member.peerId === id),
    );
    const names = this.session.names;
    this.appendMessage({
      // Mesmo id do fio: poll-vote/timer-control apontam pra ele.
      id: msg.id,
      fromPeerId: from,
      fromName: names.get(from) ?? t("common.someone"),
      text: msg.text,
      at: now,
      ...(mentions.length ? { mentions } : {}),
      ...(msg.command ? { command: msg.command } : {}),
    });
    const me = this.state.identity?.peerId;
    if (
      me &&
      isPinged(mentions, me, from) &&
      cooledDown(this.lastMentionToastAt, now, MENTION_TOAST_COOLDOWN_MS)
    ) {
      this.lastMentionToastAt = now;
      showToast(
        mentions.includes(ALL_MENTION)
          ? "toast.mentionedAll"
          : "toast.mentioned",
        { name: names.get(from) ?? t("common.someone") },
      );
    }
  }

  forget(peerId: string) {
    this.lastChatAt.delete(peerId);
  }

  reset() {
    this.lastChatAt.clear();
    this.lastMentionToastAt = 0;
    for (const timeout of this.timerAlarms.values()) {
      window.clearTimeout(timeout);
    }
    this.timerAlarms.clear();
  }

  sendChat(text: string) {
    const trimmed = clampChatText(text.trim());
    const me = this.state.identity;
    if (!trimmed || !me || !this.session.inRoom()) {
      return false;
    }
    const command = runChatCommand(trimmed, this.session.room.roomMembers);
    if (command) {
      if (!command.ok) {
        showToast(command.error);
        return false;
      }
      if (command.command.kind === "timer") {
        if (hasActiveTimer(this.state.messages, Date.now())) {
          showToast("chat.command.timerBusy");
          return false;
        }
      }
      const mentions = mentionsForCommand(command.command);
      if (command.command.kind === "emote") {
        for (const id of resolveMentions(
          command.command.action,
          this.session.room.roomMembers,
        )) {
          if (!mentions.includes(id)) {
            mentions.push(id);
          }
        }
      }
      // /me e /moeda mostram @nome — precisa estar em mentions pra pintar.
      if (
        (command.command.kind === "emote" || command.command.kind === "coin") &&
        !mentions.includes(me.peerId)
      ) {
        mentions.push(me.peerId);
      }
      const at = Date.now();
      const message: ChatMessage = {
        id: crypto.randomUUID(),
        fromPeerId: me.peerId,
        fromName: me.displayName,
        text: formatCommandText(
          command.command,
          t,
          me.displayName,
          this.session.room.roomMembers,
        ),
        at,
        command: command.command,
        ...(command.command.kind === "timer"
          ? { timer: initialTimerState(command.command.ms, at) }
          : {}),
        ...(mentions.length ? { mentions } : {}),
      };
      this.appendMessage(message);
      if (command.command.kind !== "help") {
        const { timer: _timer, ...chat } = message;
        this.session.broadcast({ type: "chat", ...chat });
      }
      return true;
    }
    const mentions = resolveMentions(trimmed, this.session.room.roomMembers);
    const message: ChatMessage = {
      id: crypto.randomUUID(),
      fromPeerId: me.peerId,
      fromName: me.displayName,
      text: trimmed,
      at: Date.now(),
      ...(mentions.length ? { mentions } : {}),
    };
    this.appendMessage(message);
    this.session.broadcast({ type: "chat", ...message });
    return true;
  }

  votePoll(pollId: string, option: number) {
    const me = this.state.identity;
    if (!me || !this.session.inRoom()) {
      return;
    }
    if (!this.applyPollVote(pollId, me.peerId, option)) {
      return;
    }
    this.session.broadcast({ type: "poll-vote", id: pollId, option });
  }

  controlTimer(messageId: string, action: TimerAction) {
    const me = this.state.identity;
    if (!me || !this.session.inRoom()) {
      return;
    }
    const next = this.applyTimerControl(
      messageId,
      me.peerId,
      action,
      Date.now(),
    );
    if (!next) {
      return;
    }
    this.session.broadcast({
      type: "timer-control",
      id: messageId,
      timer: next,
    });
  }

  appendMessage(message: ChatMessage) {
    const withTimer =
      message.command?.kind === "timer" && !message.timer
        ? {
            ...message,
            timer: initialTimerState(message.command.ms, message.at),
          }
        : message;
    const messages = [...this.state.messages, withTimer];
    if (messages.length > MAX_MESSAGES) {
      const dropped = messages.splice(0, messages.length - MAX_MESSAGES);
      for (const old of dropped) {
        this.clearTimerAlarm(old.id);
        if (!old.file) {
          continue;
        }
        if (old.file.blobUrl) {
          URL.revokeObjectURL(old.file.blobUrl);
        }
        void this.session.files.bridge.release(old.file.id);
        clearFileProgress(old.file.id);
      }
    }
    this.session.patch({ messages });
    this.scheduleTimerAlarm(withTimer);
  }

  /**
   * Aplica pausa/retomada/cancelamento. Se `remoteTimer` vier do fio, usa esse
   * estado (relógio de quem controlou); senão calcula a ação localmente.
   */
  applyTimerControl(
    messageId: string,
    actorId: string,
    action: TimerAction | null,
    now: number,
    remoteTimer?: TimerState,
  ) {
    const index = this.state.messages.findIndex((msg) => msg.id === messageId);
    if (index < 0) {
      return null;
    }
    const message = this.state.messages[index];
    if (message?.command?.kind !== "timer") {
      return null;
    }
    if (!canControlTimer(message.fromPeerId, actorId, this.state.hostPeerId)) {
      return null;
    }
    const current = resolveTimerState(message);
    if (!current) {
      return null;
    }
    const raw =
      remoteTimer ?? (action ? applyTimerAction(current, action, now) : null);
    if (!raw) {
      return null;
    }
    const next = stampTimerActor(
      raw,
      !!this.state.hostPeerId && actorId === this.state.hostPeerId,
    );
    if (
      current.status === next.status &&
      ((current.status === "running" &&
        next.status === "running" &&
        current.endsAt === next.endsAt) ||
        (current.status === "paused" &&
          next.status === "paused" &&
          current.remainingMs === next.remainingMs &&
          !!current.byHost === !!next.byHost) ||
        (current.status === "cancelled" &&
          next.status === "cancelled" &&
          !!current.byHost === !!next.byHost))
    ) {
      return null;
    }
    const updated = { ...message, timer: next };
    const messages = [...this.state.messages];
    messages[index] = updated;
    this.session.patch({ messages });
    this.scheduleTimerAlarm(updated);
    return next;
  }

  applyPollVote(pollId: string, peerId: string, option: number) {
    const index = this.state.messages.findLastIndex(
      (msg) => msg.command?.kind === "poll" && msg.command.id === pollId,
    );
    if (index < 0) {
      return false;
    }
    const message = this.state.messages[index];
    if (message?.command?.kind !== "poll") {
      return false;
    }
    if (option < 0 || option >= message.command.options.length) {
      return false;
    }
    if (message.pollVotes?.[peerId] === option) {
      return false;
    }
    const next = [...this.state.messages];
    next[index] = {
      ...message,
      pollVotes: { ...message.pollVotes, [peerId]: option },
    };
    this.session.patch({ messages: next });
    return true;
  }

  private scheduleTimerAlarm(message: ChatMessage) {
    if (message.command?.kind !== "timer") {
      return;
    }
    this.clearTimerAlarm(message.id);
    const state = resolveTimerState(message);
    if (state?.status !== "running") {
      return;
    }
    if (this.timerAlarms.size >= MAX_TIMER_ALARMS) {
      return;
    }
    const remaining = state.endsAt - Date.now();
    if (remaining <= 0) {
      showToast("chat.command.timerDone");
      return;
    }
    const timeout = window.setTimeout(() => {
      this.timerAlarms.delete(message.id);
      showToast("chat.command.timerDone");
    }, remaining);
    this.timerAlarms.set(message.id, timeout);
  }

  private clearTimerAlarm(id: string) {
    const timeout = this.timerAlarms.get(id);
    if (timeout === undefined) {
      return;
    }
    window.clearTimeout(timeout);
    this.timerAlarms.delete(id);
  }

  appendLeaveNotice(peerId: string, name: string) {
    this.appendMessage({
      id: crypto.randomUUID(),
      fromPeerId: peerId,
      fromName: name,
      text: "",
      at: Date.now(),
      system: "left",
    });
  }
}
