import { useState } from "react";
import { Button } from "../components/Button";
import {
  CheckIcon,
  CopyIcon,
  DownloadIcon,
  HistoryIcon,
} from "../components/Icons";
import { LanguageSwitcher } from "../components/LanguageSwitcher";
import { QualityBadge } from "../components/QualityBadge";
import { useI18n } from "../i18n/use-i18n";
import { setHistoryOptIn } from "../lib/db";
import { clearIdentity } from "../lib/identity";
import { parseInvite } from "../lib/invite";
import { useInstallPrompt } from "../lib/pwa";
import { currentTier, setDemoTier } from "../lib/quality";
import { showToast } from "../lib/toast";
import { useSession } from "../lib/use-session";

const CopyField = ({ label, value }: { label: string; value: string }) => {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    await navigator.clipboard.writeText(value);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  return (
    <div>
      <div className="mb-2 text-xs uppercase tracking-widest text-zinc-500">
        {label}
      </div>
      <div className="flex items-center gap-2 rounded-xl border border-line bg-zinc-900 px-3 py-2">
        <code className="flex-1 truncate font-mono text-xs sm:text-sm">
          {value}
        </code>
        <Button
          variant="ghost"
          className="px-2 py-1"
          onClick={() => void copy()}
        >
          {copied ? <CheckIcon /> : <CopyIcon />}
        </Button>
      </div>
    </div>
  );
};

export const Home = () => {
  const { t } = useI18n();
  const { state, session } = useSession();
  const { canInstall, showIosHelp, install } = useInstallPrompt();
  const params = new URLSearchParams(window.location.search);
  const [inviteKey, setInviteKey] = useState(
    params.get("room") ?? params.get("call") ?? "",
  );
  const [tier, setTier] = useState(currentTier());

  const myId = state.identity?.peerId ?? "";
  const inviteLink = `${window.location.origin}/?room=${myId}`;

  const applyInvite = (raw: string) => {
    const invite = parseInvite(raw);
    setInviteKey(invite ? invite.peerId : raw);
  };

  const brokerHint = state.peerReady
    ? null
    : state.peerError
      ? t(state.peerError)
      : t("home.disabledConnecting");
  const inviteDisabled = !state.peerReady || !inviteKey.trim();
  const startDisabled = !state.peerReady;

  return (
    <main className="min-h-dvh px-4 py-8">
      <div className="mx-auto max-w-3xl space-y-6">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-accent">
              SimpleChat
            </p>
            <h1 className="mt-1 text-3xl font-semibold">
              {t("home.hello", { name: state.identity?.displayName ?? "" })}
            </h1>
            <p className="mt-1 text-sm text-zinc-400">
              {state.peerReady
                ? t("home.ready")
                : state.peerError
                  ? t(state.peerError)
                  : t("home.connecting")}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <LanguageSwitcher />
            {canInstall && (
              <Button variant="secondary" onClick={() => void install()}>
                <DownloadIcon /> {t("home.install")}
              </Button>
            )}
            {showIosHelp && !canInstall && (
              <Button
                variant="secondary"
                onClick={() => showToast("home.installIos")}
              >
                <DownloadIcon /> {t("home.install")}
              </Button>
            )}
            <Button
              variant="secondary"
              onClick={() => session.setView("history")}
            >
              <HistoryIcon /> {t("home.history")}
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                clearIdentity();
                setHistoryOptIn(false);
                window.location.reload();
              }}
            >
              {t("home.switchIdentity")}
            </Button>
          </div>
        </header>

        <section className="rounded-3xl border border-line bg-panel p-6 space-y-4">
          <CopyField label={t("home.yourKey")} value={myId} />
          <CopyField label={t("home.inviteLink")} value={inviteLink} />
          <p className="text-sm text-zinc-400">{t("home.inviteBody")}</p>
          <Button
            className="w-full"
            disabled={startDisabled}
            title={startDisabled ? (brokerHint ?? undefined) : undefined}
            onClick={() => void session.createRoom()}
          >
            {t("home.startCall")}
          </Button>
        </section>

        <section className="rounded-3xl border border-line bg-panel p-6 space-y-4">
          <h2 className="text-lg font-medium">{t("home.joinTitle")}</h2>
          <p className="text-sm text-zinc-400">{t("home.joinBody")}</p>
          <input
            value={inviteKey}
            onChange={(e) => applyInvite(e.target.value)}
            placeholder={t("home.invitePlaceholder")}
            className="w-full rounded-xl border border-line bg-zinc-900 px-3 py-2.5 font-mono text-sm outline-none focus:border-accent"
          />
          <div className="grid gap-2 sm:grid-cols-2">
            <Button
              className="w-full"
              disabled={inviteDisabled}
              title={
                inviteDisabled
                  ? (brokerHint ?? t("home.disabledNeedInvite"))
                  : undefined
              }
              onClick={() => void session.callPeer(inviteKey)}
            >
              {t("home.call")}
            </Button>
            <Button
              variant="secondary"
              className="w-full"
              disabled={inviteDisabled}
              title={
                inviteDisabled
                  ? (brokerHint ?? t("home.disabledNeedInvite"))
                  : undefined
              }
              onClick={() => void session.joinRoom(inviteKey)}
            >
              {t("home.join")}
            </Button>
          </div>
        </section>

        <section className="rounded-3xl border border-line bg-panel p-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <QualityBadge />
          <label className="flex items-center gap-2 text-sm text-zinc-400">
            <input
              type="checkbox"
              checked={tier === "pro"}
              onChange={(e) => {
                const next = e.target.checked ? "pro" : "free";
                setDemoTier(next);
                setTier(next);
                void session.reapplyQuality();
              }}
            />
            {t("home.simulatePro")}
          </label>
        </section>
      </div>
    </main>
  );
};
