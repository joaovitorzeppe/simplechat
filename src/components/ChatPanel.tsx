import { useState, type FormEvent } from "react";
import { useI18n } from "../i18n/use-i18n";
import type { ChatMessage } from "../lib/types";
import { Button } from "./Button";
import { ChatMessages } from "./ChatMessages";

type Props = {
  messages: ChatMessage[];
  selfId: string;
  onSend: (text: string) => void;
};

export function ChatPanel({ messages, selfId, onSend }: Props) {
  const { t } = useI18n();
  const [text, setText] = useState("");

  function submit(event: FormEvent) {
    event.preventDefault();
    onSend(text);
    setText("");
  }

  return (
    <aside className="flex h-full w-full max-w-sm flex-col border-l border-line bg-panel">
      <div className="border-b border-line px-4 py-3 text-sm font-medium">
        {t("chat.title")}
      </div>
      <div className="flex-1 space-y-3 overflow-y-auto p-4 text-sm">
        {messages.length === 0 && (
          <p className="text-zinc-500">{t("chat.empty")}</p>
        )}
        <ChatMessages messages={messages} selfId={selfId} />
      </div>
      <form onSubmit={submit} className="flex gap-2 border-t border-line p-3">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={t("chat.placeholder")}
          className="flex-1 rounded-xl bg-zinc-900 border border-line px-3 py-2 text-sm outline-none focus:border-accent"
        />
        <Button type="submit" disabled={!text.trim()}>
          {t("chat.send")}
        </Button>
      </form>
    </aside>
  );
}
