let ctx: AudioContext | null = null

const audio = (): AudioContext | null => {
  try {
    ctx ??= new AudioContext()
    if (ctx.state === 'suspended') void ctx.resume()
    return ctx
  } catch {
    return null
  }
}

export const unlockAudio = () => {
  const c = audio()
  if (c?.state === 'suspended') void c.resume()
}

const tone = (
  context: AudioContext,
  freq: number,
  when: number,
  duration: number,
  gain = 0.08,
) => {
  const osc = context.createOscillator()
  const amp = context.createGain()
  osc.type = 'sine'
  osc.frequency.value = freq
  const start = context.currentTime + when
  amp.gain.setValueAtTime(0.0001, start)
  amp.gain.exponentialRampToValueAtTime(gain, start + 0.02)
  amp.gain.exponentialRampToValueAtTime(0.0001, start + duration)
  osc.connect(amp)
  amp.connect(context.destination)
  osc.start(start)
  osc.stop(start + duration + 0.03)
}

export const playRingtone = () => {
  const context = audio()
  if (!context) return () => {}
  let timer = 0
  let stopped = false

  const ring = () => {
    if (stopped) return
    tone(context, 440, 0, 0.32, 0.07)
    tone(context, 480, 0, 0.32, 0.05)
    tone(context, 440, 0.4, 0.32, 0.07)
    tone(context, 480, 0.4, 0.32, 0.05)
    timer = window.setTimeout(ring, 1500)
  }
  ring()

  return () => {
    stopped = true
    window.clearTimeout(timer)
  }
}

export const playCallEnded = () => {
  const context = audio()
  if (!context) return
  tone(context, 620, 0, 0.14, 0.09)
  tone(context, 392, 0.16, 0.28, 0.08)
}
