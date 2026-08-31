import { useI18n } from "../i18n/use-i18n";
import { useToast } from "../lib/toast";

export const Toast = () => {
  const { t } = useI18n();
  const toast = useToast();
  if (!toast) return null;

  return (
    <div
      role="status"
      aria-live="assertive"
      className="fixed top-6 left-1/2 z-200 w-[min(92vw,24rem)] -translate-x-1/2 rounded-2xl border border-accent bg-zinc-900 px-5 py-3 text-center text-sm font-medium text-zinc-50 shadow-2xl"
    >
      {t(toast.key, toast.vars)}
    </div>
  );
};
