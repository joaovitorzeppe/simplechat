import { useState, type SubmitEvent } from "react";
import { Button } from "@components/Button";
import { LanguageSwitcher } from "@components/LanguageSwitcher";
import { LegalLinks } from "@components/LegalLinks";
import { ThemeToggle } from "@components/ThemeToggle";
import {
  clearIdentity,
  createIdentity,
  persistIdentity,
} from "@libs/identity";
import { parseInvite } from "@libs/invite";
import type { Identity } from "@libs/types";
import { MAX_DISPLAY_NAME } from "@libs/wire-guard";
import { useI18n } from "@i18n/use-i18n";

type Props = {
  onDone: (identity: Identity) => void;
};

export const Onboarding = ({ onDone }: Props) => {
  const { t } = useI18n();
  const [name, setName] = useState("");
  const [remember, setRemember] = useState(false);
  const fromInvite = Boolean(parseInvite(window.location.href));

  const submit = (event: SubmitEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    const identity = createIdentity(trimmed);
    if (remember) persistIdentity(identity);
    else clearIdentity();
    onDone(identity);
  };

  return (
    <main className="min-h-dvh grid place-items-center px-4">
      <div className="w-full max-w-md">
        <form
          onSubmit={submit}
          className="w-full rounded-3xl border border-line bg-panel p-8"
        >
          <div className="flex items-start justify-between gap-3">
            <p className="text-xs uppercase tracking-[0.25em] text-accent">
              SimpleChat
            </p>
            <div className="flex items-center gap-1.5">
              <LanguageSwitcher />
              <ThemeToggle />
            </div>
          </div>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight">
            {t("onboarding.title")}
          </h1>
          <p className="mt-2 text-sm text-zinc-400">
            {fromInvite ? t("onboarding.inviteSubtitle") : t("onboarding.subtitle")}
          </p>
          <label htmlFor="onboarding-name" className="mt-8 block text-sm text-zinc-400">
            {t("onboarding.name")}
            <input
              id="onboarding-name"
              autoFocus
              autoComplete="nickname"
              value={name}
              maxLength={MAX_DISPLAY_NAME}
              onChange={(e) => setName(e.target.value)}
              className="mt-2 w-full rounded-xl border border-line bg-zinc-900 px-4 py-3 text-base text-zinc-100 outline-none focus:border-accent"
              placeholder={t("onboarding.namePlaceholder")}
            />
          </label>

          <label className="mt-6 flex items-start gap-3 text-sm cursor-pointer">
            <input
              type="checkbox"
              className="mt-1 size-4 accent-accent"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
            />
            <span>
              <strong className="text-zinc-100">
                {t("onboarding.rememberTitle")}
              </strong>
              <span className="mt-1 block text-zinc-400">
                {t("onboarding.rememberBody")}
              </span>
            </span>
          </label>

          <Button type="submit" className="mt-6 w-full" disabled={!name.trim()}>
            {t("onboarding.enter")}
          </Button>
        </form>
        <LegalLinks className="mt-6 justify-center" />
      </div>
    </main>
  );
};
