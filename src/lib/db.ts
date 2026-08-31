import Dexie, { type Table } from 'dexie'
import type { HistoryCall, HistoryMessage, PeerInfo } from './types'

const OPT_IN_KEY = 'simplechat.historyOptIn'

class SimpleChatDB extends Dexie {
  calls!: Table<HistoryCall, string>
  messages!: Table<HistoryMessage, string>

  constructor() {
    super('simplechat')
    this.version(1).stores({
      calls: 'id, startedAt',
      messages: 'id, callId, at',
    })
  }
}

export const db = new SimpleChatDB()

export function isHistoryOptIn() {
  return localStorage.getItem(OPT_IN_KEY) === '1'
}

export function setHistoryOptIn(enabled: boolean) {
  localStorage.setItem(OPT_IN_KEY, enabled ? '1' : '0')
}

export async function startHistoryCall(call: HistoryCall) {
  if (!isHistoryOptIn()) return
  await db.calls.put(call)
}

export async function touchHistoryParticipants(callId: string, participants: PeerInfo[]) {
  if (!isHistoryOptIn()) return
  const existing = await db.calls.get(callId)
  if (!existing) return
  await db.calls.update(callId, { participants })
}

export async function appendHistoryMessage(message: HistoryMessage) {
  if (!isHistoryOptIn()) return
  await db.messages.put(message)
}

export async function endHistoryCall(callId: string) {
  if (!isHistoryOptIn()) return
  await db.calls.update(callId, { endedAt: Date.now() })
}

export async function listHistoryCalls() {
  return db.calls.orderBy('startedAt').reverse().toArray()
}

export async function listHistoryMessages(callId: string) {
  return db.messages.where('callId').equals(callId).sortBy('at')
}

export async function clearHistory() {
  await db.transaction('rw', db.calls, db.messages, async () => {
    await db.messages.clear()
    await db.calls.clear()
  })
}
