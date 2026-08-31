import { localeTags, type Locale } from '../i18n/i18n'
import type { ChatMessage } from './types'

export const CHAT_GROUP_MS = 60_000

export type ChatGroup = {
  fromPeerId: string
  fromName: string
  at: number
  messages: ChatMessage[]
}

export const groupChatMessages = (
  messages: ChatMessage[],
  windowMs = CHAT_GROUP_MS,
): ChatGroup[] => {
  const groups: ChatGroup[] = []
  for (const msg of messages) {
    const last = groups[groups.length - 1]
    const lastAt = last?.messages[last.messages.length - 1]?.at
    if (last && last.fromPeerId === msg.fromPeerId && lastAt !== undefined && msg.at - lastAt <= windowMs) {
      last.messages.push(msg)
    } else {
      groups.push({
        fromPeerId: msg.fromPeerId,
        fromName: msg.fromName,
        at: msg.at,
        messages: [msg],
      })
    }
  }
  return groups
}

const sameCalendarDay = (a: Date, b: Date) => {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

export const formatMessageTime = (at: number, locale: Locale, now = Date.now()) => {
  const date = new Date(at)
  const today = new Date(now)
  const tag = localeTags[locale]
  const time = new Intl.DateTimeFormat(tag, { hour: '2-digit', minute: '2-digit' }).format(date)

  if (sameCalendarDay(date, today)) return time

  if (date.getFullYear() === today.getFullYear()) {
    const dayMonth = new Intl.DateTimeFormat(tag, { day: 'numeric', month: 'short' }).format(date)
    return `${time}, ${dayMonth}`
  }

  const full = new Intl.DateTimeFormat(tag, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date)
  return `${time}, ${full}`
}
