import { useEffect, useState } from 'react'
import { Button } from '../components/Button'
import { ArrowLeftIcon } from '../components/Icons'
import {
  clearHistory,
  isHistoryOptIn,
  listHistoryCalls,
  listHistoryMessages,
  setHistoryOptIn,
} from '../lib/db'
import type { HistoryCall, HistoryMessage } from '../lib/types'
import { useSession } from '../lib/use-session'

export function History() {
  const { session } = useSession()
  const [optIn, setOptIn] = useState(isHistoryOptIn())
  const [calls, setCalls] = useState<HistoryCall[]>([])
  const [openId, setOpenId] = useState<string | null>(null)
  const [messages, setMessages] = useState<HistoryMessage[]>([])

  async function refresh() {
    setCalls(await listHistoryCalls())
  }

  useEffect(() => {
    void refresh()
  }, [])

  async function toggleOptIn(enabled: boolean) {
    setHistoryOptIn(enabled)
    setOptIn(enabled)
  }

  async function open(callId: string) {
    setOpenId(callId)
    setMessages(await listHistoryMessages(callId))
  }

  return (
    <main className="min-h-dvh px-4 py-8">
      <div className="mx-auto max-w-3xl space-y-6">
        <Button variant="ghost" className="px-0" onClick={() => session.setView('home')}>
          <ArrowLeftIcon /> Voltar
        </Button>
        <h1 className="text-3xl font-semibold">Histórico</h1>
        <div className="rounded-3xl border border-line bg-panel p-6 space-y-4">
          <label className="flex items-start gap-3 text-sm">
            <input
              type="checkbox"
              className="mt-1"
              checked={optIn}
              onChange={(e) => void toggleOptIn(e.target.checked)}
            />
            <span>
              <strong className="text-zinc-100">Salvar histórico neste navegador</strong>
              <p className="mt-1 text-zinc-400">
                O histórico fica só neste navegador. Não sincroniza com a nuvem, some se você limpar
                os dados do site e não aparece em outro dispositivo. Sem este opt-in, o SimpleChat não
                grava mensagens nem chamadas.
              </p>
            </span>
          </label>
          <Button
            variant="secondary"
            onClick={async () => {
              await clearHistory()
              await refresh()
              setMessages([])
              setOpenId(null)
            }}
          >
            Apagar histórico local
          </Button>
        </div>

        <ul className="space-y-3">
          {calls.length === 0 && (
            <li className="text-sm text-zinc-500">Nenhuma chamada salva neste navegador.</li>
          )}
          {calls.map((call) => (
            <li key={call.id} className="rounded-2xl border border-line bg-panel p-4">
              <button className="w-full text-left cursor-pointer" onClick={() => void open(call.id)}>
                <div className="text-sm font-medium">
                  {call.mode === 'room' ? 'Sala' : '1:1'} ·{' '}
                  {new Date(call.startedAt).toLocaleString('pt-BR')}
                </div>
                <p className="mt-1 text-xs text-zinc-400">
                  {call.participants.map((p) => p.displayName).join(', ')}
                </p>
              </button>
              {openId === call.id && (
                <div className="mt-3 space-y-2 border-t border-line pt-3 text-sm">
                  {messages.length === 0 && <p className="text-zinc-500">Sem mensagens.</p>}
                  {messages.map((msg) => (
                    <p key={msg.id}>
                      <span className="text-zinc-500">{msg.fromName}: </span>
                      {msg.text}
                    </p>
                  ))}
                </div>
              )}
            </li>
          ))}
        </ul>
      </div>
    </main>
  )
}
