import { memo, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from "react";
import { useI18n } from "@i18n/use-i18n";
import { cn } from "@libs/cn";
import type { MuteFlags, MuteKind } from "@libs/mutes";
import {
  getPlaybackVolume,
  playbackKey,
  setPlaybackVolume,
  subscribePlaybackVolume,
} from "@libs/playback-volume";
import { firstGrapheme } from "@libs/text";
import { useSpeakLevel } from "@libs/use-speak-level";
import { ExpandIcon, UserRemoveIcon } from "./Icons";
import { TileMuteControls } from "./TileMuteControls";
import { Tooltip } from "./Tooltip";

type Props = {
  stream: MediaStream | null;
  name: string;
  peerId?: string;
  local?: boolean;
  mutedAudio?: boolean;
  cameraOff?: boolean;
  sharingScreen?: boolean;
  className?: string;
  onPin?: (peerId: string) => void;
  onRemove?: (peerId: string) => void;
  isHostViewer?: boolean;
  localMute?: MuteFlags;
  roomMute?: MuteFlags;
  onToggleLocal?: (peerId: string, kind: MuteKind) => void;
  onSetRoom?: (peerId: string, kind: MuteKind, muted: boolean) => void;
};

export const VideoTile = memo(({
  stream,
  name,
  peerId,
  local,
  mutedAudio,
  cameraOff,
  sharingScreen,
  className,
  onPin,
  onRemove,
  isHostViewer,
  localMute,
  roomMute,
  onToggleLocal,
  onSetRoom,
}: Props) => {
  const ref = useRef<HTMLVideoElement>(null);
  const tileRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [menuAt, setMenuAt] = useState<{ x: number; y: number } | null>(null);
  const { t } = useI18n();
  const volumeId = peerId ? playbackKey(peerId, !!sharingScreen) : "";
  const volume = useSyncExternalStore(
    subscribePlaybackVolume,
    () => (volumeId ? getPlaybackVolume(volumeId) : 1),
    () => 1,
  );
  useSpeakLevel(stream, !sharingScreen, tileRef);

  useEffect(() => {
    const el = ref.current;
    if (!el) {
      return;
    }
    el.srcObject = stream;
    if (stream) {
      void el.play().catch(() => undefined);
    }
    return () => {
      el.srcObject = null;
    };
  }, [stream]);

  useEffect(() => {
    const el = ref.current;
    if (!el || local) {
      return;
    }
    el.volume = volume;
  }, [volume, local, stream]);

  useEffect(() => {
    if (!menuAt) {
      return;
    }
    const onPointer = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        menuRef.current?.contains(event.target)
      ) {
        return;
      }
      setMenuAt(null);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMenuAt(null);
      }
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuAt]);

  useLayoutEffect(() => {
    const el = menuRef.current;
    if (!el || !menuAt) {
      return;
    }
    const rect = el.getBoundingClientRect();
    const x = Math.max(8, Math.min(menuAt.x, window.innerWidth - rect.width - 8));
    const y = Math.max(8, Math.min(menuAt.y, window.innerHeight - rect.height - 8));
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
  }, [menuAt]);

  const blank = !stream || (cameraOff && !sharingScreen);
  const id = peerId ?? "";
  const audioLocked = !!roomMute?.audio && !isHostViewer;
  const videoLocked = !!roomMute?.video && !isHostViewer;

  return (
    <div
      ref={tileRef}
      onContextMenu={(event) => {
        if (local || !peerId) {
          return;
        }
        event.preventDefault();
        setMenuAt({ x: event.clientX, y: event.clientY });
      }}
      className={cn(
        "relative overflow-hidden rounded-2xl bg-zinc-900 border border-line min-h-40 speak-ring",
        className,
      )}
    >
      <video
        ref={ref}
        autoPlay
        playsInline
        muted={local || mutedAudio}
        className={cn(
          "h-full w-full",
          sharingScreen ? "object-contain bg-black" : "object-cover",
          local &&
            !sharingScreen &&
            stream?.getVideoTracks()[0]?.getSettings?.().facingMode !==
              "environment" &&
            "-scale-x-100",
          blank && "opacity-0",
        )}
      />
      {blank && (
        <div className="absolute inset-0 grid place-items-center">
          <div className="size-16 rounded-full bg-zinc-800 grid place-items-center text-xl font-semibold text-zinc-300">
            {firstGrapheme(name).toUpperCase()}
          </div>
        </div>
      )}
      <div className="absolute top-2 right-2 flex gap-1">
        {onRemove && peerId && (
          <Tooltip label={t("call.remove")}>
            <button
              type="button"
              aria-label={`${t("call.remove")}: ${name}`}
              onClick={() => onRemove(id)}
              className="grid size-8 place-items-center rounded-full border border-white/20 bg-black/60 text-white hover:bg-red-500/80 cursor-pointer"
            >
              <UserRemoveIcon width={16} height={16} />
            </button>
          </Tooltip>
        )}
        {onPin && peerId && (
          <Tooltip label={t("call.pinScreen")}>
            <button
              type="button"
              aria-label={`${t("call.pinScreen")}: ${name}`}
              onClick={() => onPin(id)}
              className="grid size-8 place-items-center rounded-full border border-white/20 bg-black/60 text-white hover:bg-black/80 cursor-pointer"
            >
              <ExpandIcon width={16} height={16} />
            </button>
          </Tooltip>
        )}
      </div>
      <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 bg-linear-to-t from-black/70 to-transparent px-3 py-2 text-xs text-white">
        <span className="font-medium truncate">
          {name}
          {local ? t("common.youSuffix") : ""}
        </span>
        <div className="flex shrink-0 items-center gap-1">
          {onToggleLocal && peerId && (
            <TileMuteControls
              name={name}
              isHostViewer={!!isHostViewer}
              localMute={localMute}
              roomMute={roomMute}
              onToggleLocal={(kind) => onToggleLocal(id, kind)}
              onSetRoom={
                onSetRoom
                  ? (kind, muted) => onSetRoom(id, kind, muted)
                  : undefined
              }
            />
          )}
          {sharingScreen && (
            <span className="text-accent">{t("common.screen")}</span>
          )}
        </div>
      </div>
      {menuAt && peerId && (
        <div
          ref={menuRef}
          role="menu"
          style={{ left: menuAt.x, top: menuAt.y }}
          className="fixed z-50 w-52 overflow-hidden rounded-xl border border-line bg-zinc-900 py-1 text-xs text-zinc-100 shadow-xl"
          onContextMenu={(event) => event.preventDefault()}
        >
          {onToggleLocal && (
            <MenuAction
              label={
                audioLocked
                  ? t("call.hostMutedAudio")
                  : t(localMute?.audio ? "call.unmuteForMe" : "call.muteForMe")
              }
              disabled={audioLocked}
              onPick={() => {
                onToggleLocal(id, "audio");
                setMenuAt(null);
              }}
            />
          )}
          {onSetRoom && (
            <MenuAction
              label={t(
                roomMute?.audio ? "call.unmuteForRoom" : "call.muteForRoom",
              )}
              onPick={() => {
                onSetRoom(id, "audio", !roomMute?.audio);
                setMenuAt(null);
              }}
            />
          )}
          {onToggleLocal && (
            <MenuAction
              label={
                videoLocked
                  ? t("call.hostMutedVideo")
                  : t(
                      localMute?.video
                        ? "call.unmuteVideoForMe"
                        : "call.muteVideoForMe",
                    )
              }
              disabled={videoLocked}
              onPick={() => {
                onToggleLocal(id, "video");
                setMenuAt(null);
              }}
            />
          )}
          {onSetRoom && (
            <MenuAction
              label={t(
                roomMute?.video
                  ? "call.unmuteVideoForRoom"
                  : "call.muteVideoForRoom",
              )}
              onPick={() => {
                onSetRoom(id, "video", !roomMute?.video);
                setMenuAt(null);
              }}
            />
          )}
          <label className="block px-3 py-2">
            <span className="mb-1 block text-zinc-300">
              {t(sharingScreen ? "call.volumeScreen" : "call.volume")}
            </span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={volume}
              aria-label={`${t(sharingScreen ? "call.volumeScreen" : "call.volume")}: ${name}`}
              onChange={(event) => {
                setPlaybackVolume(volumeId, Number(event.target.value));
              }}
              className="w-full accent-teal-300"
            />
          </label>
        </div>
      )}
    </div>
  );
});

const MenuAction = ({
  label,
  disabled,
  onPick,
}: {
  label: string;
  disabled?: boolean;
  onPick: () => void;
}) => {
  return (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      className="block w-full px-3 py-2 text-left hover:bg-zinc-800 disabled:cursor-not-allowed disabled:text-zinc-500 disabled:hover:bg-transparent"
      onClick={onPick}
    >
      {label}
    </button>
  );
};
