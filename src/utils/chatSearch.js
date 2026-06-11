function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function findWordMatchesInText(text, query) {
  const term = query.trim()
  if (!term || !text) return []

  const regex = new RegExp(`(?<!\\w)${escapeRegex(term)}(?!\\w)`, 'gi')
  const matches = []
  let match

  while ((match = regex.exec(text)) !== null) {
    matches.push({ start: match.index, length: match[0].length })
  }

  return matches
}

export function findChatSearchMatches(messages, query) {
  const term = query.trim()
  if (!term) return []

  const matches = []

  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const message = messages[i]
    const text = message.text
    if (!text) continue

    const textMatches = findWordMatchesInText(text, term)
    for (let j = textMatches.length - 1; j >= 0; j -= 1) {
      const { start, length } = textMatches[j]
      matches.push({ messageId: message.id, start, length })
    }
  }

  return matches
}

export function groupChatSearchMatches(matches, messages) {
  if (!matches.length) return []

  const messageById = new Map(messages.map((message) => [message.id, message]))
  const groups = []
  const groupByMessageId = new Map()

  for (let index = 0; index < matches.length; index += 1) {
    const match = matches[index]
    let group = groupByMessageId.get(match.messageId)

    if (!group) {
      group = {
        messageId: match.messageId,
        message: messageById.get(match.messageId) ?? null,
        firstMatchIndex: index,
        matchCount: 0,
      }
      groupByMessageId.set(match.messageId, group)
      groups.push(group)
    }

    group.matchCount += 1
  }

  return groups.filter((group) => group.message)
}

export function getSearchMessageResultIndex(groups, activeMatch) {
  if (!activeMatch || !groups.length) return 0
  const index = groups.findIndex((group) => group.messageId === activeMatch.messageId)
  return index >= 0 ? index : 0
}

export function formatSearchMatchLabel(messageIndex, messageCount) {
  if (messageCount === 0) return '0 messages'
  return `${messageIndex + 1} of ${messageCount} messages`
}

export function getSearchResultPreview(text, query, radius = 42) {
  const term = query.trim()
  if (!text) return ''
  if (!term) return text.length > radius * 2 ? `${text.slice(0, radius * 2)}…` : text

  const regex = new RegExp(`(?<!\\w)${escapeRegex(term)}(?!\\w)`, 'i')
  const match = text.match(regex)
  if (!match || match.index == null) {
    return text.length > radius * 2 ? `${text.slice(0, radius * 2)}…` : text
  }

  const start = Math.max(0, match.index - radius)
  const end = Math.min(text.length, match.index + match[0].length + radius)
  const prefix = start > 0 ? '…' : ''
  const suffix = end < text.length ? '…' : ''
  return `${prefix}${text.slice(start, end)}${suffix}`
}
