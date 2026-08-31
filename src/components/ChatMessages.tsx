import { useState } from "react";
import { useI18n } from "../i18n/use-i18n";
import {
  formatMessageTime,
  groupChatMessages,
  splitMessageText,
} from "../lib/chat";
import type { ChatMessage } from "../lib/types";
import { cn } from "../lib/cn";
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
    </span>
  );
};

export const ChatMessages = ({ messages, selfId }: Props) => {
  const { locale } = useI18n();
  const groups = groupChatMessages(messages);
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
        return (
          <div key={group.messages[0].id} className="space-y-1">
            <div
              className={cn("text-[11px] text-zinc-500", mine && "text-right")}
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
                  <MessageBody text={msg.text} onOpenLink={setPendingHref} />
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
