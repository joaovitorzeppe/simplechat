import { useState } from 'react'
import { Button } from '../components/Button'
import { CheckIcon, CopyIcon, HistoryIcon } from '../components/Icons'
import { QualityBadge } from '../components/QualityBadge'
import { clearIdentity } from '../lib/identity'
import { setHistoryOptIn } from '../lib/db'
import { currentTier, setDemoTier } from '../lib/quality'
import { useSession } from '../lib/use-session'

function CopyField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false)

  async function copy() {
    await navigator.clipboard.writeText(value)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1600)
  }

  return (
    <div>
      <div className="mb-2 text-xs uppercase tracking-widest text-zinc-500">{label}</div>
      <div className="flex items-center gap-2 rounded-xl border border-line bg-zinc-900 px-3 py-2">
        <code className="flex-1 truncate font-mono text-xs sm:text-sm">{value}</code>
        <Button variant="ghost" className="px-2 py-1" onClick={() => void copy()}>
          {copied ? <CheckIcon /> : <CopyIcon />}
        </Button>
      </div>
    </div>
  )
}

export function Home() {
  const { state, session } = useSession()
  const params = new URLSearchParams(window.location.search)
  const [peerKey, setPeerKey] = useState(params.get('call') ?? '')
  const [roomKey, setRoomKey] = useState(params.get('room') ?? '')
  const [tier, setTier] = useState(currentTier())

  const myId = state.identity?.peerId ?? ''
  const callLink = `${window.location.origin}/?call=${myId}`
  const roomLink = `${window.location.origin}/?room=${myId}`

  return (
    <main className="min-h-dvh px-4 py-8">
      <div className="mx-auto max-w-3xl space-y-6">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-accent">SimpleChat</p>
            <h1 className="mt-1 text-3xl font-semibold">Olá, {state.identity?.displayName}</h1>
            <p className="mt-1 text-sm text-zinc-400">
              {state.peerReady ? 'Pronto para ligar.' : state.peerError || 'Conectando ao broker PeerJS…'}
            </p>
          </div>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => session.setView('history')}>
              <HistoryIcon /> Histórico
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                clearIdentity()
                setHistoryOptIn(false)
                window.location.reload()
              }}
            >
              Trocar identidade
            </Button>
          </div>
        </header>

        <section className="rounded-3xl border border-line bg-panel p-6 space-y-4">
          <CopyField label="Sua chave" value={myId} />
          <CopyField label="Link para te ligarem" value={callLink} />
        </section>

        <div className="grid gap-4 md:grid-cols-2">
          <section className="rounded-3xl border border-line bg-panel p-6 space-y-4">
            <h2 className="text-lg font-medium">Chamada 1:1</h2>
            <p className="text-sm text-zinc-400">Cole a chave de alguém e ligue. Vale o link ?call= também.</p>
            <input
              value={peerKey}
              onChange={(e) => setPeerKey(e.target.value)}
              placeholder="uuid da outra pessoa"
              className="w-full rounded-xl border border-line bg-zinc-900 px-3 py-2.5 font-mono text-sm outline-none focus:border-accent"
            />
            <Button
              className="w-full"
              disabled={!state.peerReady || !peerKey.trim()}
              onClick={() => void session.startDirect(peerKey)}
            >
              Ligar
            </Button>
          </section>

          <section className="rounded-3xl border border-line bg-panel p-6 space-y-4">
            <h2 className="text-lg font-medium">Sala (mesh)</h2>
            <p className="text-sm text-zinc-400">
              Você vira o host. Quem entra cola a sua chave. Se o host sair, a sala acaba.
            </p>
            <Button
              className="w-full"
              disabled={!state.peerReady}
              onClick={() => void session.createRoom()}
            >
              Criar sala
            </Button>
            <CopyField label="Link da sua sala" value={roomLink} />
            <input
              value={roomKey}
              onChange={(e) => setRoomKey(e.target.value)}
              placeholder="chave do host"
              className="w-full rounded-xl border border-line bg-zinc-900 px-3 py-2.5 font-mono text-sm outline-none focus:border-accent"
            />
            <Button
              variant="secondary"
              className="w-full"
              disabled={!state.peerReady || !roomKey.trim()}
              onClick={() => void session.joinRoom(roomKey)}
            >
              Entrar em sala
            </Button>
          </section>
        </div>

        <section className="rounded-3xl border border-line bg-panel p-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <QualityBadge />
          <label className="flex items-center gap-2 text-sm text-zinc-400">
            <input
              type="checkbox"
              checked={tier === 'pro'}
              onChange={(e) => {
                const next = e.target.checked ? 'pro' : 'free'
                setDemoTier(next)
                setTier(next)
                void session.reapplyQuality()
              }}
            />
            Simular Pro (só neste navegador)
          </label>
        </section>
      </div>
    </main>
  )
}
