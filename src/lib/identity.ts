import type { Identity } from './types'

const KEY = 'simplechat.identity'

export function loadIdentity(): Identity | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<Identity>
    if (!parsed.displayName || !parsed.peerId) return null
    return { displayName: parsed.displayName, peerId: parsed.peerId }
  } catch {
    return null
  }
}

export function saveIdentity(displayName: string, peerId = crypto.randomUUID()): Identity {
  const identity: Identity = { displayName: displayName.trim(), peerId }
  localStorage.setItem(KEY, JSON.stringify(identity))
  return identity
}

export function clearIdentity() {
  localStorage.removeItem(KEY)
}
