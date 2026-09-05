import { useEffect, useMemo, useRef, useState } from "react";
import { useI18n } from "@i18n/use-i18n";
import {
  formatFileSize,
  formatMessageTime,
  groupChatMessages,
  isPreviewableImage,
  splitMessageText,
} from "@libs/chat";
import {
  formatCommandText,
  formatTimerClock,
  peopleForCommandMentions,
} from "@libs/commands";
import {
  canControlTimer,
  initialTimerState,
  resolveTimerState,
  timerRemaining,
  type TimerAction,
} from "@libs/timer";
import {
  CODE_LANGUAGE_LABELS,
  highlightCode,
  type CodeLanguage,
} from "@libs/code";
import { isPinged, mentionMarks, type MentionPerson } from "@libs/mentions";
import type { ChatCommandPayload, ChatFile, ChatMessage } from "@libs/types";
import { useFileProgress } from "@libs/file-progress";
import { cn } from "@libs/cn";
import { CheckIcon, CopyIcon, DownloadIcon } from "./Icons";
import { Button } from "./Button";
import { LinkWarning } from "./LinkWarning";

type Props = {
  messages: ChatMessage[];
  selfId: string;
  hostPeerId: string | null;
  people: MentionPerson[];
  onVote: (pollId: string, option: number) => void;
  onTimerControl: (id: string, action: TimerAction) => void;
};

const MessageBody = ({
  text,
  marks,
  onOpenLink,
}: {
  text: string;
  marks: ReturnType<typeof mentionMarks>;
  onOpenLink: (href: string) => void;
}) => {
  const parts = splitMessageText(text, marks);
  return (
    <span className="whitespace-pre-wrap wrap-break-word">
      {/* Os trechos são posicionais e imutáveis: derivam de um texto fixo e
          nunca são reordenados, então o índice é a chave certa. */}
      {/* oxlint-disable no-array-index-key */}
      {parts.map((part, index) => {
        if (part.type === "text") {
          return <span key={index}>{part.value}</span>;
        }
        if (part.type === "mention") {
          return (
            <span
              key={index}
              className={cn(
                "rounded-md px-1 py-0.5 font-medium",
                part.mine
                  ? "bg-amber-400/25 text-amber-100"
                  : "bg-accent/20 text-accent",
              )}
            >
              @{part.label}
            </span>
          );
        }
        return (
          <button
            key={index}
            type="button"
            className="inline cursor-pointer break-all border-0 bg-transparent p-0 text-accent underline underline-offset-2 hover:text-teal-300"
            onClick={() => onOpenLink(part.href)}
          >
            {part.label}
          </button>
        );
      })}
      {/* oxlint-enable no-array-index-key */}
    </span>
  );
};

const saveFile = (file: ChatFile) => {
  if (!file.blobUrl) return;
  const link = document.createElement("a");
  link.href = file.blobUrl;
  link.download = file.name;
  link.rel = "noopener";
  document.body.append(link);
  link.click();
  link.remove();
};

const FileCard = ({ file }: { file: ChatFile }) => {
  const { locale, t } = useI18n();
  const progress = useFileProgress(file.id);
  const ready = file.status === "ready" && file.blobUrl;
  const statusLabel =
    file.status === "sending"
      ? t("chat.fileSending")
      : file.status === "receiving"
        ? t("chat.fileReceiving")
        : file.status === "error"
          ? t("chat.fileError")
          : null;

  return (
    <div className="space-y-2">
      {ready && isPreviewableImage(file.mime) && (
        <img
          src={file.blobUrl ?? undefined}
          alt={file.name}
          className="max-h-40 w-full rounded-xl object-cover"
        />
      )}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate font-medium">{file.name}</p>
          <p className="text-[11px] text-zinc-500">
            {statusLabel ?? formatFileSize(file.size, locale)}
          </p>
        </div>
        {ready && (
          <Button
            variant="ghost"
            className="shrink-0 px-2 py-1"
            title={t("chat.download")}
            onClick={() => saveFile(file)}
          >
            <DownloadIcon width={16} height={16} />
          </Button>
        )}
      </div>
      {file.status !== "ready" && file.status !== "error" && (
        <div className="h-1 overflow-hidden rounded-full bg-zinc-700">
          <div
            className="h-full bg-accent"
            style={{ width: `${Math.round(progress * 100)}%` }}
          />
        </div>
      )}
    </div>
  );
};

