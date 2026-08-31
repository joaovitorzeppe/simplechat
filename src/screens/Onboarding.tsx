import { useState, type FormEvent } from 'react'
import { Button } from '../components/Button'
import { saveIdentity } from '../lib/identity'

type Props = {
  onDone: (name: string) => void
}

export function Onboarding({ onDone }: Props) {
  const [name, setName] = useState('')

  function submit(event: FormEvent) {
    event.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return
    saveIdentity(trimmed)
    onDone(trimmed)
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
          Geramos uma chave única neste navegador. Sem conta, sem servidor nosso.
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
        <Button type="submit" className="mt-6 w-full" disabled={!name.trim()}>
          Entrar
        </Button>
      </form>
    </main>
  )
}
