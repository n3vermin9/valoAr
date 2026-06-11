import { useMemo } from 'react'
import { findWordMatchesInText } from '../../utils/chatSearch'

const MENTION_REGEX = /@([a-z0-9]{4,20})/gi

function splitMessageMentions(text = '') {
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

function renderSearchHighlights(segment, searchQuery, activeSearchMatch, segmentStartOffset) {
  const term = searchQuery?.trim()
  if (!term) return segment

  const wordMatches = findWordMatchesInText(segment, term)
  if (!wordMatches.length) return segment

  const nodes = []
  let lastIndex = 0

  for (const { start, length } of wordMatches) {
    if (start > lastIndex) {
      nodes.push(
        <span key={`t-${segmentStartOffset}-${lastIndex}`}>{segment.slice(lastIndex, start)}</span>
      )
    }

    const absStart = segmentStartOffset + start
    const isActive = activeSearchMatch?.start === absStart
    nodes.push(
      <mark
        key={`m-${absStart}`}
        className={isActive ? 'chat-search-mark-active' : 'chat-search-mark'}
      >
        {segment.slice(start, start + length)}
      </mark>
    )
    lastIndex = start + length
  }

  if (lastIndex < segment.length) {
    nodes.push(
      <span key={`t-${segmentStartOffset}-${lastIndex}`}>{segment.slice(lastIndex)}</span>
    )
  }

  return nodes
}

function withMentionOffsets(parts) {
  let offset = 0
  return parts.map((part) => {
    if (part.type === 'mention') {
      const entry = { ...part, startOffset: offset }
      offset += part.value.length + 1
      return entry
    }
    const entry = { ...part, startOffset: offset }
    offset += part.value.length
    return entry
  })
}

export default function MessageText({
  text,
  isOwn = false,
  onMentionClick,
  searchQuery = '',
  activeSearchMatch = null,
  className = '',
}) {
  const parts = useMemo(() => withMentionOffsets(splitMessageMentions(text)), [text])

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
          <span key={`text-${index}`}>
            {renderSearchHighlights(part.value, searchQuery, activeSearchMatch, part.startOffset)}
          </span>
        )
      )}
    </p>
  )
}
