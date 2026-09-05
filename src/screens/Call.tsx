import { memo, useEffect, useMemo, useRef, useState } from "react";
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
import { ThemeToggle } from "@components/ThemeToggle";
import { VideoTile } from "@components/VideoTile";
import { useI18n } from "@i18n/use-i18n";
import { cn } from "@libs/cn";
import { inviteLink } from "@libs/invite";
import { canShareScreen } from "@libs/media-access";
import { maxParticipants } from "@libs/quality";
import { muteOf } from "@libs/mutes";
import { screenStageKind } from "@libs/screen-layout";
import { electHost, session } from "@libs/session";
import type { PeerInfo } from "@libs/types";
import { useSession, useSessionSelector } from "@libs/use-session";

const canDisplay = canShareScreen();

type ScreenItem = {
  id: string;
  stream: MediaStream;
  name: string;
  local: boolean;
};

const iconOff =
  "bg-red-500! hover:bg-red-400! hover:border-red-400 border-red-500";

const CallChatDock = memo(function CallChatDock({
  open,
  people,
  onClose,
}: {
  open: boolean;
  people: PeerInfo[];
  onClose: () => void;
}) {
  const messages = useSessionSelector((s) => s.messages);
  const selfId = useSessionSelector((s) => s.identity?.peerId ?? "");
  const hostPeerId = useSessionSelector((s) => s.hostPeerId);
  if (!open || !selfId) return null;
  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/60 md:hidden"
        onClick={onClose}
        aria-hidden
      />
      <div
        className={cn(
          "z-40 flex w-[min(100%,24rem)] flex-col",
          "fixed inset-y-0 right-0 md:static md:z-auto md:w-full md:max-w-sm",
        )}
      >
        <ChatPanel
          messages={messages}
          selfId={selfId}
          hostPeerId={hostPeerId}
          people={people}
          onSend={(text) => session.sendChat(text)}
          onSendFile={(file) => void session.sendFile(file)}
          onVote={(pollId, option) => session.votePoll(pollId, option)}
          onTimerControl={(id, action) => session.controlTimer(id, action)}
          onClose={onClose}
        />
      </div>
    </>
  );
});

