import { useEffect } from "react";
import { useI18n } from "@i18n/use-i18n";
import { playRingtone } from "@libs/sounds";
import { displayLabel } from "@libs/text";
import type { PeerInfo } from "@libs/types";
import { useDialogFocus } from "@libs/use-dialog-focus";
import { Button } from "./Button";

type Props = {
  pending: PeerInfo[];
  roster: PeerInfo[];
  onAdmit: (peerId: string) => void;
  onDeny: (peerId: string) => void;
};

export const Lobby = ({ pending, roster, onAdmit, onDeny }: Props) => {
  const { t } = useI18n();
  const dialogRef = useDialogFocus<HTMLDivElement>();
  const names = [...roster, ...pending];

  useEffect(() => {
    if (pending.length === 0) return;
    const stop = playRingtone();
    return stop;
  }, [pending.length]);

  if (pending.length === 0) return null;
  const first = pending[0];
  if (!first) return null;
  const alone = pending.length === 1;

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="lobby-title"
        aria-describedby="lobby-body"
        className="w-full max-w-sm rounded-3xl border border-line bg-panel p-6 shadow-2xl"
      >
        <p className="text-xs uppercase tracking-widest text-zinc-500">
          {t("lobby.title")}
        </p>
        <h2
          id="lobby-title"
          className="mt-2 text-2xl font-semibold wrap-break-word"
        >
          {alone
            ? displayLabel(first.displayName, first.peerId, names)
            : t("lobby.title")}
        </h2>
        <p id="lobby-body" className="mt-1 text-sm text-zinc-400">
          {t("lobby.body")}
        </p>
        {alone ? (
          <div className="mt-6 flex gap-3">
            <Button
              variant="danger"
              className="flex-1"
              onClick={() => onDeny(first.peerId)}
            >
              {t("lobby.deny")}
            </Button>
            <Button className="flex-1" onClick={() => onAdmit(first.peerId)}>
              {t("lobby.admit")}
            </Button>
          </div>
        ) : (
          <ul className="mt-6 flex flex-col gap-3">
            {pending.map((peer) => (
              <li key={peer.peerId} className="flex items-center gap-2">
                <span className="min-w-0 flex-1 truncate text-sm font-medium text-zinc-100">
                  {displayLabel(peer.displayName, peer.peerId, names)}
                </span>
                <Button
                  variant="danger"
                  className="shrink-0 px-3 py-1.5 text-xs"
                  onClick={() => onDeny(peer.peerId)}
                >
                  {t("lobby.deny")}
                </Button>
                <Button
                  className="shrink-0 px-3 py-1.5 text-xs"
                  onClick={() => onAdmit(peer.peerId)}
                >
                  {t("lobby.admit")}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};
