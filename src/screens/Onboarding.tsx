import { useState, type FormEvent } from "react";
import { Button } from "../components/Button";
import { LanguageSwitcher } from "../components/LanguageSwitcher";
import {
  clearIdentity,
  createIdentity,
  persistIdentity,
} from "../lib/identity";
import type { Identity } from "../lib/types";
import { MAX_DISPLAY_NAME } from "../lib/wire-guard";
import { useI18n } from "../i18n/use-i18n";

type Props = {
  onDone: (identity: Identity) => void;
};

export const Onboarding = ({ onDone }: Props) => {
  const { t } = useI18n();
  const [name, setName] = useState("");
  const [remember, setRemember] = useState(false);

  const submit = (event: FormEvent) => {
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
      <form
        onSubmit={submit}
        className="w-full max-w-md rounded-3xl border border-line bg-panel p-8"
      >
        <div className="flex items-start justify-between gap-3">
          <p className="text-xs uppercase tracking-[0.25em] text-accent">
            SimpleChat
          </p>
          <LanguageSwitcher />
        </div>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">
          {t("onboarding.title")}
        </h1>
        <p className="mt-2 text-sm text-zinc-400">{t("onboarding.subtitle")}</p>
        <label className="mt-8 block text-sm text-zinc-400">
          {t("onboarding.name")}
          <input
            autoFocus
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
            <p className="mt-1 text-zinc-400">{t("onboarding.rememberBody")}</p>
          </span>
        </label>

        <Button type="submit" className="mt-6 w-full" disabled={!name.trim()}>
          {t("onboarding.enter")}
        </Button>
      </form>
    </main>
  );
};