const TOKEN_CLASS: Record<
  "plain" | "comment" | "string" | "number" | "keyword" | "punct",
  string
> = {
  plain: "",
  comment: "text-zinc-500 italic",
  string: "text-emerald-400",
  number: "text-amber-300",
  keyword: "text-accent",
  punct: "text-zinc-400",
};

const CodeCard = ({
  language,
  source,
}: {
  language: CodeLanguage;
  source: string;
}) => {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);
  const copiedTimer = useRef(0);
  const tokens = useMemo(
    () => highlightCode(source, language),
    [source, language],
  );

  useEffect(() => () => window.clearTimeout(copiedTimer.current), []);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(source);
      setCopied(true);
      window.clearTimeout(copiedTimer.current);
      copiedTimer.current = window.setTimeout(() => setCopied(false), 1600);
    } catch {
      // sem clipboard (http sem permissão) o botão só não confirma
    }
  };

  return (
    <div className="min-w-52 overflow-hidden rounded-xl bg-zinc-950/40">
      <div className="flex items-center justify-between gap-2 px-3 py-1.5 text-[11px] text-zinc-500">
        <span className="truncate font-medium tracking-wide">
          {CODE_LANGUAGE_LABELS[language]}
        </span>
        <Button
          variant="ghost"
          className="shrink-0 px-1.5 py-0.5 text-zinc-400"
          title={copied ? t("chat.command.codeCopied") : t("chat.command.codeCopy")}
          onClick={() => void copy()}
        >
          {copied ? (
            <CheckIcon width={14} height={14} />
          ) : (
            <CopyIcon width={14} height={14} />
          )}
        </Button>
      </div>
      <pre className="m-0 max-h-80 overflow-auto px-3 pb-3 font-mono text-[12px] leading-5">
        <code className="block whitespace-pre">
          {/* oxlint-disable no-array-index-key */}
          {tokens.map((token, index) => (
            <span key={index} className={TOKEN_CLASS[token.type]}>
              {token.value}
            </span>
          ))}
          {/* oxlint-enable no-array-index-key */}
        </code>
      </pre>
    </div>
  );
};

const TimerCard = ({
  message,
  selfId,
  hostPeerId,
  onControl,
}: {
  message: ChatMessage;
  selfId: string;
  hostPeerId: string | null;
  onControl: (id: string, action: TimerAction) => void;
}) => {
  const { t } = useI18n();
  const state =
    resolveTimerState(message) ??
    initialTimerState(
      message.command?.kind === "timer" ? message.command.ms : 0,
      message.at,
    );
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (state.status !== "running") return;
    if (timerRemaining(state, Date.now()) <= 0) return;
    const id = window.setInterval(() => {
      const next = Date.now();
      setNow(next);
      if (timerRemaining(state, next) <= 0) window.clearInterval(id);
    }, 250);
    return () => window.clearInterval(id);
  }, [state]);
  const left = timerRemaining(state, now);
  const canControl =
    canControlTimer(message.fromPeerId, selfId, hostPeerId) &&
    (state.status === "paused" || (state.status === "running" && left > 0));

  const label =
    state.status === "cancelled"
      ? t("chat.command.timerCancelled")
      : left <= 0
        ? t("chat.command.timerEnded")
        : formatTimerClock(left);

  return (
    <div className="space-y-2">
      <p
        className={cn(
          "min-w-28 text-center font-mono text-2xl tabular-nums tracking-tight",
          state.status === "paused" && "text-amber-200",
          state.status === "cancelled" && "text-zinc-500",
        )}
      >
        {label}
      </p>
      {state.status === "paused" && left > 0 && (
        <p className="text-center text-[11px] text-amber-200/80">
          {t("chat.command.timerPaused")}
        </p>
      )}
      {canControl && (
        <div className="flex justify-center gap-1.5">
          {state.status === "running" ? (
            <Button
              variant="secondary"
              className="px-2.5 py-1 text-xs"
              onClick={() => onControl(message.id, "pause")}
            >
              {t("chat.command.timerPause")}
            </Button>
          ) : (
            <Button
              variant="secondary"
              className="px-2.5 py-1 text-xs"
              onClick={() => onControl(message.id, "resume")}
            >
              {t("chat.command.timerResume")}
            </Button>
          )}
          <Button
            variant="ghost"
            className="px-2.5 py-1 text-xs"
            onClick={() => onControl(message.id, "cancel")}
          >
            {t("chat.command.timerCancel")}
          </Button>
        </div>
      )}
    </div>
  );
};

