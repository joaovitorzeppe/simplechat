import { useEffect, useLayoutEffect, useRef, useState, type FormEvent } from "react";
import { useI18n } from "../i18n/use-i18n";
import type { ChatMessage } from "../lib/types";
import { MAX_CHAT_TEXT } from "../lib/wire-guard";
import { Button } from "./Button";
import { ChatMessages } from "./ChatMessages";
import { CloseIcon, PaperclipIcon } from "./Icons";

type Props = {
  messages: ChatMessage[];
  selfId: string;
  onSend: (text: string) => void;
  onSendFile: (file: File) => void;
  onClose: () => void;
};

export const ChatPanel = ({
  messages,
  selfId,
  onSend,
  onSendFile,
  onClose,
}: Props) => {
  const { t } = useI18n();
  const [text, setText] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const pinnedToBottom = useRef(true);

  // Só acompanha o fim da conversa se o usuário já estiver lá. Quem rolou para
  // cima para reler algo não é arrastado de volta a cada mensagem nova.
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const onScroll = () => {
      const distance = list.scrollHeight - list.scrollTop - list.clientHeight;
      pinnedToBottom.current = distance < 80;
    };
    list.addEventListener("scroll", onScroll, { passive: true });
    return () => list.removeEventListener("scroll", onScroll);
  }, []);

  useLayoutEffect(() => {
    const list = listRef.current;
    if (!list || !pinnedToBottom.current) return;
    list.scrollTop = list.scrollHeight;
    // A contagem é gatilho, não insumo: o efeito roda quando chega mensagem.
    // oxlint-disable-next-line exhaustive-effect-dependencies
  }, [messages.length]);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    pinnedToBottom.current = true;
    onSend(text);
    setText("");
  };

  return (
    <aside className="flex h-full w-full max-w-sm flex-col border-l border-line bg-panel">
      <div className="flex items-center justify-between gap-2 border-b border-line px-3 py-2">
        <div className="px-1 text-sm font-medium">{t("chat.title")}</div>
        <Button
          variant="ghost"
          className="px-2 py-1"
          onClick={onClose}
          title={t("chat.close")}
        >
          <CloseIcon />
        </Button>
      </div>
      <div
        ref={listRef}
        className="flex-1 space-y-3 overflow-y-auto p-4 text-sm"
      >
        {messages.length === 0 && (
          <p className="text-zinc-500">{t("chat.empty")}</p>
        )}
        <ChatMessages messages={messages} selfId={selfId} />
      </div>
      <form onSubmit={submit} className="flex gap-2 border-t border-line p-3">
        <input
          ref={fileRef}
          type="file"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (file) onSendFile(file);
          }}
        />
        <Button
          variant="ghost"
          className="px-2.5"
          title={t("chat.attach")}
          onClick={() => fileRef.current?.click()}
        >
          <PaperclipIcon />
        </Button>
        <input
          value={text}
          maxLength={MAX_CHAT_TEXT}
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
};
