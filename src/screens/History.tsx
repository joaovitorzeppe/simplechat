import { useEffect, useState } from "react";
import { Button } from "../components/Button";
import { ArrowLeftIcon } from "../components/Icons";
import { LanguageSwitcher } from "../components/LanguageSwitcher";
import { localeTags } from "../i18n/i18n";
import { useI18n } from "../i18n/use-i18n";
import {
  clearHistory,
  isHistoryOptIn,
  listHistoryCalls,
  listHistoryMessages,
  setHistoryOptIn,
} from "../lib/db";
import { loadIdentity } from "../lib/identity";
import type { HistoryCall, HistoryMessage } from "../lib/types";
import { useSession } from "../lib/use-session";

export function History() {
  const { session } = useSession();
  const { locale, t } = useI18n();
  const remembered = loadIdentity() !== null;
  const [optIn, setOptIn] = useState(isHistoryOptIn());
  const [calls, setCalls] = useState<HistoryCall[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [messages, setMessages] = useState<HistoryMessage[]>([]);

  async function refresh() {
    setCalls(await listHistoryCalls());
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function toggleOptIn(enabled: boolean) {
    if (enabled && !loadIdentity()) return;
    setHistoryOptIn(enabled);
    setOptIn(enabled);
  }

  async function open(callId: string) {
    setOpenId(callId);
    setMessages(await listHistoryMessages(callId));
  }

  return (
    <main className="min-h-dvh px-4 py-8">
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Button
            variant="ghost"
            className="px-0"
            onClick={() => session.setView("home")}
          >
            <ArrowLeftIcon /> {t("history.back")}
          </Button>
          <LanguageSwitcher />
        </div>
        <h1 className="text-3xl font-semibold">{t("history.title")}</h1>
        <div className="rounded-3xl border border-line bg-panel p-6 space-y-4">
          <label
            className={`flex items-start gap-3 text-sm ${remembered ? "cursor-pointer" : "cursor-not-allowed"}`}
          >
            <input
              type="checkbox"
              className="mt-1 size-4 accent-accent disabled:opacity-40"
              checked={optIn}
              disabled={!remembered}
              onChange={(e) => void toggleOptIn(e.target.checked)}
            />
            <span className={remembered ? "" : "opacity-50"}>
              <strong className="text-zinc-100">
                {t("history.saveTitle")}
              </strong>
              <p className="mt-1 text-zinc-400">
                {t("history.saveBody")}
                {!remembered && t("history.saveNeedRemember")}
              </p>
            </span>
          </label>
          <Button
            variant="secondary"
            onClick={async () => {
              await clearHistory();
              await refresh();
              setMessages([]);
              setOpenId(null);
            }}
          >
            {t("history.clear")}
          </Button>
        </div>

        <ul className="space-y-3">
          {calls.length === 0 && (
            <li className="text-sm text-zinc-500">{t("history.empty")}</li>
          )}
          {calls.map((call) => (
            <li
              key={call.id}
              className="rounded-2xl border border-line bg-panel p-4"
            >
              <button
                className="w-full text-left cursor-pointer"
                onClick={() => void open(call.id)}
              >
                <div className="text-sm font-medium">
                  {call.mode === "room"
                    ? t("history.room")
                    : t("history.direct")}{" "}
                  ·{" "}
                  {new Date(call.startedAt).toLocaleString(localeTags[locale])}
                </div>
                <p className="mt-1 text-xs text-zinc-400">
                  {call.participants.map((p) => p.displayName).join(", ")}
                </p>
              </button>
              {openId === call.id && (
                <div className="mt-3 space-y-2 border-t border-line pt-3 text-sm">
                  {messages.length === 0 && (
                    <p className="text-zinc-500">{t("history.noMessages")}</p>
                  )}
                  {messages.map((msg) => (
                    <p key={msg.id}>
                      <span className="text-zinc-500">{msg.fromName}: </span>
                      {msg.text}
                    </p>
                  ))}
                </div>
              )}
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}
