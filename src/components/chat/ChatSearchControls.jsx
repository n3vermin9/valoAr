import { IconChevronUp, IconChevronDown } from '@tabler/icons-react'
import { formatSearchMatchLabel } from '../../utils/chatSearch'
import { storyGlassBlur } from '../../utils/designSystem'

const controlSurfaceClass = `${storyGlassBlur} liquid-glass-pill inline-flex items-center justify-center h-11 min-h-11 text-white transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-60`

export default function ChatSearchControls({
  matchIndex,
  matchCount,
  onPrev,
  onNext,
  onOpenResults,
}) {
  const label = formatSearchMatchLabel(matchIndex, matchCount)
  const disabled = matchCount === 0

  return (
    <div className="flex items-center justify-between w-full h-11 gap-2">
      <button
        type="button"
        onClick={onOpenResults}
        disabled={disabled}
        className={`${controlSurfaceClass} max-w-[min(72vw,240px)] px-4 text-sm font-medium tabular-nums truncate`}
        aria-live="polite"
        aria-atomic="true"
        aria-label="Show matching messages"
      >
        {label}
      </button>
      <div className="flex items-center gap-2 shrink-0">
        <button
          type="button"
          onClick={onPrev}
          disabled={disabled}
          className={`${controlSurfaceClass} w-11 shrink-0`}
          aria-label="Older match"
        >
          <IconChevronUp size={20} stroke={2} />
        </button>
        <button
          type="button"
          onClick={onNext}
          disabled={disabled}
          className={`${controlSurfaceClass} w-11 shrink-0`}
          aria-label="Newer match"
        >
          <IconChevronDown size={20} stroke={2} />
        </button>
      </div>
    </div>
  )
}
