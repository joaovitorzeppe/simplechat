import {
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type SubmitEvent,
} from "react";
import { useI18n } from "@i18n/use-i18n";
import {
  ALL_MENTION,
  filterMentionPeople,
  insertMention,
  matchAllOption,
  mentionQueryAt,
  type MentionPerson,
} from "@libs/mentions";
import {
  commandQueryAt,
  filterChatCommands,
  insertCommand,
} from "@libs/commands";
import type { ChatMessage } from "@libs/types";
import { MAX_CHAT_TEXT } from "@libs/wire-guard";
import { Button } from "./Button";
import { ChatMessages } from "./ChatMessages";
import { CloseIcon, PaperclipIcon } from "./Icons";
import { CommandPicker, type CommandPickerItem } from "./CommandPicker";
import { MentionPicker } from "./MentionPicker";

type PickerItem =
  | { kind: "all"; label: string }
  | { kind: "peer"; person: MentionPerson };

type Props = {
  messages: ChatMessage[];
  selfId: string;
  people: MentionPerson[];
  onSend: (text: string) => boolean | void;
  onSendFile: (file: File) => void;
  onClose: () => void;
};

export const ChatPanel = ({
  messages,
  selfId,
  people,
  onSend,
  onSendFile,
  onClose,
}: Props) => {
  const { t } = useI18n();
  const [text, setText] = useState("");
  const [caret, setCaret] = useState(0);
  const [active, setActive] = useState(0);
  const [dismissedAt, setDismissedAt] = useState<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const pinnedToBottom = useRef(true);

  const mentionQuery = mentionQueryAt(text, caret);
  const commandQuery = mentionQuery ? null : commandQueryAt(text, caret);
  const others = useMemo(
    () => people.filter((person) => person.peerId !== selfId),
    [people, selfId],
  );
  const filtered = useMemo(
    () =>
      mentionQuery
        ? filterMentionPeople(people, mentionQuery.query, selfId)
        : [],
    [people, mentionQuery, selfId],
  );
  const showAll = Boolean(
    mentionQuery && matchAllOption(mentionQuery.query, others.length > 0),
  );
  const mentionItems: PickerItem[] = useMemo(() => {
    if (!mentionQuery) return [];
    const next: PickerItem[] = [];
    if (showAll) next.push({ kind: "all", label: ALL_MENTION });
    for (const person of filtered) next.push({ kind: "peer", person });
    return next;
  }, [filtered, mentionQuery, showAll]);
  const commandItems: CommandPickerItem[] = useMemo(() => {
    if (!commandQuery) return [];
    return filterChatCommands(commandQuery.query).map((command) => ({
      id: command.id,
      slash: `/${t(command.nameKey)}`,
      hint: t(command.hintKey),
      example: t(command.exampleKey),
    }));
  }, [commandQuery, t]);

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
    // oxlint-disable-next-line exhaustive-effect-dependencies
  }, [messages.length]);

  const focusCaret = (next: { text: string; caret: number }) => {
    setText(next.text);
    setCaret(next.caret);
    requestAnimationFrame(() => {
      const input = inputRef.current;
      if (!input) return;
      input.focus();
      input.setSelectionRange(next.caret, next.caret);
    });
  };

  const applyMention = (item: PickerItem) => {
    const label = item.kind === "all" ? ALL_MENTION : item.person.displayName;
    focusCaret(insertMention(text, caret, label));
  };

  const applyCommand = (item: CommandPickerItem) => {
    focusCaret(insertCommand(text, caret, item.slash));
  };

  const submit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    pinnedToBottom.current = true;
    const sent = onSend(text);
    if (sent === false) return;
    setText("");
    setCaret(0);
    setDismissedAt(null);
  };

  const pickerKind = mentionItems.length
    ? "mention"
    : commandItems.length
      ? "command"
      : null;
  const pickerCount =
    pickerKind === "mention" ? mentionItems.length : commandItems.length;
  const pickerQueryStart =
    pickerKind === "mention" ? mentionQuery?.start : commandQuery?.start;
  const pickerOpen =
    pickerKind !== null &&
    pickerQueryStart !== undefined &&
    dismissedAt !== pickerQueryStart;

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (!pickerOpen || !pickerCount) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((index) => (index + 1) % pickerCount);
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((index) => (index - 1 + pickerCount) % pickerCount);
      return;
    }
    if (event.key === "Enter" || event.key === "Tab") {
      event.preventDefault();
      if (pickerKind === "mention") {
        const item = mentionItems[active] ?? mentionItems[0];
        if (item) applyMention(item);
      } else {
        const item = commandItems[active] ?? commandItems[0];
        if (item) applyCommand(item);
      }
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      setDismissedAt(pickerQueryStart ?? null);
    }
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
        <ChatMessages messages={messages} selfId={selfId} people={people} />
      </div>
      <form
        onSubmit={submit}
        className="safe-bottom relative flex gap-2 border-t border-line p-3"
      >
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
          aria-label={t("chat.attach")}
          onClick={() => fileRef.current?.click()}
        >
          <PaperclipIcon />
        </Button>
        <div className="relative min-w-0 flex-1">
          {pickerOpen && pickerKind === "mention" && (
            <MentionPicker
              items={mentionItems}
              active={Math.min(active, mentionItems.length - 1)}
              label={t("chat.mentionPicker")}
              allLabel={t("chat.mentionAll")}
              onPick={applyMention}
              onActive={setActive}
            />
          )}
          {pickerOpen && pickerKind === "command" && (
            <CommandPicker
              items={commandItems}
              active={Math.min(active, commandItems.length - 1)}
              label={t("chat.commandPicker")}
              onPick={applyCommand}
              onActive={setActive}
            />
          )}
          <input
            ref={inputRef}
            value={text}
            maxLength={MAX_CHAT_TEXT}
            onChange={(e) => {
              setText(e.target.value);
              setCaret(e.target.selectionStart ?? e.target.value.length);
              setActive(0);
            }}
            onKeyUp={(e) => setCaret(e.currentTarget.selectionStart ?? caret)}
            onClick={(e) =>
              setCaret(e.currentTarget.selectionStart ?? text.length)
            }
            onKeyDown={onKeyDown}
            placeholder={t("chat.placeholder")}
            aria-label={t("chat.placeholder")}
            aria-autocomplete="list"
            aria-expanded={pickerOpen}
            className="w-full rounded-xl bg-zinc-900 border border-line px-3 py-2 text-sm outline-none focus:border-accent"
          />
        </div>
        <Button type="submit" disabled={!text.trim()} className="shrink-0">
          {t("chat.send")}
        </Button>
      </form>
    </aside>
  );
};
