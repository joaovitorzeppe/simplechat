import { useI18n } from '../i18n/use-i18n'
import { formatMessageTime, groupChatMessages } from '../lib/chat'
import type { ChatMessage } from '../lib/types'
import { cn } from '../lib/cn'

type Props = {
  messages: ChatMessage[]
  selfId: string
}

export function ChatMessages({ messages, selfId }: Props) {
  const { locale } = useI18n()
  const groups = groupChatMessages(messages)

  return (
    <>
      {groups.map((group) => {
        const mine = group.fromPeerId === selfId
        return (
          <div key={group.messages[0].id} className="space-y-1">
            <div className={cn('text-[11px] text-zinc-500', mine && 'text-right')}>
              {group.fromName}
              <span className="text-zinc-600"> · {formatMessageTime(group.at, locale)}</span>
            </div>
            {group.messages.map((msg) => (
              <div key={msg.id} className={cn(mine && 'flex justify-end')}>
                <div
                  className={cn(
                    'inline-block max-w-[90%] rounded-2xl px-3 py-2',
                    mine ? 'bg-accent/15' : 'bg-zinc-800',
                  )}
                >
                  {msg.text}
                </div>
              </div>
            ))}
          </div>
        )
      })}
    </>
  )
}
