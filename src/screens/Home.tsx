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
    <main className="min-h-dvh grid place-items-center px-4 py-8">
      <div className="w-full max-w-md">
        <section className="rounded-3xl border border-line bg-panel p-8">
          <div className="flex items-start justify-between gap-3">
            <p className="text-xs uppercase tracking-[0.25em] text-accent">
              SimpleChat
            </p>
            <div className="flex flex-wrap items-center justify-end gap-1.5">
              <LanguageSwitcher />
              <ThemeToggle />
              {canInstall && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => void install()}
                  title={t("home.install")}
                >
                  <DownloadIcon />
                </Button>
              )}
              {showIosHelp && !canInstall && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => showToast("home.installIos")}
                  title={t("home.install")}
                >
                  <DownloadIcon />
                </Button>
              )}
            </div>
          </div>

          <h1 className="mt-3 text-3xl font-semibold tracking-tight wrap-break-word">
            {t("home.hello", { name: state.identity?.displayName ?? "" })}
          </h1>
          <p className="mt-2 text-sm text-zinc-400">
            {state.peerReady
              ? t("home.ready")
              : state.peerError
                ? t(state.peerError)
                : t("home.connecting")}
          </p>

          <p className="mt-8 text-sm text-zinc-400">{t("home.inviteBody")}</p>

          <Button
            className="mt-6 w-full py-3.5 text-base"
            disabled={startDisabled}
            title={startDisabled ? (brokerHint ?? undefined) : undefined}
            onClick={() => void session.createRoom()}
          >
            {t("home.startCall")}
          </Button>

          <Button
            variant="ghost"
            className="mt-3 w-full"
            onClick={() => {
              clearIdentity();
              window.location.reload();
            }}
          >
            {t("home.switchIdentity")}
          </Button>
        </section>

        <LegalLinks className="mt-6 justify-center" />
      </div>
    </main>
  );
};
