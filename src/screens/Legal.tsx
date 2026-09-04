import { LanguageSwitcher } from "@components/LanguageSwitcher";
import { ThemeToggle } from "@components/ThemeToggle";
import { useI18n } from "@i18n/use-i18n";
import { legalDoc } from "@i18n/legal";
import { legalHref, type LegalKind } from "@libs/spa-path";
import { useEffect } from "react";

type Props = {
  kind: LegalKind;
};

export const Legal = ({ kind }: Props) => {
  const { t, locale } = useI18n();
  const doc = legalDoc(kind, locale);
  const other: LegalKind = kind === "privacy" ? "terms" : "privacy";

  useEffect(() => {
    const previousTitle = document.title;
    document.title = `${doc.title} — SimpleChat`;
    const meta = document.querySelector('meta[name="description"]');
    const previousDescription = meta?.getAttribute("content") ?? "";
    meta?.setAttribute("content", doc.intro);
    return () => {
      document.title = previousTitle;
      meta?.setAttribute("content", previousDescription);
    };
  }, [doc]);

  return (
    <main className="min-h-dvh px-4 py-8">
      <div className="mx-auto max-w-2xl space-y-8">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-accent">
              SimpleChat
            </p>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight">
              {doc.title}
            </h1>
            <p className="mt-2 text-sm text-zinc-500">
              {t("legal.updated", { date: doc.updated })}
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            <LanguageSwitcher />
            <ThemeToggle />
          </div>
        </header>

        <p className="text-sm leading-relaxed text-zinc-400">{doc.intro}</p>

        <div className="space-y-8">
          {doc.sections.map((section) => (
            <section key={section.heading}>
              <h2 className="text-lg font-medium">{section.heading}</h2>
              {section.paragraphs.map((paragraph) => (
                <p
                  key={paragraph}
                  className="mt-2 text-sm leading-relaxed text-zinc-400"
                >
                  {paragraph}
                </p>
              ))}
            </section>
          ))}
        </div>

        <nav
          aria-label={t("legal.nav")}
          className="flex flex-wrap gap-x-4 gap-y-2 border-t border-line pt-6 text-sm"
        >
          <a
            href="/"
            className="text-zinc-300 underline-offset-2 hover:text-zinc-100 hover:underline"
          >
            {t("legal.back")}
          </a>
          <a
            href={legalHref(other)}
            className="text-zinc-500 underline-offset-2 hover:text-zinc-200 hover:underline"
          >
            {t(other === "privacy" ? "legal.privacy" : "legal.terms")}
          </a>
        </nav>
      </div>
    </main>
  );
};
