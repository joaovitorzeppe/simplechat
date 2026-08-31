import { currentTier } from '../lib/quality'
import { cn } from '../lib/cn'

export function QualityBadge({ compact }: { compact?: boolean }) {
  const pro = currentTier() === 'pro'
  return (
    <div className={cn('flex items-center gap-2 text-xs', compact && 'flex-col items-start gap-1')}>
      <span
        className={cn(
          'rounded-full px-2.5 py-1 border',
          pro ? 'border-accent/40 text-accent bg-accent/10' : 'border-line text-zinc-400 bg-zinc-900',
        )}
      >
        {pro ? 'Qualidade Pro (demo)' : 'Qualidade gratuita'}
      </span>
      {!pro && (
        <span className="text-zinc-500">
          Pro em breve — 720p e mais bitrate
        </span>
      )}
    </div>
  )
}
