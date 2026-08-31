import { useState, type FormEvent } from 'react'
import { Button } from '../components/Button'
import { setHistoryOptIn } from '../lib/db'
import { clearIdentity, createIdentity, persistIdentity } from '../lib/identity'
import type { Identity } from '../lib/types'
import { cn } from '../lib/cn'

type Props = {
  onDone: (identity: Identity) => void
}

export function Onboarding({ onDone }: Props) {
  const [name, setName] = useState('')
  const [remember, setRemember] = useState(false)
  const [saveHistory, setSaveHistory] = useState(false)

  function submit(event: FormEvent) {
    event.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return
    const identity = createIdentity(trimmed)
    if (remember) persistIdentity(identity)
    else clearIdentity()
    setHistoryOptIn(remember && saveHistory)
    onDone(identity)
  }

  return (
    <main className="min-h-dvh grid place-items-center px-4">
      <form
        onSubmit={submit}
        className="w-full max-w-md rounded-3xl border border-line bg-panel p-8"
      >
        <p className="text-xs uppercase tracking-[0.25em] text-accent">SimpleChat</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">Como você quer aparecer?</h1>
        <p className="mt-2 text-sm text-zinc-400">
          Sem conta e sem servidor nosso. Se você não pedir para lembrar, geramos uma chave nova a
          cada visita.
        </p>
        <label className="mt-8 block text-sm text-zinc-400">
          Nome
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-2 w-full rounded-xl border border-line bg-zinc-900 px-4 py-3 text-base text-zinc-100 outline-none focus:border-accent"
            placeholder="ex.: Ana"
          />
        </label>

        <div className="mt-6 space-y-4">
          <label className="flex items-start gap-3 text-sm cursor-pointer">
            <input
              type="checkbox"
              className="mt-1 size-4 accent-accent"
              checked={remember}
              onChange={(e) => {
                const next = e.target.checked
                setRemember(next)
                if (!next) setSaveHistory(false)
              }}
            />
            <span>
              <strong className="text-zinc-100">Lembrar quem eu sou</strong>
              <p className="mt-1 text-zinc-400">
                Guardamos seu nome e a chave neste navegador para a próxima visita. Sem isso, uma
                nova chave é gerada ao entrar.
              </p>
            </span>
          </label>

          <label
            className={cn(
              'flex items-start gap-3 text-sm',
              remember ? 'cursor-pointer' : 'cursor-not-allowed',
            )}
          >
            <input
              type="checkbox"
              className="mt-1 size-4 accent-accent disabled:opacity-40"
              checked={saveHistory}
              disabled={!remember}
              onChange={(e) => setSaveHistory(e.target.checked)}
            />
            <span className={remember ? '' : 'opacity-50'}>
              <strong className="text-zinc-100">Salvar histórico neste navegador</strong>
              <p className="mt-1 text-zinc-400">
                O histórico fica só aqui, não sincroniza e some se limpar os dados do site. Só pode
                ser ligado se você lembrar quem é, porque ele fica atrelado a esta identidade.
              </p>
            </span>
          </label>
        </div>

        <Button type="submit" className="mt-6 w-full" disabled={!name.trim()}>
          Entrar
        </Button>
      </form>
    </main>
  )
}
