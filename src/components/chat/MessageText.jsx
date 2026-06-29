import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { findWordMatchesInText } from '../../utils/chatSearch'
import { parseInAppRoute } from '../../utils/inAppNavigation'

const MENTION_REGEX = /@([a-z0-9]{4,20})/gi
const URL_REGEX =
  /((?:https?:\/\/|www\.)[^\s<]+[^\s.,;:!?)\]'"]|\/(?:profile|join|chats|groups)(?:\/[^\s<]*)?)/gi

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

function splitTextLinks(text = '') {
  if (!text) return []

  const parts = []
  let lastIndex = 0
  let match

  URL_REGEX.lastIndex = 0
  while ((match = URL_REGEX.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: 'text', value: text.slice(lastIndex, match.index) })
    }
    parts.push({ type: 'link', value: match[1] })
    lastIndex = match.index + match[0].length
  }

  if (lastIndex < text.length) {
    parts.push({ type: 'text', value: text.slice(lastIndex) })
  }

  return parts.length > 0 ? parts : [{ type: 'text', value: text }]
}

function normalizeLinkHref(url) {
  if (url.startsWith('/')) return url
  return url.startsWith('www.') ? `https://${url}` : url
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

function renderTextWithLinks(segment, searchQuery, activeSearchMatch, segmentStartOffset, isOwn, navigate) {
  const linkParts = splitTextLinks(segment)
  if (linkParts.length === 1 && linkParts[0].type === 'text') {
    return renderSearchHighlights(segment, searchQuery, activeSearchMatch, segmentStartOffset)
  }

  let offset = segmentStartOffset
  return linkParts.map((part, index) => {
    if (part.type === 'link') {
      const href = normalizeLinkHref(part.value)
      const inAppRoute = parseInAppRoute(href)
      const node = (
        <a
          key={`link-${segmentStartOffset}-${index}`}
          href={href}
          target={inAppRoute ? undefined : '_blank'}
          rel={inAppRoute ? undefined : 'noopener noreferrer'}
          onClick={(e) => {
            e.stopPropagation()
            if (inAppRoute) {
              e.preventDefault()
              navigate(inAppRoute.to)
            }
          }}
          onDoubleClick={(e) => e.stopPropagation()}
          className={`underline underline-offset-2 break-all ${
            isOwn ? 'text-white/95 hover:text-white' : 'text-blue-300 hover:text-blue-200'
          }`}
        >
          {part.value}
        </a>
      )
      offset += part.value.length
      return node
    }

    const node = renderSearchHighlights(part.value, searchQuery, activeSearchMatch, offset)
    offset += part.value.length
    return <span key={`text-${segmentStartOffset}-${index}`}>{node}</span>
  })
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
  const navigate = useNavigate()
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
            {renderTextWithLinks(
              part.value,
              searchQuery,
              activeSearchMatch,
              part.startOffset,
              isOwn,
              navigate
            )}
          </span>
        )
      )}
    </p>
  )
}
