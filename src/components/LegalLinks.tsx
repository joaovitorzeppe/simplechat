import { useI18n } from "@i18n/use-i18n";
import { cn } from "@libs/cn";

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
      <a
        href="/privacy"
        className="underline-offset-2 hover:text-zinc-200 hover:underline"
      >
        {t("legal.privacy")}
      </a>
      <a
        href="/terms"
        className="underline-offset-2 hover:text-zinc-200 hover:underline"
      >
        {t("legal.terms")}
      </a>
    </nav>
  );
};
