import { useEffect } from "react";
import { Button } from "@components/Button";
import { DownloadIcon } from "@components/Icons";
import { LanguageSwitcher } from "@components/LanguageSwitcher";
import { LegalLinks } from "@components/LegalLinks";
import { ThemeToggle } from "@components/ThemeToggle";
import { useI18n } from "@i18n/use-i18n";
import { clearIdentity } from "@libs/identity";
import { deepLinkJoinArg } from "@libs/invite";
import { useInstallPrompt } from "@libs/pwa";
import { showToast } from "@libs/toast";
import { useSession } from "@libs/use-session";

/** Deep link só dispara join uma vez por href (sobrevive ao Strict Mode). */
let consumedJoinHref = "";

export const Home = () => {
  const { t } = useI18n();
  const { state, session } = useSession();
  const { canInstall, showIosHelp, install } = useInstallPrompt();

  const myId = state.identity?.peerId ?? "";

  useEffect(() => {
    if (!myId || !state.peerReady || state.callStatus !== "idle") return;
    const href = window.location.href;
    if (consumedJoinHref === href) return;
    const arg = deepLinkJoinArg(href, myId);
    if (!arg) return;
    consumedJoinHref = href;
    void session.joinRoom(arg);
  }, [myId, session, state.callStatus, state.peerReady]);

  const brokerHint = state.peerReady
    ? null
    : state.peerError
      ? t(state.peerError)
      : t("home.disabledConnecting");
  const startDisabled = !state.peerReady;

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
            <ThemeToggle />
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

        <LegalLinks />
      </div>
    </main>
  );
};
