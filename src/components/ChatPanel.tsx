import { useState, type FormEvent } from 'react'
import type { ChatMessage } from '../lib/types'
import { Button } from './Button'

type Props = {
  messages: ChatMessage[]
  selfId: string
  onSend: (text: string) => void
}

export function ChatPanel({ messages, selfId, onSend }: Props) {
  const [text, setText] = useState('')

  function submit(event: FormEvent) {
    event.preventDefault()
    onSend(text)
    setText('')
  }

  return (
    <aside className="flex h-full w-full max-w-sm flex-col border-l border-line bg-panel">
      <div className="border-b border-line px-4 py-3 text-sm font-medium">Chat</div>
      <div className="flex-1 space-y-3 overflow-y-auto p-4 text-sm">
        {messages.length === 0 && (
          <p className="text-zinc-500">Mensagens desta chamada. Sem opt-in, nada é gravado.</p>
        )}
        {messages.map((msg) => (
          <div key={msg.id} className={msg.fromPeerId === selfId ? 'text-right' : ''}>
            <div className="text-[11px] text-zinc-500 mb-0.5">{msg.fromName}</div>
            <div
              className={
                msg.fromPeerId === selfId
                  ? 'inline-block rounded-2xl rounded-tr-sm bg-accent/15 px-3 py-2'
                  : 'inline-block rounded-2xl rounded-tl-sm bg-zinc-800 px-3 py-2'
              }
            >
              {msg.text}
            </div>
          </div>
        ))}
      </div>
      <form onSubmit={submit} className="flex gap-2 border-t border-line p-3">
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Escreva uma mensagem"
          className="flex-1 rounded-xl bg-zinc-900 border border-line px-3 py-2 text-sm outline-none focus:border-accent"
        />
        <Button type="submit" disabled={!text.trim()}>
          Enviar
        </Button>
      </form>
    </aside>
  )
}
