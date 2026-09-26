import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@components/Button";
import { ChatPanel } from "@components/ChatPanel";
import {
  CameraIcon,
  CameraOffIcon,
  FlipCameraIcon,
  ChatIcon,
  CheckIcon,
  CopyIcon,
  MicIcon,
  MicOffIcon,
  PhoneOffIcon,
  ScreenIcon,
} from "@components/Icons";
import { HostLeaveDialog } from "@components/HostLeaveDialog";
import { KickDialog } from "@components/KickDialog";
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
import { displayLabel } from "@libs/text";
import type { TimerAction } from "@libs/timer";
import type { PeerInfo } from "@libs/types";
import { useSessionSelector } from "@libs/use-session";

const canDisplay = canShareScreen();

type ScreenItem = {
  id: string;
  stream: MediaStream;
  name: string;
  local: boolean;
};

const iconOff =
  "bg-red-500! hover:bg-red-400! hover:border-red-400 border-red-500";

// Referências estáveis para não furar o memo de `ChatMessages`.
const sendChat = (text: string) => session.sendChat(text);
const sendFile = (file: File) => void session.sendFile(file);
const votePoll = (pollId: string, option: number) =>
  session.votePoll(pollId, option);
const controlTimer = (id: string, action: TimerAction) =>
  session.controlTimer(id, action);

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
          onSend={sendChat}
          onSendFile={sendFile}
          onVote={votePoll}
          onTimerControl={controlTimer}
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
  onAskRemove,
}: {
  pinnedId: string | null;
  showCameras: boolean;
  onPin: (id: string) => void;
  onAskRemove?: (peerId: string) => void;
}) {
  const { t } = useI18n();
  const remotes = useSessionSelector((s) => s.remotes);
  const members = useSessionSelector((s) => s.members);
  const localStream = useSessionSelector((s) => s.localStream);
  const localScreenStream = useSessionSelector((s) => s.localScreenStream);
  const cameraOff = useSessionSelector((s) => s.cameraOff);
  const identity = useSessionSelector((s) => s.identity);
  const hostPeerId = useSessionSelector((s) => s.hostPeerId);
  const isHost = useSessionSelector((s) => s.isHost);
  const localMutes = useSessionSelector((s) => s.localMutes);
  const roomMutes = useSessionSelector((s) => s.roomMutes);
  const roster = useMemo(() => {
    if (members.length > 0) return members;
    const list: PeerInfo[] = remotes.map((remote) => ({
      peerId: remote.peerId,
      displayName: remote.displayName,
    }));
    if (identity) {
      list.unshift({
        peerId: identity.peerId,
        displayName: identity.displayName,
      });
    }
    return list;
  }, [members, remotes, identity]);

  const screens = useMemo(() => {
    const items: ScreenItem[] = [];
    for (const remote of remotes) {
      if (!remote.screenStream) continue;
      items.push({
        id: remote.peerId,
        stream: remote.screenStream,
        name: displayLabel(remote.displayName, remote.peerId, roster),
        local: false,
      });
    }
    if (localScreenStream && identity) {
      items.push({
        id: identity.peerId,
        stream: localScreenStream,
        name: displayLabel(identity.displayName, identity.peerId, roster),
        local: true,
      });
    }
    return items;
  }, [remotes, localScreenStream, identity, roster]);

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
        name={
          identity
            ? displayLabel(identity.displayName, identity.peerId, roster)
            : t("common.you")
        }
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
            name={displayLabel(remote.displayName, remote.peerId, roster)}
            mutedAudio={localMute.audio || roomMute.audio}
            cameraOff={remote.cameraOff || localMute.video || roomMute.video}
            onRemove={isHost ? onAskRemove : undefined}
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
      onRemove={isHost && !item.local ? onAskRemove : undefined}
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
  const [chatOpen, setChatOpen] = useState(
    () => window.matchMedia("(min-width: 768px)").matches,
  );
  const [seenCount, setSeenCount] = useState(0);
  const [copied, setCopied] = useState(false);
  const copiedTimer = useRef(0);
  useEffect(() => () => window.clearTimeout(copiedTimer.current), []);
  const [pinnedId, setPinnedId] = useState<string | null>(null);
  const [showCameras, setShowCameras] = useState(false);
  const [kickRequest, setKickRequest] = useState<{
    peerId: string;
    name: string;
  } | null>(null);
  const me = useSessionSelector((s) => s.identity);
  const remotes = useSessionSelector((s) => s.remotes);
  const members = useSessionSelector((s) => s.members);
  const hostPeerId = useSessionSelector((s) => s.hostPeerId);
  const roomSecret = useSessionSelector((s) => s.roomSecret);
  const roomMutes = useSessionSelector((s) => s.roomMutes);
  const localScreenStream = useSessionSelector((s) => s.localScreenStream);
  const isHost = useSessionSelector((s) => s.isHost);
  const callStatus = useSessionSelector((s) => s.callStatus);
  const pathHint = useSessionSelector((s) => s.pathHint);
  const muted = useSessionSelector((s) => s.muted);
  const cameraOff = useSessionSelector((s) => s.cameraOff);
  const canSwitchCamera = useSessionSelector((s) => s.canSwitchCamera);
  const sharingScreen = useSessionSelector((s) => s.sharingScreen);
  const pending = useSessionSelector((s) => s.pending);
  const leavePrompt = useSessionSelector((s) => s.leavePrompt);
  const unread = useSessionSelector((s) =>
    chatOpen
      ? 0
      : s.messages
          .slice(seenCount)
          .filter((message) => message.fromPeerId !== s.identity?.peerId)
          .length,
  );
  const kickTarget =
    kickRequest && remotes.some((remote) => remote.peerId === kickRequest.peerId)
      ? kickRequest
      : null;

  const setChat = useCallback((open: boolean) => {
    setChatOpen(open);
    setSeenCount(session.getState().messages.length);
  }, []);
  const closeChat = useCallback(() => setChat(false), [setChat]);
  const togglePin = useCallback(
    (id: string) => setPinnedId((cur) => (cur === id ? null : id)),
    [],
  );

  const roomId = hostPeerId ?? me?.peerId ?? "";
  const invite = roomId ? inviteLink(roomId, roomSecret) : "";

  const people = useMemo(() => {
    if (members.length > 0) return members;
    if (!me) return [];
    return [
      { peerId: me.peerId, displayName: me.displayName },
      ...remotes.map((remote) => ({
        peerId: remote.peerId,
        displayName: remote.displayName,
      })),
    ];
  }, [me, members, remotes]);

  const askRemove = useCallback(
    (peerId: string) => {
      const remote = remotes.find((item) => item.peerId === peerId);
      if (!remote) return;
      setKickRequest({
        peerId,
        name: displayLabel(remote.displayName, remote.peerId, people),
      });
    },
    [remotes, people],
  );

  const successorId = electHost(remotes.map((remote) => remote.peerId));
  const successor = remotes.find((remote) => remote.peerId === successorId);
  const successorName = successor
    ? displayLabel(successor.displayName, successor.peerId, people)
    : null;
  const selfRoom = me ? muteOf(roomMutes, me.peerId) : null;
  const screenCount =
    remotes.filter((remote) => remote.screenStream).length +
    (localScreenStream ? 1 : 0);

  return (
    <main className="flex h-dvh overflow-hidden">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <header className="flex shrink-0 items-center justify-between gap-2 border-b border-line px-4 py-3 sm:gap-3">
          <div className="min-w-0">
            <p className="text-xs text-zinc-500">
              {isHost ? t("call.host") : t("call.guest")}
            </p>
            <p className="text-sm text-zinc-300">
              {callStatus === "waiting"
                ? t("call.waiting")
                : callStatus === "connecting"
                  ? t("call.connecting")
                  : t("call.inCall", {
                      count: remotes.length + 1,
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
        {pathHint && (
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
          onPin={togglePin}
          onAskRemove={askRemove}
        />

        <div className="safe-bottom flex shrink-0 flex-wrap items-center justify-center gap-2 px-4 pt-4">
          <Button
            variant="icon"
            className={muted ? iconOff : undefined}
            onClick={() => void session.toggleMute()}
            disabled={!!selfRoom?.audio}
            title={
              selfRoom?.audio
                ? t("call.hostMutedYouAudio")
                : muted
                  ? t("call.unmute")
                  : t("call.mute")
            }
          >
            {muted ? <MicOffIcon /> : <MicIcon />}
          </Button>
          <Button
            variant="icon"
            className={cameraOff ? iconOff : undefined}
            onClick={() => void session.toggleCamera()}
            disabled={!!selfRoom?.video}
            title={
              selfRoom?.video
                ? t("call.hostMutedYouVideo")
                : cameraOff
                  ? t("call.cameraOn")
                  : t("call.cameraOff")
            }
          >
            {cameraOff ? <CameraOffIcon /> : <CameraIcon />}
          </Button>
          {canSwitchCamera && !cameraOff && (
            <Button
              variant="icon"
              onClick={() => void session.switchCamera()}
              disabled={!!selfRoom?.video}
              title={
                selfRoom?.video
                  ? t("call.hostMutedYouVideo")
                  : t("call.switchCamera")
              }
            >
              <FlipCameraIcon />
            </Button>
          )}
          {canDisplay && (
            <Button
              variant="icon"
              className={sharingScreen ? iconOff : undefined}
              onClick={() => void session.shareScreen()}
              title={
                sharingScreen
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
            onClick={() => session.hangUp()}
            title={t("call.leave")}
          >
            <PhoneOffIcon />
          </Button>
        </div>
      </div>

      {kickTarget && (
        <KickDialog
          name={kickTarget.name}
          onConfirm={() => {
            session.kickPeer(kickTarget.peerId);
            setKickRequest(null);
          }}
          onCancel={() => setKickRequest(null)}
        />
      )}

      {isHost && (
        <Lobby
          pending={pending}
          roster={people}
          onAdmit={(peerId) => session.admitPeer(peerId)}
          onDeny={(peerId) => session.denyPeer(peerId)}
        />
      )}

      {leavePrompt && (
        <HostLeaveDialog
          successorName={successorName}
          onTransfer={() => session.transferHostAndLeave()}
          onEnd={() => session.endRoomForAll()}
          onCancel={() => session.cancelLeave()}
        />
      )}

      <CallChatDock
        open={chatOpen}
        people={people}
        onClose={closeChat}
      />
    </main>
  );
};
