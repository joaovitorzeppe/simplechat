import { useMemo, useState } from "react";
import { Button } from "@components/Button";
import { ChatPanel } from "@components/ChatPanel";
import {
  CameraIcon,
  CameraOffIcon,
  ChatIcon,
  CheckIcon,
  CopyIcon,
  MicIcon,
  MicOffIcon,
  PhoneOffIcon,
  ScreenIcon,
} from "@components/Icons";
import { HostLeaveDialog } from "@components/HostLeaveDialog";
import { LanguageSwitcher } from "@components/LanguageSwitcher";
import { Lobby } from "@components/Lobby";
import { QualityBadge } from "@components/QualityBadge";
import { VideoTile } from "@components/VideoTile";
import { useI18n } from "@i18n/use-i18n";
import { cn } from "@libs/cn";
import { inviteLink } from "@libs/invite";
import { maxParticipants } from "@libs/quality";
import { muteOf, type MuteKind } from "@libs/mutes";
import { electHost } from "@libs/session";
import { useSession } from "@libs/use-session";
import "@fontsource/ibm-plex-mono/400.css";
import "@fontsource/ibm-plex-mono/500.css";

type ScreenItem = {
  id: string;
  stream: MediaStream;
  name: string;
  local: boolean;
};

export const Call = () => {
  const { t } = useI18n();
  const { state, session } = useSession();
  const [chatOpen, setChatOpen] = useState(
    () => window.matchMedia("(min-width: 768px)").matches,
  );
  const [seenCount, setSeenCount] = useState(0);
  const [copied, setCopied] = useState(false);
  const [pinnedId, setPinnedId] = useState<string | null>(null);
  const [showCameras, setShowCameras] = useState(false);
  const me = state.identity;
  const selfId = me?.peerId;
  const unread = chatOpen
    ? 0
    : state.messages
        .slice(seenCount)
        .filter((message) => message.fromPeerId !== selfId).length;

  const setChat = (open: boolean) => {
    setChatOpen(open);
    setSeenCount(state.messages.length);
  };

  // Sempre o link do host: é a sala dele que aceita entradas.
  const roomId = state.hostPeerId ?? me?.peerId ?? "";
  const invite = roomId ? inviteLink(roomId, state.roomSecret) : "";

  const people = useMemo(() => {
    if (!me) return [];
    return [
      { peerId: me.peerId, displayName: me.displayName },
      ...state.remotes,
    ];
  }, [me, state.remotes]);
  const successorId = electHost(state.remotes.map((remote) => remote.peerId));
  const successorName =
    state.remotes.find((remote) => remote.peerId === successorId)
      ?.displayName ?? null;

  const screens = useMemo(() => {
    const items: ScreenItem[] = [];
    for (const remote of state.remotes) {
      if (!remote.screenStream) continue;
      items.push({
        id: remote.peerId,
        stream: remote.screenStream,
        name: remote.displayName,
        local: false,
      });
    }
    if (state.localScreenStream && me) {
      items.push({
        id: me.peerId,
        stream: state.localScreenStream,
        name: me.displayName,
        local: true,
      });
    }
    return items;
  }, [state.remotes, state.localScreenStream, me]);

  const focusedId =
    (pinnedId && screens.some((item) => item.id === pinnedId)
      ? pinnedId
      : null) ??
    state.screenShareOrder.find((id) =>
      screens.some((item) => item.id === id),
    ) ??
    screens[0]?.id ??
    null;
  const focused = screens.find((item) => item.id === focusedId);
  const others = screens.filter((item) => item.id !== focused?.id);
  const hideCameras = screens.length >= 2 && !showCameras;
  const count = state.remotes.length + 1;
  const selfRoom = me ? muteOf(state.roomMutes, me.peerId) : null;
  const grid =
    count === 1
      ? "grid-cols-1"
      : count === 2
        ? "grid-cols-1 md:grid-cols-2"
        : "grid-cols-1 md:grid-cols-2";

  const cameraTiles = (compact: boolean) => (
    <>
      <VideoTile
        key="local"
        stream={state.localStream}
        name={me?.displayName ?? t("common.you")}
        local
        cameraOff={state.cameraOff}
        className={compact ? "h-28 w-40 shrink-0 min-h-24" : undefined}
      />
      {state.remotes.map((remote) => {
        const isHostTile = remote.peerId === state.hostPeerId;
        const localMute = muteOf(state.localMutes, remote.peerId);
        const roomMute = muteOf(state.roomMutes, remote.peerId);
        return (
          <VideoTile
            key={remote.peerId}
            stream={remote.stream}
            name={remote.displayName}
            mutedAudio={localMute.audio || roomMute.audio}
            cameraOff={remote.cameraOff || localMute.video || roomMute.video}
            onRemove={
              state.isHost ? () => session.kickPeer(remote.peerId) : undefined
            }
            isHostViewer={state.isHost}
            localMute={localMute}
            roomMute={roomMute}
            onToggleLocal={
              isHostTile
                ? undefined
                : (kind: MuteKind) =>
                    session.toggleLocalMute(remote.peerId, kind)
            }
            onSetRoom={
              state.isHost && !isHostTile
                ? (kind, muted) =>
                    session.setRoomMute(remote.peerId, kind, muted)
                : undefined
            }
            className={compact ? "h-28 w-40 shrink-0 min-h-24" : undefined}
          />
        );
      })}
    </>
  );

  return (
    <main className="flex min-h-dvh">
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between gap-3 px-4 py-3 border-b border-line">
          <div>
            <p className="text-xs text-zinc-500">
              {state.isHost ? t("call.host") : t("call.guest")}
            </p>
            <p className="text-sm text-zinc-300">
              {state.callStatus === "waiting"
                ? t("call.waiting")
                : state.callStatus === "connecting"
                  ? t("call.connecting")
                  : t("call.inCall", {
                      count: state.remotes.length + 1,
                      max: maxParticipants(),
                    })}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <LanguageSwitcher className="hidden sm:inline-flex" />
            {invite && (
              <Button
                variant="secondary"
                className="hidden sm:inline-flex text-xs py-1.5"
                onClick={async () => {
                  await navigator.clipboard.writeText(invite);
                  setCopied(true);
                  window.setTimeout(() => setCopied(false), 1600);
                }}
              >
                {copied ? <CheckIcon /> : <CopyIcon />}
                {t("call.copyInvite")}
              </Button>
            )}
            {screens.length >= 2 && (
              <Button
                variant="secondary"
                className="text-xs py-1.5"
                onClick={() => setShowCameras((v) => !v)}
                title={
                  showCameras ? t("call.hideCameras") : t("call.showCameras")
                }
              >
                <CameraIcon width={16} height={16} />
                {showCameras ? t("call.hideCameras") : t("call.cameras")}
              </Button>
            )}
            <QualityBadge compact />
          </div>
        </header>
        {state.pathHint && (
          <p
            role="status"
            className="border-b border-amber-900/60 bg-amber-950/50 px-4 py-2 text-sm text-amber-100"
          >
            {t("call.networkHint")}
          </p>
        )}

        {focused ? (
          <div className="flex min-h-0 flex-1 flex-col gap-3 p-3">
            <div className="flex min-h-0 flex-1 flex-col gap-3 lg:flex-row">
              <VideoTile
                stream={focused.stream}
                name={focused.name}
                local={focused.local}
                sharingScreen
                className="min-h-52 flex-1"
              />
              {others.length > 0 && (
                <div className="flex shrink-0 gap-2 overflow-x-auto lg:w-52 lg:flex-col lg:overflow-y-auto">
                  {others.map((item) => (
                    <VideoTile
                      key={item.id}
                      stream={item.stream}
                      name={item.name}
                      local={item.local}
                      sharingScreen
                      onPin={() => setPinnedId(item.id)}
                      className="h-28 w-44 shrink-0 min-h-24 lg:h-32 lg:w-full"
                    />
                  ))}
                </div>
              )}
            </div>
            {!hideCameras && (
              <div className="flex shrink-0 gap-2 overflow-x-auto">
                {cameraTiles(true)}
              </div>
            )}
          </div>
        ) : (
          <div className={cn("flex-1 grid gap-3 p-3", grid)}>
            {cameraTiles(false)}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-center gap-2 px-4 py-4">
          <Button
            variant="icon"
            onClick={() => void session.toggleMute()}
            disabled={!!selfRoom?.audio}
            title={
              selfRoom?.audio
                ? t("call.hostMutedYouAudio")
                : state.muted
                  ? t("call.unmute")
                  : t("call.mute")
            }
          >
            {state.muted ? <MicOffIcon /> : <MicIcon />}
          </Button>
          <Button
            variant="icon"
            onClick={() => void session.toggleCamera()}
            disabled={!!selfRoom?.video}
            title={
              selfRoom?.video
                ? t("call.hostMutedYouVideo")
                : state.cameraOff
                  ? t("call.cameraOn")
                  : t("call.cameraOff")
            }
          >
            {state.cameraOff ? <CameraOffIcon /> : <CameraIcon />}
          </Button>
          <Button
            variant="icon"
            className={state.sharingScreen ? "border-accent text-accent" : ""}
            onClick={() => void session.shareScreen()}
            title={t("call.shareScreen")}
          >
            <ScreenIcon />
          </Button>
          <Button
            variant="icon"
            className={
              unread > 0 && !chatOpen
                ? "relative border-accent text-accent"
                : "relative"
            }
            onClick={() => setChat(!chatOpen)}
            title={
              unread > 0 && !chatOpen
                ? `${t("call.chat")} (${unread})`
                : t("call.chat")
            }
          >
            <ChatIcon />
            {unread > 0 && !chatOpen && (
              <span className="absolute -top-1 -right-1 grid min-w-5 place-items-center rounded-full bg-accent px-1 text-[10px] font-semibold leading-5 text-ink">
                {unread > 9 ? "9+" : unread}
              </span>
            )}
          </Button>
          <Button
            variant="icon"
            className="bg-red-500 hover:bg-red-400 border-red-400"
            onClick={() => session.hangUp()}
            title={t("call.leave")}
          >
            <PhoneOffIcon />
          </Button>
        </div>
      </div>

      {state.isHost && (
        <Lobby
          pending={state.pending}
          onAdmit={(peerId) => session.admitPeer(peerId)}
          onDeny={(peerId) => session.denyPeer(peerId)}
        />
      )}

      {state.leavePrompt && (
        <HostLeaveDialog
          successorName={successorName}
          onTransfer={() => session.transferHostAndLeave()}
          onEnd={() => session.endRoomForAll()}
          onCancel={() => session.cancelLeave()}
        />
      )}

      {chatOpen && me && (
        <div className="hidden w-full max-w-sm md:block">
          <ChatPanel
            messages={state.messages}
            selfId={me.peerId}
            people={people}
            onSend={(text) => session.sendChat(text)}
            onSendFile={(file) => void session.sendFile(file)}
            onClose={() => setChat(false)}
          />
        </div>
      )}

      {chatOpen && me && (
        <div
          className="md:hidden fixed inset-0 z-40 bg-black/60"
          onClick={() => setChat(false)}
        >
          <div
            className="absolute inset-y-0 right-0 w-[min(100%,24rem)]"
            onClick={(e) => e.stopPropagation()}
          >
            <ChatPanel
              messages={state.messages}
              selfId={me.peerId}
              people={people}
              onSend={(text) => session.sendChat(text)}
              onSendFile={(file) => void session.sendFile(file)}
              onClose={() => setChat(false)}
            />
          </div>
        </div>
      )}
    </main>
  );
};
