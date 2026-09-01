import { useI18n } from "@i18n/use-i18n";
import { useDialogFocus } from "@libs/use-dialog-focus";
import { Button } from "./Button";

type Props = {
  successorName: string | null;
  onTransfer: () => void;
  onEnd: () => void;
  onCancel: () => void;
};

export const HostLeaveDialog = ({
  successorName,
  onTransfer,
  onEnd,
  onCancel,
}: Props) => {
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
        aria-labelledby="host-leave-title"
        className="w-full max-w-sm rounded-3xl border border-line bg-panel p-6 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 id="host-leave-title" className="text-xl font-semibold">
          {t("hostLeave.title")}
        </h2>
        <p className="mt-2 text-sm text-zinc-400">{t("hostLeave.body")}</p>
        <div className="mt-6 flex flex-col gap-2">
          {successorName && (
            <Button onClick={onTransfer}>
              {t("hostLeave.transfer")} · {successorName}
            </Button>
          )}
          <Button
            variant="secondary"
            className="border-red-400 text-red-300 hover:bg-red-500/10"
            onClick={onEnd}
          >
            {t("hostLeave.end")}
          </Button>
          <Button variant="secondary" onClick={onCancel}>
            {t("hostLeave.cancel")}
          </Button>
        </div>
      </div>
    </div>
  );
};
