import { useSyncExternalStore } from 'react'
import { getChatBackground, resolveChatBackgroundId } from '../../utils/chatBackgrounds'
import { resolveAppearance, getStoredAppearance } from '../../utils/appearance'

function subscribeAppearance(onStoreChange) {
  const mq = window.matchMedia('(prefers-color-scheme: dark)')
  mq.addEventListener('change', onStoreChange)
  window.addEventListener('storage', onStoreChange)
  const observer = new MutationObserver(onStoreChange)
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
  return () => {
    mq.removeEventListener('change', onStoreChange)
    window.removeEventListener('storage', onStoreChange)
    observer.disconnect()
  }
}

function getResolvedAppearanceSnapshot() {
  const root = document.documentElement
  if (root.classList.contains('theme-light')) return 'light'
  if (root.classList.contains('theme-dark')) return 'dark'
  return resolveAppearance(getStoredAppearance())
}

function useResolvedAppearance() {
  return useSyncExternalStore(
    subscribeAppearance,
    getResolvedAppearanceSnapshot,
    () => 'dark'
  )
}

export default function ChatBackground({ profile, className = '' }) {
  const appearance = useResolvedAppearance()
  const background = getChatBackground(resolveChatBackgroundId(profile), appearance)

  return (
    <div
      aria-hidden
      className={`pointer-events-none ${className}`}
      style={background.style}
    />
  )
}

export function ChatBackgroundPreview({ backgroundId, selected = false, onClick, className = '' }) {
  const appearance = useResolvedAppearance()
  const background = getChatBackground(backgroundId, appearance)

  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative aspect-[3/4] w-full rounded-2xl overflow-hidden border-2 transition-colors ${
        selected
          ? 'border-[var(--ios-blue)]'
          : 'border-[var(--ios-hairline)] hover:border-[var(--ios-separator)]'
      } ${className}`}
      aria-pressed={selected}
      aria-label={background.label}
    >
      <div className="absolute inset-0" style={background.style} />
      <div className="absolute inset-x-0 bottom-0 px-2 py-2 bg-gradient-to-t from-[color-mix(in_srgb,var(--ios-bg)_88%,transparent)] to-transparent">
        <span className="text-[13px] text-[var(--ios-label)]">{background.label}</span>
      </div>
      {selected ? (
        <span className="absolute top-2 right-2 w-5 h-5 rounded-full bg-[var(--ios-blue)] flex items-center justify-center text-[11px] text-white font-semibold">
          ✓
        </span>
      ) : null}
    </button>
  )
}
