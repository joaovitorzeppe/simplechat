import { useI18n } from "../i18n/use-i18n";
import { Button } from "./Button";

type Props = {
  name: string;
  onAccept: () => void;
  onReject: () => void;
};

export function IncomingCall({ name, onAccept, onReject }: Props) {
  const { t } = useI18n();
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4">
      <div className="w-full max-w-sm rounded-3xl border border-line bg-panel p-6 shadow-2xl">
        <p className="text-xs uppercase tracking-widest text-zinc-500">
          {t("incoming.title")}
        </p>
        <h2 className="mt-2 text-2xl font-semibold">{name}</h2>
        <p className="mt-1 text-sm text-zinc-400">{t("incoming.body")}</p>
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
}
