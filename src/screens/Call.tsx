import { useState } from 'react'
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

export function Call() {
  const { state, session } = useSession()
  const [chatOpen, setChatOpen] = useState(() => window.matchMedia('(min-width: 768px)').matches)
  const [copied, setCopied] = useState(false)
  const me = state.identity
  const invite =
    state.callMode === 'room' && me
      ? `${window.location.origin}/?room=${me.peerId}`
      : me
        ? `${window.location.origin}/?call=${me.peerId}`
        : ''
  const count = state.remotes.length + 1
  const grid =
    count === 1 ? 'grid-cols-1' : count === 2 ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1 md:grid-cols-2'

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
            <QualityBadge compact />
          </div>
        </header>

        <div className={cn('flex-1 grid gap-3 p-3', grid)}>
          <VideoTile
            stream={state.localStream}
            name={me?.displayName ?? 'Você'}
            local
            cameraOff={state.cameraOff && !state.sharingScreen}
            sharingScreen={state.sharingScreen}
          />
          {state.remotes.map((remote) => (
            <VideoTile
              key={remote.peerId}
              stream={remote.stream}
              name={remote.displayName}
              sharingScreen={remote.sharingScreen}
            />
          ))}
        </div>

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
