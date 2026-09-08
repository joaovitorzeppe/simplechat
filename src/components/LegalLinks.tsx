import { useI18n } from "@i18n/use-i18n";
import { cn } from "@libs/cn";
import { GITHUB_URL, KOFI_URL } from "@libs/github";

const linkClass = "underline-offset-2 hover:text-zinc-200 hover:underline";

export const LegalLinks = ({ className }: { className?: string }) => {
  const { t } = useI18n();

  return (
    <nav
      aria-label={t("legal.nav")}
      className={cn(
        "flex flex-wrap gap-x-4 gap-y-1 text-sm text-zinc-500",
        className,
      )}
    >
      <a href="/privacy" className={linkClass}>
        {t("legal.privacy")}
      </a>
      <a href="/terms" className={linkClass}>
        {t("legal.terms")}
      </a>
      <a
        href={GITHUB_URL}
        className={linkClass}
        target="_blank"
        rel="noopener noreferrer"
      >
        {t("legal.github")}
      </a>
      <a
        href={KOFI_URL}
        className={linkClass}
        target="_blank"
        rel="noopener noreferrer"
      >
        {t("legal.kofi")}
      </a>
    </nav>
  );
};
