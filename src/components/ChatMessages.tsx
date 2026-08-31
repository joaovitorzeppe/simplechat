import { useMemo, useState } from "react";
import { useI18n } from "../i18n/use-i18n";
import {
  formatFileSize,
  formatMessageTime,
  groupChatMessages,
  isPreviewableImage,
  splitMessageText,
} from "../lib/chat";
import type { ChatFile, ChatMessage } from "../lib/types";
import { useFileProgress } from "../lib/file-progress";
import { cn } from "../lib/cn";
import { DownloadIcon } from "./Icons";
import { Button } from "./Button";
import { LinkWarning } from "./LinkWarning";

type Props = {
  messages: ChatMessage[];
  selfId: string;
};

const MessageBody = ({
  text,
  onOpenLink,
}: {
  text: string;
  onOpenLink: (href: string) => void;
}) => {
  const parts = splitMessageText(text);
  return (
    <span className="whitespace-pre-wrap wrap-break-word">
      {/* Os trechos são posicionais e imutáveis: derivam de um texto fixo e
          nunca são reordenados, então o índice é a chave certa. */}
      {/* oxlint-disable no-array-index-key */}
      {parts.map((part, index) =>
        part.type === "text" ? (
          <span key={index}>{part.value}</span>
        ) : (
          <button
            key={index}
            type="button"
            className="inline cursor-pointer break-all border-0 bg-transparent p-0 text-accent underline underline-offset-2 hover:text-teal-300"
            onClick={() => onOpenLink(part.href)}
          >
            {part.label}
          </button>
        ),
      )}
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

export const ChatMessages = ({ messages, selfId }: Props) => {
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
            {group.messages.map((msg) => (
              <div key={msg.id} className={cn(mine && "flex justify-end")}>
                <div
                  className={cn(
                    "inline-block max-w-[90%] rounded-2xl px-3 py-2",
                    mine ? "bg-accent/15" : "bg-zinc-800",
                  )}
                >
                  {msg.file && <FileCard file={msg.file} />}
                  {msg.text ? (
                    <MessageBody text={msg.text} onOpenLink={setPendingHref} />
                  ) : null}
                </div>
              </div>
            ))}
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