const CallStage = memo(function CallStage({
  pinnedId,
  showCameras,
  onPin,
}: {
  pinnedId: string | null;
  showCameras: boolean;
  onPin: (id: string) => void;
}) {
  const { t } = useI18n();
  const remotes = useSessionSelector((s) => s.remotes);
  const localStream = useSessionSelector((s) => s.localStream);
  const localScreenStream = useSessionSelector((s) => s.localScreenStream);
  const cameraOff = useSessionSelector((s) => s.cameraOff);
  const identity = useSessionSelector((s) => s.identity);
  const hostPeerId = useSessionSelector((s) => s.hostPeerId);
  const isHost = useSessionSelector((s) => s.isHost);
  const localMutes = useSessionSelector((s) => s.localMutes);
  const roomMutes = useSessionSelector((s) => s.roomMutes);

  const screens = useMemo(() => {
    const items: ScreenItem[] = [];
    for (const remote of remotes) {
      if (!remote.screenStream) continue;
      items.push({
        id: remote.peerId,
        stream: remote.screenStream,
        name: remote.displayName,
        local: false,
      });
    }
    if (localScreenStream && identity) {
      items.push({
        id: identity.peerId,
        stream: localScreenStream,
        name: identity.displayName,
        local: true,
      });
    }
    return items;
  }, [remotes, localScreenStream, identity]);

  const userPinned =
    pinnedId && screens.some((item) => item.id === pinnedId) ? pinnedId : null;
  const kind = screenStageKind(screens.length, !!userPinned, showCameras);
  const pinHandler = screens.length >= 2 ? onPin : undefined;
  const count = remotes.length + 1;
  const grid =
    count === 1
      ? "grid-cols-1"
      : count === 2
        ? "grid-cols-1 md:grid-cols-2"
        : "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3";
  const screenGrid =
    screens.length <= 1
      ? "grid-cols-1"
      : screens.length === 2
        ? "grid-cols-1 md:grid-cols-2"
        : "grid-cols-1 sm:grid-cols-2";

  const cameraTiles = (compact: boolean) => (
    <>
      <VideoTile
        key="local"
        stream={localStream}
        name={identity?.displayName ?? t("common.you")}
        local
        cameraOff={cameraOff}
        className={compact ? "h-28 w-40 shrink-0 min-h-24" : undefined}
      />
      {remotes.map((remote) => {
        const isHostTile = remote.peerId === hostPeerId;
        const localMute = muteOf(localMutes, remote.peerId);
        const roomMute = muteOf(roomMutes, remote.peerId);
        return (
          <VideoTile
            key={remote.peerId}
            peerId={remote.peerId}
            stream={remote.stream}
            name={remote.displayName}
            mutedAudio={localMute.audio || roomMute.audio}
            cameraOff={remote.cameraOff || localMute.video || roomMute.video}
            onRemove={isHost ? session.kickPeer : undefined}
            isHostViewer={isHost}
            localMute={localMute}
            roomMute={roomMute}
            onToggleLocal={isHostTile ? undefined : session.toggleLocalMute}
            onSetRoom={isHost && !isHostTile ? session.setRoomMute : undefined}
            className={compact ? "h-28 w-40 shrink-0 min-h-24" : undefined}
          />
        );
      })}
    </>
  );

  /** Mantém os `<video>` montados (áudio remoto) mesmo com a faixa oculta. */
  const cameraStrip = (visible: boolean) => (
    <div
      className={
        visible ? "flex shrink-0 gap-2 overflow-x-auto" : "sr-only"
      }
      aria-hidden={!visible}
    >
      {cameraTiles(true)}
    </div>
  );

  const screenTile = (item: ScreenItem, className: string) => (
    <VideoTile
      key={item.id}
      peerId={item.id}
      stream={item.stream}
      name={item.name}
      local={item.local}
      sharingScreen
      onPin={pinHandler}
      onRemove={
        isHost && !item.local ? session.kickPeer : undefined
      }
      className={className}
    />
  );

  if (kind === "cameras") {
    return (
      <div
        className={cn("min-h-0 flex-1 grid gap-3 overflow-y-auto p-3", grid)}
      >
        {cameraTiles(false)}
      </div>
    );
  }

  if (kind === "pinned-solo" && userPinned) {
    const focused = screens.find((item) => item.id === userPinned);
    if (!focused) return null;
    return (
      <div className="flex min-h-0 flex-1 flex-col p-3">
        {screenTile(focused, "min-h-0 flex-1")}
        {cameraStrip(false)}
      </div>
    );
  }

  if (kind === "pinned-strip" && userPinned) {
    const focused = screens.find((item) => item.id === userPinned);
    if (!focused) return null;
    const others = screens.filter((item) => item.id !== userPinned);
    return (
      <div className="flex min-h-0 flex-1 flex-col gap-3 p-3">
        <div className="flex min-h-0 flex-1 flex-col gap-3 lg:flex-row">
          {screenTile(focused, "min-h-52 flex-1")}
          {others.length > 0 && (
            <div className="flex shrink-0 gap-2 overflow-x-auto lg:w-52 lg:flex-col lg:overflow-y-auto">
              {others.map((item) =>
                screenTile(
                  item,
                  "h-28 w-44 shrink-0 min-h-24 lg:h-32 lg:w-full",
                ),
              )}
            </div>
          )}
        </div>
        {cameraStrip(true)}
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 p-3">
      <div className={cn("min-h-0 flex-1 grid gap-3", screenGrid)}>
        {screens.map((item) => screenTile(item, "min-h-0"))}
      </div>
      {cameraStrip(showCameras)}
    </div>
  );
});

export const Call = () => {
  const { t } = useI18n();
  const { state, session: peerSession } = useSession();
  const [chatOpen, setChatOpen] = useState(
    () => window.matchMedia("(min-width: 768px)").matches,
  );
  const [seenCount, setSeenCount] = useState(0);
  const [copied, setCopied] = useState(false);
  const copiedTimer = useRef(0);
  useEffect(() => () => window.clearTimeout(copiedTimer.current), []);
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

  const roomId = state.hostPeerId ?? me?.peerId ?? "";
  const invite = roomId ? inviteLink(roomId, state.roomSecret) : "";

  const people = useMemo(() => {
    if (!me) return [];
    return [
      { peerId: me.peerId, displayName: me.displayName },
      ...state.remotes.map((remote) => ({
        peerId: remote.peerId,
        displayName: remote.displayName,
      })),
    ];
  }, [me, state.remotes]);

  const successorId = electHost(state.remotes.map((remote) => remote.peerId));
  const successorName =
    state.remotes.find((remote) => remote.peerId === successorId)
      ?.displayName ?? null;
  const selfRoom = me ? muteOf(state.roomMutes, me.peerId) : null;
  const screenCount =
    state.remotes.filter((remote) => remote.screenStream).length +
    (state.localScreenStream ? 1 : 0);

  return (
    <main className="flex h-dvh overflow-hidden">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <header className="flex shrink-0 items-center justify-between gap-2 border-b border-line px-4 py-3 sm:gap-3">
          <div className="min-w-0">
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
          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
            <ThemeToggle />
            <LanguageSwitcher className="hidden sm:inline-flex" />
            {invite && (
              <Button
                variant="secondary"
                className="text-xs py-1.5"
                onClick={async () => {
                  await navigator.clipboard.writeText(invite);
                  setCopied(true);
                  window.clearTimeout(copiedTimer.current);
                  copiedTimer.current = window.setTimeout(
                    () => setCopied(false),
                    1600,
                  );
                }}
              >
                {copied ? <CheckIcon /> : <CopyIcon />}
                <span className="hidden sm:inline">{t("call.copyInvite")}</span>
              </Button>
            )}
            {screenCount >= 1 && (
              <Button
                variant="secondary"
                className="px-2.5 text-xs py-1.5 sm:px-4"
                onClick={() => setShowCameras((v) => !v)}
                title={
                  showCameras ? t("call.hideCameras") : t("call.showCameras")
                }
              >
                <CameraIcon width={16} height={16} />
                <span className="hidden sm:inline">
                  {showCameras ? t("call.hideCameras") : t("call.cameras")}
                </span>
              </Button>
            )}
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

        <CallStage
          pinnedId={pinnedId}
          showCameras={showCameras}
          onPin={(id) => setPinnedId((cur) => (cur === id ? null : id))}
        />

        <div className="safe-bottom flex shrink-0 flex-wrap items-center justify-center gap-2 px-4 pt-4">
          <Button
            variant="icon"
            className={state.muted ? iconOff : undefined}
            onClick={() => void peerSession.toggleMute()}
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
            className={state.cameraOff ? iconOff : undefined}
            onClick={() => void peerSession.toggleCamera()}
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
          {canDisplay && (
            <Button
              variant="icon"
              className={state.sharingScreen ? "border-accent text-accent" : ""}
              onClick={() => void peerSession.shareScreen()}
              title={
                state.sharingScreen
                  ? t("call.stopScreen")
                  : t("call.shareScreen")
              }
            >
              <ScreenIcon />
            </Button>
          )}
          <Button
            variant="icon"
            className={
              unread > 0 && !chatOpen
                ? "relative border-accent text-accent"
                : "relative"
            }
            onClick={() => setChat(!chatOpen)}
            title={
              chatOpen
                ? t("chat.close")
                : unread > 0
                  ? `${t("call.openChat")} (${unread})`
                  : t("call.openChat")
            }
          >
            <ChatIcon />
            {unread > 0 && !chatOpen && (
              <span className="absolute -top-1 -right-1 grid min-w-5 place-items-center rounded-full bg-accent px-1 text-[10px] font-semibold leading-5 text-on-accent">
                {unread > 9 ? "9+" : unread}
              </span>
            )}
          </Button>
          <Button
            variant="icon"
            className={iconOff}
            onClick={() => peerSession.hangUp()}
            title={t("call.leave")}
          >
            <PhoneOffIcon />
          </Button>
        </div>
      </div>

      {state.isHost && (
        <Lobby
          pending={state.pending}
          onAdmit={(peerId) => peerSession.admitPeer(peerId)}
          onDeny={(peerId) => peerSession.denyPeer(peerId)}
        />
      )}

      {state.leavePrompt && (
        <HostLeaveDialog
          successorName={successorName}
          onTransfer={() => peerSession.transferHostAndLeave()}
          onEnd={() => peerSession.endRoomForAll()}
          onCancel={() => peerSession.cancelLeave()}
        />
      )}

      <CallChatDock
        open={chatOpen}
        people={people}
        onClose={() => setChat(false)}
      />
    </main>
  );
};
