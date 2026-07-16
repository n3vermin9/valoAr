const STORAGE_KEY = 'arvoli-inbox-page-v1'
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

function slimUser(user) {
  if (!user) return null
  return {
    id: user.id,
    username: user.username || 'User',
    photos: user.photos?.[0] ? [user.photos[0]] : [],
    age: user.age || null,
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

function slimLike(like) {
  if (!like) return null
  return {
    id: like.id || like.fromUserId || null,
    fromUserId: like.fromUserId || like.id || null,
    read: Boolean(like.read),
    message: like.message || '',
    timestamp: toMs(like.timestamp),
  }
}

function slimInboxItem(item) {
  if (!item?.id) return null
  return {
    id: item.id,
    type: item.type || null,
    actorId: item.actorId || null,
    read: Boolean(item.read),
    createdAt: toMs(item.createdAt),
    storyId: item.storyId || null,
    emoji: item.emoji || null,
    text: item.text || '',
    title: item.title || '',
    body: item.body || '',
  }
}

function normalizeSnapshot(raw) {
  if (!raw || typeof raw !== 'object') return null
  return {
    likes: (raw.likes || []).map(slimLike).filter(Boolean),
    profiles: slimUsers(raw.profiles || {}),
    inboxItems: (raw.inboxItems || []).map(slimInboxItem).filter(Boolean),
    inboxProfiles: slimUsers(raw.inboxProfiles || {}),
    outgoingIds: Array.isArray(raw.outgoingIds) ? raw.outgoingIds.filter(Boolean) : [],
    outgoingProfiles: slimUsers(raw.outgoingProfiles || {}),
    updatedAt: raw.updatedAt || 0,
  }
}

export function getInboxPageSnapshot(userId) {
  if (!userId) return null

  const cached = memory.get(userId)
  if (cached) {
    const fresh = normalizeSnapshot(cached)
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

  const fresh = normalizeSnapshot(entry)
  if (!fresh) return null
  memory.set(userId, fresh)
  return fresh
}

export function setInboxPageSnapshot(
  userId,
  { likes, profiles, inboxItems, inboxProfiles, outgoingIds, outgoingProfiles } = {}
) {
  if (!userId) return

  const next = {
    likes: (likes || []).map(slimLike).filter(Boolean),
    profiles: slimUsers(profiles || {}),
    inboxItems: (inboxItems || []).map(slimInboxItem).filter(Boolean),
    inboxProfiles: slimUsers(inboxProfiles || {}),
    outgoingIds: Array.isArray(outgoingIds) ? outgoingIds.filter(Boolean) : [],
    outgoingProfiles: slimUsers(outgoingProfiles || {}),
    updatedAt: Date.now(),
  }

  memory.set(userId, next)
  const store = readStore()
  store[userId] = next
  writeStore(store)
}

export function clearInboxPageSnapshot() {
  memory.clear()
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // ignore
  }
}
