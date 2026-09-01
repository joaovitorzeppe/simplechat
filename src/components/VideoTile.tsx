import { memo, useEffect, useRef } from "react";
import { useI18n } from "@i18n/use-i18n";
import { cn } from "@libs/cn";
import type { MuteFlags, MuteKind } from "@libs/mutes";
import { firstGrapheme } from "@libs/text";
import { ExpandIcon, UserRemoveIcon } from "./Icons";
import { TileMuteControls } from "./TileMuteControls";

type Props = {
  stream: MediaStream | null;
  name: string;
  local?: boolean;
  mutedAudio?: boolean;
  cameraOff?: boolean;
  sharingScreen?: boolean;
  className?: string;
  onPin?: () => void;
  onRemove?: () => void;
  isHostViewer?: boolean;
  localMute?: MuteFlags;
  roomMute?: MuteFlags;
  onToggleLocal?: (kind: MuteKind) => void;
  onSetRoom?: (kind: MuteKind, muted: boolean) => void;
};

export const VideoTile = memo(function VideoTile({
  stream,
  name,
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
}: Props) {
  const ref = useRef<HTMLVideoElement>(null);
  const { t } = useI18n();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.srcObject = stream;
    return () => {
      el.srcObject = null;
    };
  }, [stream]);

  const blank = !stream || cameraOff;

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl bg-zinc-900 border border-line min-h-40",
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
          local && !sharingScreen && "-scale-x-100",
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
        {onRemove && (
          <button
            type="button"
            title={t("call.remove")}
            aria-label={`${t("call.remove")}: ${name}`}
            onClick={onRemove}
            className="grid size-8 place-items-center rounded-full border border-line bg-black/60 text-zinc-100 hover:bg-red-500/80 cursor-pointer"
          >
            <UserRemoveIcon width={16} height={16} />
          </button>
        )}
        {onPin && (
          <button
            type="button"
            title={t("call.pinScreen")}
            aria-label={`${t("call.pinScreen")}: ${name}`}
            onClick={onPin}
            className="grid size-8 place-items-center rounded-full border border-line bg-black/60 text-zinc-100 hover:bg-zinc-800 cursor-pointer"
          >
            <ExpandIcon width={16} height={16} />
          </button>
        )}
      </div>
      <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 bg-linear-to-t from-black/70 to-transparent px-3 py-2 text-xs">
        <span className="font-medium truncate">
          {name}
          {local ? t("common.youSuffix") : ""}
        </span>
        <div className="flex shrink-0 items-center gap-1">
          {onToggleLocal && (
            <TileMuteControls
              name={name}
              isHostViewer={!!isHostViewer}
              localMute={localMute}
              roomMute={roomMute}
              onToggleLocal={onToggleLocal}
              onSetRoom={onSetRoom}
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
