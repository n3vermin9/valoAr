import { isSystemMessage } from '../services/systemChatMessage'

export function getMessageClusterMeta(messages, index, currentUserId, isGroup) {
  if (!isGroup) {
    return {
      showAvatar: false,
      showSenderNameInBubble: false,
      tightBottom: false,
    }
  }

  const msg = messages[index]
  if (isSystemMessage(msg) || msg.senderId === currentUserId) {
    return {
      showAvatar: false,
      showSenderNameInBubble: false,
      tightBottom: false,
    }
  }

  const prev = messages[index - 1]
  const next = messages[index + 1]
  const sameAsPrev = prev && !isSystemMessage(prev) && prev.senderId === msg.senderId
  const sameAsNext = next && !isSystemMessage(next) && next.senderId === msg.senderId

  return {
    showAvatar: !sameAsNext,
    showSenderNameInBubble: !sameAsPrev,
    tightBottom: sameAsNext,
  }
}
