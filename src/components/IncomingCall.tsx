import { useEffect } from "react";
import { useI18n } from "../i18n/use-i18n";
import { playRingtone } from "../lib/sounds";
import { useDialogFocus } from "../lib/use-dialog-focus";
import { Button } from "./Button";

type Props = {
  name: string;
  onAccept: () => void;
  onReject: () => void;
};

export const IncomingCall = ({ name, onAccept, onReject }: Props) => {
  const { t } = useI18n();
  const dialogRef = useDialogFocus<HTMLDivElement>(onReject);

  useEffect(() => {
    const stop = playRingtone();
    return stop;
  }, []);

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="incoming-call-title"
        aria-describedby="incoming-call-body"
        className="w-full max-w-sm rounded-3xl border border-line bg-panel p-6 shadow-2xl"
      >
        <p className="text-xs uppercase tracking-widest text-zinc-500">
          {t("incoming.title")}
        </p>
        <h2
          id="incoming-call-title"
          className="mt-2 text-2xl font-semibold wrap-break-word"
        >
          {name}
        </h2>
        <p id="incoming-call-body" className="mt-1 text-sm text-zinc-400">
          {t("incoming.body")}
        </p>
        <div className="mt-6 flex gap-3">
          <Button variant="danger" className="flex-1" onClick={onReject}>
            {t("incoming.reject")}
          </Button>
          <Button className="flex-1" onClick={onAccept}>
            {t("incoming.accept")}
          </Button>
        </div>
      </div>
    </div>
  );
};
