const STORAGE_KEY = 'arvoli-chat-room-v1'
const TTL_MS = 7 * 24 * 60 * 60 * 1000
/** Roughly a couple of screens of messages — enough for reopen without caching full history. */
export const VISIBLE_CHAT_MESSAGE_LIMIT = 48
const memory = new Map()

function cacheKey(userId, matchId) {
  return `${userId}:${matchId}`
}

function readStore() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}')
  } catch {
    return {}
  }
}

function writeStore(store) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store))
  } catch {
    // ignore quota / private mode
  }
}

function toMs(value) {
  if (value == null) return null
  if (typeof value === 'number') return value
  if (typeof value.toMillis === 'function') return value.toMillis()
  if (typeof value.seconds === 'number') {
    return value.seconds * 1000 + (value.nanoseconds ?? 0) / 1e6
  }
  return value
}

function slimReplyTo(replyTo) {
  if (!replyTo || typeof replyTo !== 'object') return null
  return {
    id: replyTo.id || null,
    text: replyTo.text || '',
    senderId: replyTo.senderId || null,
    imageUrl: replyTo.imageUrl || null,
    audioUrl: replyTo.audioUrl || null,
  }
}

function slimStoryReply(storyReply) {
  if (!storyReply || typeof storyReply !== 'object') return null
  return {
    storyId: storyReply.storyId || null,
    ownerId: storyReply.ownerId || null,
    text: storyReply.text || '',
    emoji: storyReply.emoji || null,
    color: storyReply.color || null,
  }
}

function slimMessage(message) {
  if (!message?.id) return null
  return {
    id: message.id,
    text: message.text || '',
    senderId: message.senderId || null,
    createdAt: toMs(message.createdAt),
    read: Boolean(message.read),
    imageUrl: message.imageUrl || null,
    audioUrl: message.audioUrl || null,
    type: message.type || null,
    systemEvent: message.systemEvent || null,
    replyTo: slimReplyTo(message.replyTo),
    storyReply: slimStoryReply(message.storyReply),
    meetupId: message.meetupId || null,
    deletedForEveryone: Boolean(message.deletedForEveryone),
    deletedFor: Array.isArray(message.deletedFor) ? message.deletedFor : [],
  }
}

function slimChatMeta(chat) {
  if (!chat) return null
  return {
    id: chat.id,
    participants: Array.isArray(chat.participants) ? chat.participants : [],
    type: chat.type || null,
    isGroup: Boolean(chat.isGroup),
    isSavedMessages: Boolean(chat.isSavedMessages),
    isMeetup: Boolean(chat.isMeetup),
    meetupId: chat.meetupId || null,
    createdBy: chat.createdBy || null,
    name: chat.name || '',
    username: chat.username || '',
    photoUrl: chat.photoUrl || '',
    description: chat.description || '',
    memberLimit: chat.memberLimit || null,
    expiresAt: toMs(chat.expiresAt),
    settings: chat.settings || null,
    admins: chat.admins || null,
    mutedMembers: chat.mutedMembers || null,
    mutedUntil: chat.mutedUntil || {},
    pinnedMessage: chat.pinnedMessage || null,
    pinnedBy: Array.isArray(chat.pinnedBy) ? chat.pinnedBy : [],
    blockedBy: Array.isArray(chat.blockedBy) ? chat.blockedBy : [],
    deletedParticipantUsernames: chat.deletedParticipantUsernames || {},
    unreadCount: chat.unreadCount || {},
  }
}

function slimUser(user) {
  if (!user) return null
  return {
    id: user.id,
    username: user.username || 'User',
    photos: user.photos?.[0] ? [user.photos[0]] : [],
    deleted: Boolean(user.deleted),
  }
}

function slimUsers(users = {}) {
  const next = {}
  for (const [id, user] of Object.entries(users)) {
    const slim = slimUser({ ...user, id: user.id || id })
    if (slim) next[id] = slim
  }
  return next
}

function takeVisibleMessages(messages = []) {
  const slim = messages.map(slimMessage).filter(Boolean)
  if (slim.length <= VISIBLE_CHAT_MESSAGE_LIMIT) return slim
  return slim.slice(-VISIBLE_CHAT_MESSAGE_LIMIT)
}

function normalizeSnapshot(raw) {
  if (!raw || typeof raw !== 'object') return null
  return {
    messages: takeVisibleMessages(raw.messages || []),
    chatMeta: slimChatMeta(raw.chatMeta),
    otherUser: slimUser(raw.otherUser),
    memberProfiles: slimUsers(raw.memberProfiles || {}),
    updatedAt: raw.updatedAt || 0,
  }
}

export function getChatRoomSnapshot(userId, matchId) {
  if (!userId || !matchId) return null
  const key = cacheKey(userId, matchId)

  const cached = memory.get(key)
  if (cached) {
    const fresh = normalizeSnapshot(cached)
    if (fresh) {
      memory.set(key, fresh)
      return fresh
    }
  }

  const store = readStore()
  const entry = store[key]
  if (!entry) return null
  if (Date.now() - (entry.updatedAt || 0) > TTL_MS) {
    delete store[key]
    writeStore(store)
    return null
  }

  const fresh = normalizeSnapshot(entry)
  if (!fresh) return null
  memory.set(key, fresh)
  return fresh
}

export function setChatRoomSnapshot(
  userId,
  matchId,
  { messages, chatMeta, otherUser, memberProfiles } = {}
) {
  if (!userId || !matchId) return

  const next = {
    messages: takeVisibleMessages(messages || []),
    chatMeta: slimChatMeta(chatMeta),
    otherUser: slimUser(otherUser),
    memberProfiles: slimUsers(memberProfiles || {}),
    updatedAt: Date.now(),
  }

  const key = cacheKey(userId, matchId)
  memory.set(key, next)

  const store = readStore()
  store[key] = next

  // Cap how many rooms we keep in localStorage (LRU by updatedAt).
  const keys = Object.keys(store)
  if (keys.length > 24) {
    keys
      .sort((a, b) => (store[a].updatedAt || 0) - (store[b].updatedAt || 0))
      .slice(0, keys.length - 24)
      .forEach((oldKey) => {
        delete store[oldKey]
        memory.delete(oldKey)
      })
  }

  writeStore(store)
}
