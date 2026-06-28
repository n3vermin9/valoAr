export function getMessageClusterMeta(messages, index, currentUserId, isGroup) {
  if (!isGroup) {
    return {
      showAvatar: false,
      showSenderNameInBubble: false,
      tightBottom: false,
    }
  }

  const msg = messages[index]
  if (msg.senderId === currentUserId) {
    return {
      showAvatar: false,
      showSenderNameInBubble: false,
      tightBottom: false,
    }
  }

  const prev = messages[index - 1]
  const next = messages[index + 1]
  const sameAsPrev = prev?.senderId === msg.senderId
  const sameAsNext = next?.senderId === msg.senderId

  return {
    showAvatar: !sameAsNext,
    showSenderNameInBubble: !sameAsPrev,
    tightBottom: sameAsNext,
  }
}
