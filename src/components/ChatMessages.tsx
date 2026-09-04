import { useEffect, useMemo, useState } from "react";
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
import { isPinged, mentionMarks, type MentionPerson } from "@libs/mentions";
import type { ChatCommandPayload, ChatFile, ChatMessage } from "@libs/types";
import { useFileProgress } from "@libs/file-progress";
import { cn } from "@libs/cn";
import { DownloadIcon } from "./Icons";
import { Button } from "./Button";
import { LinkWarning } from "./LinkWarning";

type Props = {
  messages: ChatMessage[];
  selfId: string;
  people: MentionPerson[];
  onVote: (pollId: string, option: number) => void;
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

const TimerCard = ({ ms, startedAt }: { ms: number; startedAt: number }) => {
  const { t } = useI18n();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (startedAt + ms - Date.now() <= 0) return;
    const id = window.setInterval(() => {
      const next = Date.now();
      setNow(next);
      if (startedAt + ms - next <= 0) window.clearInterval(id);
    }, 250);
    return () => window.clearInterval(id);
  }, [ms, startedAt]);
  const left = Math.max(0, startedAt + ms - now);
  return (
    <p className="min-w-28 text-center font-mono text-2xl tabular-nums tracking-tight">
      {left <= 0 ? t("chat.command.timerEnded") : formatTimerClock(left)}
    </p>
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

export const ChatMessages = ({ messages, selfId, people, onVote }: Props) => {
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
                      <TimerCard ms={msg.command.ms} startedAt={msg.at} />
                    ) : msg.command?.kind === "poll" ? (
                      <PollCard
                        poll={msg.command}
                        votes={msg.pollVotes}
                        selfId={selfId}
                        onVote={onVote}
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
