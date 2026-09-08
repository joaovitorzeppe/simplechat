import { memo, useEffect, useRef } from "react";
import { useI18n } from "@i18n/use-i18n";
import { cn } from "@libs/cn";
import type { MuteFlags, MuteKind } from "@libs/mutes";
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
  badge?: string;
};

export const VideoTile = memo(function VideoTile({
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
  badge,
}: Props) {
  const ref = useRef<HTMLVideoElement>(null);
  const tileRef = useRef<HTMLDivElement>(null);
  const { t } = useI18n();
  useSpeakLevel(stream, !sharingScreen, tileRef);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.srcObject = stream;
    if (stream) void el.play().catch(() => undefined);
    return () => {
      el.srcObject = null;
    };
  }, [stream]);

  const blank = !stream || cameraOff;
  const id = peerId ?? "";

  return (
    <div
      ref={tileRef}
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
          {badge && (
            <span className="rounded-full bg-black/50 px-1.5 py-0.5 font-mono text-[10px] text-white/80">
              {badge}
            </span>
          )}
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
    </div>
  );
});
