import { useEffect, useState } from "react";
import { Button } from "@components/Button";
import { CheckIcon, CloseIcon, CopyIcon, DownloadIcon } from "@components/Icons";
import { LanguageSwitcher } from "@components/LanguageSwitcher";
import { QualityBadge } from "@components/QualityBadge";
import { useI18n } from "@i18n/use-i18n";
import { clearIdentity } from "@libs/identity";
import { deepLinkJoinArg, inviteJoinArg, inviteLink, parseInvite } from "@libs/invite";
import { useInstallPrompt } from "@libs/pwa";
import { currentTier, setDemoTier } from "@libs/quality";
import { isDev } from "@libs/env";
import { forgetPeer, loadRecents, type Recent } from "@libs/recents";
import { firstGrapheme } from "@libs/text";
import { showToast } from "@libs/toast";
import { useSession } from "@libs/use-session";
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/500.css";

const CopyField = ({
  label,
  value,
  copyLabel,
}: {
  label: string;
  value: string;
  copyLabel: string;
}) => {
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
          aria-label={copyLabel}
          title={copyLabel}
          onClick={() => void copy()}
        >
          {copied ? <CheckIcon /> : <CopyIcon />}
        </Button>
      </div>
    </div>
  );
};

/** Deep link só dispara join uma vez por href (sobrevive ao Strict Mode). */
let consumedJoinHref = "";

export const Home = () => {
  const { t } = useI18n();
  const { state, session } = useSession();
  const { canInstall, showIosHelp, install } = useInstallPrompt();
  // O segredo vem no fragmento, que some se lermos só a query string.
  const [inviteKey, setInviteKey] = useState(() => {
    const found = parseInvite(window.location.href);
    return found ? inviteJoinArg(found) : "";
  });
  const [tier, setTier] = useState(currentTier());
  const [recents, setRecents] = useState<Recent[]>(loadRecents);

  const myId = state.identity?.peerId ?? "";
  const myLink = inviteLink(myId, state.roomSecret);

  useEffect(() => {
    if (!myId || !state.peerReady || state.callStatus !== "idle") return;
    const href = window.location.href;
    if (consumedJoinHref === href) return;
    const arg = deepLinkJoinArg(href, myId);
    if (!arg) return;
    consumedJoinHref = href;
    void session.joinRoom(arg);
  }, [myId, session, state.callStatus, state.peerReady]);

  const applyInvite = (raw: string) => {
    // Colar o link inteiro é o caso comum; guardamos a forma curta mas sem
    // perder o segredo, senão o host recusa a entrada.
    const invite = parseInvite(raw);
    if (!invite) {
      setInviteKey(raw);
      return;
    }
    setInviteKey(inviteJoinArg(invite));
  };

  const brokerHint = state.peerReady
    ? null
    : state.peerError
      ? t(state.peerError)
      : t("home.disabledConnecting");
  const inviteDisabled = !state.peerReady || !inviteKey.trim();
  const startDisabled = !state.peerReady;
  const others = recents.filter((entry) => entry.peerId !== myId);

  return (
    <main className="min-h-dvh px-4 py-8">
      <div className="mx-auto max-w-3xl space-y-6">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-accent">
              SimpleChat
            </p>
            <h1 className="mt-1 text-3xl font-semibold wrap-break-word">
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
              variant="ghost"
              onClick={() => {
                clearIdentity();
                window.location.reload();
              }}
            >
              {t("home.switchIdentity")}
            </Button>
          </div>
        </header>

        <section className="rounded-3xl border border-line bg-panel p-6 space-y-4">
          <CopyField
            label={t("home.yourKey")}
            value={myId}
            copyLabel={t("home.copy")}
          />
          <CopyField
            label={t("home.inviteLink")}
            value={myLink}
            copyLabel={t("home.copy")}
          />
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
            aria-label={t("home.joinTitle")}
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

        {others.length > 0 && (
          <section className="rounded-3xl border border-line bg-panel p-6 space-y-4">
            <div>
              <h2 className="text-lg font-medium">{t("home.recentsTitle")}</h2>
              <p className="mt-1 text-sm text-zinc-400">{t("home.recentsBody")}</p>
            </div>
            <ul className="space-y-2">
              {others.map((entry) => (
                <li
                  key={entry.peerId}
                  className="flex items-center gap-3 rounded-xl border border-line bg-zinc-900 px-3 py-2"
                >
                  <div className="grid size-9 shrink-0 place-items-center rounded-full bg-zinc-800 text-sm font-semibold text-zinc-300">
                    {firstGrapheme(entry.displayName).toUpperCase()}
                  </div>
                  <span className="min-w-0 flex-1 truncate text-sm">
                    {entry.displayName}
                  </span>
                  <Button
                    className="shrink-0 px-3 py-1.5 text-xs"
                    disabled={startDisabled}
                    title={startDisabled ? (brokerHint ?? undefined) : undefined}
                    onClick={() => void session.callPeer(entry.peerId)}
                  >
                    {t("home.recentsCall")}
                  </Button>
                  <Button
                    variant="ghost"
                    className="shrink-0 px-2 py-1"
                    title={t("home.recentsForget")}
                    aria-label={t("home.recentsForget")}
                    onClick={() => {
                      forgetPeer(entry.peerId);
                      setRecents(loadRecents());
                    }}
                  >
                    <CloseIcon width={16} height={16} />
                  </Button>
                </li>
              ))}
            </ul>
          </section>
        )}

        {isDev && (
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
        )}
      </div>
    </main>
  );
};
