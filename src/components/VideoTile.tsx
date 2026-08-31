import { useEffect, useRef } from 'react'
import { cn } from '../lib/cn'

type Props = {
  stream: MediaStream | null
  name: string
  local?: boolean
  mutedAudio?: boolean
  cameraOff?: boolean
  sharingScreen?: boolean
}

export function VideoTile({ stream, name, local, mutedAudio, cameraOff, sharingScreen }: Props) {
  const ref = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.srcObject = stream
  }, [stream])

  const blank = !stream || cameraOff

  return (
    <div className="relative overflow-hidden rounded-2xl bg-zinc-900 border border-line min-h-40">
      <video
        ref={ref}
        autoPlay
        playsInline
        muted={local || mutedAudio}
        className={cn('h-full w-full object-cover', blank && 'opacity-0')}
      />
      {blank && (
        <div className="absolute inset-0 grid place-items-center">
          <div className="size-16 rounded-full bg-zinc-800 grid place-items-center text-xl font-semibold text-zinc-300">
            {name.slice(0, 1).toUpperCase()}
          </div>
        </div>
      )}
      <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 bg-gradient-to-t from-black/70 to-transparent px-3 py-2 text-xs">
        <span className="font-medium truncate">
          {name}
          {local ? ' (você)' : ''}
        </span>
        {sharingScreen && <span className="text-accent">tela</span>}
      </div>
    </div>
  )
}
