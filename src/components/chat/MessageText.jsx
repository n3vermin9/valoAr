import { useMemo } from 'react'

const MENTION_REGEX = /@([a-z0-9]{4,20})/gi

export function splitMessageMentions(text = '') {
  if (!text) return [{ type: 'text', value: '' }]

  const parts = []
  let lastIndex = 0
  let match

  MENTION_REGEX.lastIndex = 0
  while ((match = MENTION_REGEX.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: 'text', value: text.slice(lastIndex, match.index) })
    }
    parts.push({ type: 'mention', value: match[1].toLowerCase() })
    lastIndex = match.index + match[0].length
  }

  if (lastIndex < text.length) {
    parts.push({ type: 'text', value: text.slice(lastIndex) })
  }

  return parts.length > 0 ? parts : [{ type: 'text', value: text }]
}

export default function MessageText({ text, isOwn = false, onMentionClick, className = '' }) {
  const parts = useMemo(() => splitMessageMentions(text), [text])

  return (
    <p className={className} data-allow-copy>
      {parts.map((part, index) =>
        part.type === 'mention' ? (
          <button
            key={`mention-${index}-${part.value}`}
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onMentionClick?.(part.value)
            }}
            onDoubleClick={(e) => e.stopPropagation()}
            className={`no-tap-scale font-semibold underline underline-offset-2 decoration-white/40 hover:decoration-white/70 ${
              isOwn ? 'text-white hover:text-white/90' : 'text-blue-300 hover:text-blue-200'
            }`}
          >
            @{part.value}
          </button>
        ) : (
          <span key={`text-${index}`}>{part.value}</span>
        )
      )}
    </p>
  )
}
