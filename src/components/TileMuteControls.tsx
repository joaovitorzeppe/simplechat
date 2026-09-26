import { useEffect, useId, useRef, useState } from "react";
import type { MessageKey } from "@i18n/locales";
import { useI18n } from "@i18n/use-i18n";
import { cn } from "@libs/cn";
import { MUTE_OFF, type MuteFlags, type MuteKind } from "@libs/mutes";
import { CameraIcon, CameraOffIcon, MicIcon, MicOffIcon } from "./Icons";
import { Tooltip } from "./Tooltip";

type Props = {
  name: string;
  isHostViewer: boolean;
  localMute?: MuteFlags;
  roomMute?: MuteFlags;
  onToggleLocal: (kind: MuteKind) => void;
  onSetRoom?: (kind: MuteKind, muted: boolean) => void;
};

export const TileMuteControls = ({
  name,
  isHostViewer,
  localMute = MUTE_OFF,
  roomMute = MUTE_OFF,
  onToggleLocal,
  onSetRoom,
}: Props) => {
  const { t } = useI18n();
  const [open, setOpen] = useState<MuteKind | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    const onPointer = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(null);
      }
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(null);
      }
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative flex shrink-0 items-center gap-0.5">
      <MuteButton
        kind="audio"
        name={name}
        isHostViewer={isHostViewer}
        localOn={localMute.audio}
        roomOn={roomMute.audio}
        open={open === "audio"}
        onToggleLocal={onToggleLocal}
        onSetRoom={onSetRoom}
        onOpen={() =>
          setOpen((current) => (current === "audio" ? null : "audio"))
        }
        onClose={() => setOpen(null)}
        t={t}
      />
      <MuteButton
        kind="video"
        name={name}
        isHostViewer={isHostViewer}
        localOn={localMute.video}
        roomOn={roomMute.video}
        open={open === "video"}
        onToggleLocal={onToggleLocal}
        onSetRoom={onSetRoom}
        onOpen={() =>
          setOpen((current) => (current === "video" ? null : "video"))
        }
        onClose={() => setOpen(null)}
        t={t}
      />
    </div>
  );
};

type MuteButtonProps = {
  kind: MuteKind;
  name: string;
  isHostViewer: boolean;
  localOn: boolean;
  roomOn: boolean;
  open: boolean;
  onToggleLocal: (kind: MuteKind) => void;
  onSetRoom?: (kind: MuteKind, muted: boolean) => void;
  onOpen: () => void;
  onClose: () => void;
  t: (key: MessageKey) => string;
};

const MuteButton = ({
  kind,
  name,
  isHostViewer,
  localOn,
  roomOn,
  open,
  onToggleLocal,
  onSetRoom,
  onOpen,
  onClose,
  t,
}: MuteButtonProps) => {
  const menuId = useId();
  const locked = roomOn && !isHostViewer;
  const off = localOn || roomOn;
  const audio = kind === "audio";
  const Icon = off
    ? audio
      ? MicOffIcon
      : CameraOffIcon
    : audio
      ? MicIcon
      : CameraIcon;
  const label = locked
    ? t(audio ? "call.hostMutedAudio" : "call.hostMutedVideo")
    : isHostViewer
      ? t(audio ? "call.muteAudioOptions" : "call.muteVideoOptions")
      : off
        ? t(audio ? "call.unmuteForMe" : "call.unmuteVideoForMe")
        : t(audio ? "call.muteForMe" : "call.muteVideoForMe");

  const trigger = (
    <button
      type="button"
      disabled={locked}
      aria-pressed={off}
      aria-expanded={isHostViewer ? open : undefined}
      aria-haspopup={isHostViewer ? "menu" : undefined}
      aria-controls={isHostViewer && open ? menuId : undefined}
      aria-label={`${label}: ${name}`}
      onClick={() => {
        if (locked) {
          return;
        }
        if (isHostViewer && onSetRoom) {
          onOpen();
        } else {
          onToggleLocal(kind);
        }
      }}
      className={cn(
        "grid size-8 place-items-center rounded-full border",
        locked ? "cursor-not-allowed opacity-70" : "cursor-pointer",
        off
          ? "border-red-500 bg-red-500 text-white"
          : "border-white/20 bg-black/60 text-white",
      )}
    >
      <Icon width={16} height={16} />
    </button>
  );

  return (
    <div className="relative">
      <Tooltip label={label} touchToast={locked}>
        {trigger}
      </Tooltip>
      {open && onSetRoom && (
        <div
          id={menuId}
          role="menu"
          className="absolute bottom-full right-0 z-30 mb-1 w-44 overflow-hidden rounded-xl border border-line bg-zinc-900 py-1 shadow-xl"
        >
          <MenuItem
            label={
              localOn
                ? t(audio ? "call.unmuteForMe" : "call.unmuteVideoForMe")
                : t(audio ? "call.muteForMe" : "call.muteVideoForMe")
            }
            onPick={() => {
              onToggleLocal(kind);
              onClose();
            }}
          />
          <MenuItem
            label={
              roomOn
                ? t(audio ? "call.unmuteForRoom" : "call.unmuteVideoForRoom")
                : t(audio ? "call.muteForRoom" : "call.muteVideoForRoom")
            }
            onPick={() => {
              onSetRoom(kind, !roomOn);
              onClose();
            }}
          />
        </div>
      )}
    </div>
  );
};

const MenuItem = ({ label, onPick }: { label: string; onPick: () => void }) => {
  return (
    <button
      type="button"
      role="menuitem"
      className="block w-full px-3 py-2 text-left text-xs text-zinc-100 hover:bg-zinc-800"
      onClick={onPick}
    >
      {label}
    </button>
  );
};
