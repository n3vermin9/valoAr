import { useEffect, useRef } from 'react'
import { IconSearch } from '@tabler/icons-react'
import { glassInputBarClass } from '../../utils/designSystem'

export default function ChatSearchBar({
  inline = false,
  active = true,
  query,
  onQueryChange,
  onPrev,
  onNext,
  onClose,
}) {
  const inputRef = useRef(null)

  useEffect(() => {
    if (!active) return
    const timer = setTimeout(() => inputRef.current?.focus(), inline ? 120 : 0)
    return () => clearTimeout(timer)
  }, [inline, active])

  const field = (
    <>
      <IconSearch size={18} className="text-white/50 shrink-0" />
      <input
        ref={inputRef}
        type="search"
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            if (e.shiftKey) onNext()
            else onPrev()
          }
          if (e.key === 'Escape') onClose()
        }}
        placeholder="Search words in chat"
        className="flex-1 min-w-0 bg-transparent text-sm text-white placeholder:text-white/40 outline-none"
        aria-label="Search messages"
      />
    </>
  )

  if (inline) {
    return <div className="flex items-center gap-2 min-w-0 w-full">{field}</div>
  }

  return (
    <div className="px-3 py-2 border-b border-[var(--ios-separator)] bg-[var(--ios-glass-bg)] backdrop-blur-xl">
      <div className={`${glassInputBarClass} flex items-center gap-2 rounded-2xl px-3 py-2`}>{field}</div>
    </div>
  )
}
