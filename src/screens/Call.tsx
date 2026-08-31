import { useMemo, useState } from 'react'
import { Button } from '../components/Button'
import { ChatPanel } from '../components/ChatPanel'
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
} from '../components/Icons'
import { QualityBadge } from '../components/QualityBadge'
import { VideoTile } from '../components/VideoTile'
import { useSession } from '../lib/use-session'
import { cn } from '../lib/cn'

type ScreenItem = {
  id: string
  stream: MediaStream
  name: string
  local: boolean
}

export function Call() {
  const { state, session } = useSession()
  const [chatOpen, setChatOpen] = useState(() => window.matchMedia('(min-width: 768px)').matches)
  const [copied, setCopied] = useState(false)
  const [pinnedId, setPinnedId] = useState<string | null>(null)
  const [showCameras, setShowCameras] = useState(false)
  const me = state.identity
  const invite =
    state.callMode === 'room' && me
      ? `${window.location.origin}/?room=${me.peerId}`
      : me
        ? `${window.location.origin}/?call=${me.peerId}`
        : ''

  const screens = useMemo(() => {
    const items: ScreenItem[] = []
    for (const remote of state.remotes) {
      if (!remote.screenStream) continue
      items.push({
        id: remote.peerId,
        stream: remote.screenStream,
        name: remote.displayName,
        local: false,
      })
    }
    if (state.localScreenStream && me) {
      items.push({
        id: me.peerId,
        stream: state.localScreenStream,
        name: me.displayName,
        local: true,
      })
    }
    return items
  }, [state.remotes, state.localScreenStream, me])

  const focusedId =
    (pinnedId && screens.some((item) => item.id === pinnedId) ? pinnedId : null) ??
    state.screenShareOrder.find((id) => screens.some((item) => item.id === id)) ??
    screens[0]?.id ??
    null
  const focused = screens.find((item) => item.id === focusedId)
  const others = screens.filter((item) => item.id !== focused?.id)
  const hideCameras = screens.length >= 2 && !showCameras
  const count = state.remotes.length + 1
  const grid =
    count === 1 ? 'grid-cols-1' : count === 2 ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1 md:grid-cols-2'

  const cameraTiles = (compact: boolean) => (
    <>
      <VideoTile
        stream={state.localStream}
        name={me?.displayName ?? 'Você'}
        local
        cameraOff={state.cameraOff}
        className={compact ? 'h-28 w-40 shrink-0 min-h-24' : undefined}
      />
      {state.remotes.map((remote) => (
        <VideoTile
          key={remote.peerId}
          stream={remote.stream}
          name={remote.displayName}
          className={compact ? 'h-28 w-40 shrink-0 min-h-24' : undefined}
        />
      ))}
    </>
  )

  return (
    <div className="flex min-h-dvh">
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center justify-between gap-3 px-4 py-3 border-b border-line">
          <div>
            <p className="text-xs text-zinc-500">
              {state.callMode === 'room' ? (state.isHost ? 'Sala · você é o host' : 'Sala') : 'Chamada 1:1'}
            </p>
            <p className="text-sm text-zinc-300">
              {state.callStatus === 'connecting' ? 'Conectando…' : `${state.remotes.length + 1} na chamada`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {invite && (
              <Button
                variant="secondary"
                className="hidden sm:inline-flex text-xs py-1.5"
                onClick={async () => {
                  await navigator.clipboard.writeText(invite)
                  setCopied(true)
                  window.setTimeout(() => setCopied(false), 1600)
                }}
              >
                {copied ? <CheckIcon /> : <CopyIcon />}
                {state.callMode === 'room' ? 'Copiar convite da sala' : 'Copiar convite'}
              </Button>
            )}
            {screens.length >= 2 && (
              <Button
                variant="secondary"
                className="text-xs py-1.5"
                onClick={() => setShowCameras((v) => !v)}
                title={showCameras ? 'Ocultar câmeras' : 'Mostrar câmeras'}
              >
                <CameraIcon width={16} height={16} />
                {showCameras ? 'Ocultar câmeras' : 'Câmeras'}
              </Button>
            )}
            <QualityBadge compact />
          </div>
        </header>

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
            {!hideCameras && <div className="flex shrink-0 gap-2 overflow-x-auto">{cameraTiles(true)}</div>}
          </div>
        ) : (
          <div className={cn('flex-1 grid gap-3 p-3', grid)}>{cameraTiles(false)}</div>
        )}

        <div className="flex flex-wrap items-center justify-center gap-2 px-4 py-4">
          <Button variant="icon" onClick={() => session.toggleMute()} title={state.muted ? 'Ativar microfone' : 'Silenciar'}>
            {state.muted ? <MicOffIcon /> : <MicIcon />}
          </Button>
          <Button
            variant="icon"
            onClick={() => session.toggleCamera()}
            title={state.cameraOff ? 'Ligar câmera' : 'Desligar câmera'}
          >
            {state.cameraOff ? <CameraOffIcon /> : <CameraIcon />}
          </Button>
          <Button
            variant="icon"
            className={state.sharingScreen ? 'border-accent text-accent' : ''}
            onClick={() => void session.shareScreen()}
            title="Compartilhar tela"
          >
            <ScreenIcon />
          </Button>
          <Button variant="icon" onClick={() => setChatOpen((v) => !v)} title="Chat">
            <ChatIcon />
          </Button>
          <Button variant="icon" className="bg-red-500 hover:bg-red-400 border-red-400" onClick={() => session.hangUp()}>
            <PhoneOffIcon />
          </Button>
        </div>
      </div>

      {chatOpen && me && (
        <div className="hidden w-full max-w-sm md:block">
          <ChatPanel messages={state.messages} selfId={me.peerId} onSend={(text) => session.sendChat(text)} />
        </div>
      )}

      {chatOpen && me && (
        <div className="md:hidden fixed inset-0 z-40 bg-black/60" onClick={() => setChatOpen(false)}>
          <div className="absolute inset-y-0 right-0 w-[min(100%,24rem)]" onClick={(e) => e.stopPropagation()}>
            <ChatPanel messages={state.messages} selfId={me.peerId} onSend={(text) => session.sendChat(text)} />
          </div>
        </div>
      )}
    </div>
  )
}
