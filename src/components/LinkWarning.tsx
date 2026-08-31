import { useI18n } from "../i18n/use-i18n";
import { useDialogFocus } from "../lib/use-dialog-focus";
import { Button } from "./Button";

type Props = {
  href: string;
  onCancel: () => void;
  onOpen: () => void;
};

export const LinkWarning = ({ href, onCancel, onOpen }: Props) => {
  const { t } = useI18n();
  const dialogRef = useDialogFocus<HTMLDivElement>(onCancel);

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4"
      onClick={onCancel}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="link-warning-title"
        className="w-full max-w-sm rounded-3xl border border-line bg-panel p-6 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <p className="text-xs uppercase tracking-widest text-zinc-500">
          {t("chat.linkWarningKicker")}
        </p>
        <h2 id="link-warning-title" className="mt-2 text-xl font-semibold">
          {t("chat.linkWarningTitle")}
        </h2>
        <p className="mt-2 text-sm text-zinc-400">
          {t("chat.linkWarningBody")}
        </p>
        <p className="mt-4 break-all rounded-xl border border-line bg-zinc-900 px-3 py-2 font-mono text-xs text-zinc-200">
          {href}
        </p>
        <div className="mt-6 flex gap-3">
          <Button variant="secondary" className="flex-1" onClick={onCancel}>
            {t("chat.linkCancel")}
          </Button>
          <Button className="flex-1" onClick={onOpen}>
            {t("chat.linkOpen")}
          </Button>
        </div>
      </div>
    </div>
  );
};
