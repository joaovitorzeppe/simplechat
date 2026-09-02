import { useI18n } from "@i18n/use-i18n";
import { currentTier } from "@libs/quality";
import { cn } from "@libs/cn";

export const QualityBadge = ({
  compact,
  className,
}: {
  compact?: boolean;
  className?: string;
}) => {
  const { t } = useI18n();
  const pro = currentTier() === "pro";
  return (
    <div
      className={cn(
        "flex items-center gap-2 text-xs",
        compact && "flex-row items-center gap-1 sm:flex-col sm:items-start sm:gap-1",
        className,
      )}
    >
      <span
        className={cn(
          "rounded-full px-2.5 py-1 border",
          pro
            ? "border-accent/40 text-accent bg-accent/10"
            : "border-line text-zinc-400 bg-zinc-900",
        )}
      >
        {pro ? t("quality.pro") : t("quality.free")}
      </span>
      {!pro && (
        <span className={cn("text-zinc-500", compact && "hidden sm:inline")}>
          {t("quality.proSoon")}
        </span>
      )}
    </div>
  );
};