const EMPTY_VOTES: Record<string, number> = {};

const PollCard = ({
  poll,
  votes = EMPTY_VOTES,
  selfId,
  onVote,
}: {
  poll: Extract<ChatCommandPayload, { kind: "poll" }>;
  votes?: Record<string, number>;
  selfId: string;
  onVote: (pollId: string, option: number) => void;
}) => {
  const mine = votes[selfId];
  const counts = Array.from({ length: poll.options.length }, () => 0);
  for (const vote of Object.values(votes)) {
    if (vote >= 0 && vote < counts.length) counts[vote] += 1;
  }
  return (
    <div className="min-w-48 space-y-1.5">
      {poll.options.map((option, index) => {
        const selected = mine === index;
        return (
          <button
            key={`${poll.id}-${index}`}
            type="button"
            aria-pressed={selected}
            onClick={() => onVote(poll.id, index)}
            className={cn(
              "flex w-full cursor-pointer items-center justify-between gap-3 rounded-xl px-3 py-2 text-left text-sm transition",
              selected
                ? "bg-accent/25 ring-1 ring-accent/50"
                : "bg-zinc-900/70 hover:bg-zinc-900",
            )}
          >
            <span className="min-w-0 wrap-break-word">{option}</span>
            <span className="shrink-0 tabular-nums text-zinc-400">
              {counts[index] ?? 0}
            </span>
          </button>
        );
      })}
    </div>
  );
};

export const ChatMessages = ({
  messages,
  selfId,
  hostPeerId,
  people,
  onVote,
  onTimerControl,
}: Props) => {
  const { locale, t } = useI18n();
  const groups = useMemo(() => groupChatMessages(messages), [messages]);
  const [pendingHref, setPendingHref] = useState<string | null>(null);

  const openPending = () => {
    if (!pendingHref) return;
    window.open(pendingHref, "_blank", "noopener,noreferrer");
    setPendingHref(null);
  };

  return (
    <>
      {groups.map((group) => {
        const mine = group.fromPeerId === selfId;
        if (group.messages[0]?.system === "left") {
          return (
            <p
              key={group.messages[0].id}
              className="py-1 text-center text-[11px] text-zinc-500 wrap-break-word"
            >
              {t("toast.peerLeft", { name: group.fromName })}
            </p>
          );
        }
        return (
          <div key={group.messages[0].id} className="space-y-1">
            <div
              className={cn(
                "text-[11px] text-zinc-500 wrap-break-word",
                mine && "text-right",
              )}
            >
              {group.fromName}
              <span className="text-zinc-600">
                {" · "}
                {formatMessageTime(group.at, locale)}
              </span>
            </div>
            {group.messages.map((msg) => {
              const pinged = isPinged(msg.mentions, selfId, msg.fromPeerId);
              return (
                <div key={msg.id} className={cn(mine && "flex justify-end")}>
                  <div
                    className={cn(
                      "inline-block max-w-[90%] rounded-2xl px-3 py-2",
                      pinged
                        ? "bg-amber-400/20 ring-1 ring-amber-300/60"
                        : mine
                          ? "bg-accent/15"
                          : "bg-zinc-800",
                    )}
                  >
                    {msg.file && <FileCard file={msg.file} />}
                    {msg.command?.kind === "timer" ? (
                      <TimerCard
                        message={msg}
                        selfId={selfId}
                        hostPeerId={hostPeerId}
                        onControl={onTimerControl}
                      />
                    ) : msg.command?.kind === "poll" ? (
                      <PollCard
                        poll={msg.command}
                        votes={msg.pollVotes}
                        selfId={selfId}
                        onVote={onVote}
                      />
                    ) : msg.command?.kind === "code" ? (
                      <CodeCard
                        language={msg.command.language}
                        source={msg.command.source}
                      />
                    ) : msg.command || msg.text ? (
                      <MessageBody
                        text={
                          msg.command
                            ? formatCommandText(msg.command, t, msg.fromName)
                            : msg.text
                        }
                        marks={mentionMarks(
                          msg.mentions,
                          peopleForCommandMentions(msg.command, people),
                          selfId,
                        )}
                        onOpenLink={setPendingHref}
                      />
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        );
      })}
      {pendingHref && (
        <LinkWarning
          href={pendingHref}
          onCancel={() => setPendingHref(null)}
          onOpen={openPending}
        />
      )}
    </>
  );
};
