import { normalizeUsername } from './helpers'

export const CHAT_MUTE_OFF = 'off'
export const CHAT_MUTE_ALL = 'all'
export const CHAT_MUTE_MENTIONS_REPLIES = 'mentions_replies'

export function getChatMuteMode(chat, userId) {
  if (!chat || !userId) return CHAT_MUTE_OFF
  const mode = chat.muteSettings?.[userId]
  if (mode === CHAT_MUTE_ALL || mode === CHAT_MUTE_MENTIONS_REPLIES) return mode
  if (chat.mutedBy?.includes(userId)) return CHAT_MUTE_ALL
  return CHAT_MUTE_OFF
}

export function isChatMuteActive(chat, userId) {
  return getChatMuteMode(chat, userId) !== CHAT_MUTE_OFF
}

export function isChatFullyMuted(chat, userId) {
  return getChatMuteMode(chat, userId) === CHAT_MUTE_ALL
}

export function shouldSuppressChatNotification(chat, userId, message, username) {
  const mode = getChatMuteMode(chat, userId)
  if (mode === CHAT_MUTE_OFF) return false
  if (mode === CHAT_MUTE_ALL) return true

  if (message?.replyTo?.senderId === userId) return false

  const normalized = normalizeUsername(username || '')
  if (normalized && message?.text) {
    const mentionPattern = new RegExp(`@${normalized}(?![a-z0-9])`, 'i')
    if (mentionPattern.test(message.text)) return false
  }

  return true
}

export function getMuteModeLabel(mode) {
  if (mode === CHAT_MUTE_ALL) return 'Muted'
  if (mode === CHAT_MUTE_MENTIONS_REPLIES) return 'Muted except mentions'
  return 'Notifications on'
}
