import { Button } from "./Button";
import { MoonIcon, SunIcon } from "./Icons";
import { useI18n } from "@i18n/use-i18n";
import { toggleTheme } from "@libs/theme";
import { useTheme } from "@libs/use-theme";
import { cn } from "@libs/cn";

export const ThemeToggle = ({ className }: { className?: string }) => {
  const { t } = useI18n();
  const theme = useTheme();
  const label = theme === "light" ? t("theme.toDark") : t("theme.toLight");

  return (
    <Button
      variant="ghost"
      className={cn("size-9 shrink-0 p-0 text-zinc-400 hover:text-zinc-100", className)}
      size="none"
      title={label}
      onClick={toggleTheme}
    >
      {theme === "light" ? <MoonIcon /> : <SunIcon />}
    </Button>
  );
};
