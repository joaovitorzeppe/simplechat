import type { QualityTier } from './types'

const DEMO_KEY = 'simplechat.demoTier'

export type MediaKind = 'camera' | 'screen'

export type TierLimits = {
  width: number
  height: number
  frameRate: number
  maxBitrate: number
}

export const TIERS: Record<QualityTier, Record<MediaKind, TierLimits>> = {
  free: {
    camera: { width: 640, height: 480, frameRate: 15, maxBitrate: 400_000 },
    screen: { width: 1280, height: 720, frameRate: 15, maxBitrate: 800_000 },
  },
  pro: {
    camera: { width: 1280, height: 720, frameRate: 30, maxBitrate: 2_500_000 },
    screen: { width: 1920, height: 1080, frameRate: 30, maxBitrate: 4_000_000 },
  },
}

export function currentTier(): QualityTier {
  return localStorage.getItem(DEMO_KEY) === 'pro' ? 'pro' : 'free'
}

export function setDemoTier(tier: QualityTier) {
  localStorage.setItem(DEMO_KEY, tier)
}

export function getCameraConstraints(tier: QualityTier): MediaStreamConstraints {
  const t = TIERS[tier].camera
  return {
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
    },
    video: {
      width: { ideal: t.width },
      height: { ideal: t.height },
      frameRate: { ideal: t.frameRate, max: t.frameRate },
    },
  }
}

export function getDisplayConstraints(tier: QualityTier): DisplayMediaStreamOptions {
  const t = TIERS[tier].screen
  return {
    audio: false,
    video: {
      width: { ideal: t.width },
      height: { ideal: t.height },
      frameRate: { ideal: t.frameRate, max: t.frameRate },
    },
  }
}

export async function applyTrackConstraints(stream: MediaStream, kind: MediaKind, tier: QualityTier) {
  const t = TIERS[tier][kind]
  const video = stream.getVideoTracks()[0]
  if (!video) return
  try {
    await video.applyConstraints({
      width: { ideal: t.width },
      height: { ideal: t.height },
      frameRate: { ideal: t.frameRate, max: t.frameRate },
    })
  } catch {
    // o dispositivo pode ignorar o teto; o bitrate ainda limita o envio
  }
}

export async function applySenderLimits(sender: RTCRtpSender, kind: MediaKind, tier: QualityTier) {
  if (sender.track?.kind !== 'video') return
  const bitrate = TIERS[tier][kind].maxBitrate
  try {
    const params = sender.getParameters()
    if (!params.encodings || params.encodings.length === 0) {
      params.encodings = [{}]
    }
    params.encodings[0].maxBitrate = bitrate
    await sender.setParameters(params)
  } catch {
    // alguns browsers só aceitam setParameters depois da negociação
  }
}
