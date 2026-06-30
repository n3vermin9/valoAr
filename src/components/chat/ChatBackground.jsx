import { getChatBackground, resolveChatBackgroundId } from '../../utils/chatBackgrounds'

export default function ChatBackground({ profile, className = '' }) {
  const background = getChatBackground(resolveChatBackgroundId(profile))

  return (
    <div
      aria-hidden
      className={`pointer-events-none ${className}`}
      style={background.style}
    />
  )
}

export function ChatBackgroundPreview({ backgroundId, selected = false, onClick, className = '' }) {
  const background = getChatBackground(backgroundId)

  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative aspect-[3/4] w-full rounded-2xl overflow-hidden border-2 transition-colors ${
        selected ? 'border-[var(--ios-blue)]' : 'border-white/10 hover:border-white/25'
      } ${className}`}
      aria-pressed={selected}
      aria-label={background.label}
    >
      <div className="absolute inset-0" style={background.style} />
      <div className="absolute inset-x-0 bottom-0 px-2 py-2 bg-gradient-to-t from-black/80 to-transparent">
        <span className="text-[13px] text-white/90">{background.label}</span>
      </div>
      {selected ? (
        <span className="absolute top-2 right-2 w-5 h-5 rounded-full bg-[var(--ios-blue)] flex items-center justify-center text-[11px] text-white font-semibold">
          ✓
        </span>
      ) : null}
    </button>
  )
}
