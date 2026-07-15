const STORAGE_KEY = 'arvoli-chats-list-v1'
const TTL_MS = 7 * 24 * 60 * 60 * 1000
const memory = new Map()

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

function slimLastMessage(message) {
  if (!message || typeof message !== 'object') return message || null
  return {
    text: message.text || '',
    senderId: message.senderId || null,
    imageUrl: Boolean(message.imageUrl),
    audioUrl: Boolean(message.audioUrl),
    type: message.type || null,
    systemEvent: message.systemEvent || null,
    createdAt: toMs(message.createdAt),
  }
}

function slimChat(chat) {
  if (!chat?.id) return null
  return {
    id: chat.id,
    participants: Array.isArray(chat.participants) ? chat.participants : [],
    hiddenFor: Array.isArray(chat.hiddenFor) ? chat.hiddenFor : [],
    pinnedBy: Array.isArray(chat.pinnedBy) ? chat.pinnedBy : [],
    type: chat.type || null,
    isGroup: Boolean(chat.isGroup),
    isSavedMessages: Boolean(chat.isSavedMessages),
    isMeetup: Boolean(chat.isMeetup),
    name: chat.name || '',
    username: chat.username || '',
    photoUrl: chat.photoUrl || '',
    description: chat.description || '',
    memberLimit: chat.memberLimit || null,
    expiresAt: toMs(chat.expiresAt),
    lastMessage: slimLastMessage(chat.lastMessage),
    lastMessageAt: toMs(chat.lastMessageAt),
    unreadCount: chat.unreadCount || {},
    mutedUntil: chat.mutedUntil || {},
    typing: chat.typing || {},
    deletedParticipantUsernames: chat.deletedParticipantUsernames || {},
    settings: chat.settings || null,
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

function filterActiveChats(chats = [], userId) {
  const now = Date.now()
  return chats
    .map(slimChat)
    .filter(Boolean)
    .filter((chat) => !chat.hiddenFor?.includes(userId))
    .filter((chat) => !chat.expiresAt || chat.expiresAt > now)
}

function normalizeSnapshot(raw, userId) {
  if (!raw || typeof raw !== 'object') return null
  return {
    chats: filterActiveChats(raw.chats || [], userId),
    users: slimUsers(raw.users || {}),
    updatedAt: raw.updatedAt || 0,
  }
}

export function getChatsListSnapshot(userId) {
  if (!userId) return null

  const cached = memory.get(userId)
  if (cached) {
    const fresh = normalizeSnapshot(cached, userId)
    if (fresh) {
      memory.set(userId, fresh)
      return fresh
    }
  }

  const store = readStore()
  const entry = store[userId]
  if (!entry) return null
  if (Date.now() - (entry.updatedAt || 0) > TTL_MS) {
    delete store[userId]
    writeStore(store)
    return null
  }

  const fresh = normalizeSnapshot(entry, userId)
  if (!fresh) return null
  memory.set(userId, fresh)
  return fresh
}

export function setChatsListSnapshot(userId, { chats, users } = {}) {
  if (!userId) return

  const next = {
    chats: filterActiveChats(chats || [], userId),
    users: slimUsers(users || {}),
    updatedAt: Date.now(),
  }

  memory.set(userId, next)

  const store = readStore()
  store[userId] = next
  writeStore(store)
}
