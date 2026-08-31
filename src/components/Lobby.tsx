import { useI18n } from "../i18n/use-i18n";
import type { PeerInfo } from "../lib/types";
import { Button } from "./Button";

type Props = {
  pending: PeerInfo[];
  onAdmit: (peerId: string) => void;
  onDeny: (peerId: string) => void;
};

/**
 * Fica ao lado da chamada em vez de cobri-la: o host continua conversando
 * enquanto decide, e uma segunda pessoa batendo na porta não rouba o foco.
 */
export const Lobby = ({ pending, onAdmit, onDeny }: Props) => {
  const { t } = useI18n();
  if (pending.length === 0) return null;

  return (
    <aside
      aria-label={t("lobby.title")}
      className="pointer-events-auto fixed right-3 top-20 z-40 w-[min(100%-1.5rem,20rem)] rounded-2xl border border-line bg-panel/95 p-4 shadow-2xl backdrop-blur"
    >
      <h2 className="text-sm font-semibold">{t("lobby.title")}</h2>
      <p className="mt-1 text-xs text-zinc-500">{t("lobby.body")}</p>
      <ul className="mt-3 flex flex-col gap-2">
        {pending.map((peer) => (
          <li key={peer.peerId} className="flex items-center gap-2">
            <span className="min-w-0 flex-1 truncate text-sm text-zinc-200">
              {peer.displayName}
            </span>
            <Button
              className="shrink-0 px-3 py-1.5 text-xs"
              onClick={() => onAdmit(peer.peerId)}
            >
              {t("lobby.admit")}
            </Button>
            <Button
              variant="secondary"
              className="shrink-0 px-3 py-1.5 text-xs"
              onClick={() => onDeny(peer.peerId)}
            >
              {t("lobby.deny")}
            </Button>
          </li>
        ))}
      </ul>
    </aside>
  );
};
