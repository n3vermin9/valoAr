const STORAGE_KEY = 'arvoli-discover-cards-v1'
const TTL_MS = 24 * 60 * 60 * 1000
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

function slimProfile(profile) {
  if (!profile?.id) return null
  return {
    id: profile.id,
    username: profile.username || 'User',
    age: profile.age || null,
    bio: typeof profile.bio === 'string' ? profile.bio.slice(0, 180) : '',
    photos: (profile.photos || []).filter(Boolean).slice(0, 3),
    gender: profile.gender || null,
    lookingFor: profile.lookingFor || null,
    socialLinks: profile.socialLinks || null,
  }
}

function slimList(list = []) {
  return list.map(slimProfile).filter(Boolean)
}

function normalizeSnapshot(raw) {
  if (!raw || typeof raw !== 'object') return null
  return {
    newProfiles: slimList(raw.newProfiles),
    recentProfiles: slimList(raw.recentProfiles),
    updatedAt: raw.updatedAt || 0,
  }
}

export function getDiscoverCardsSnapshot(userId) {
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

export function setDiscoverCardsSnapshot(userId, { newProfiles, recentProfiles } = {}) {
  if (!userId) return

  const next = {
    newProfiles: slimList(newProfiles),
    recentProfiles: slimList(recentProfiles),
    updatedAt: Date.now(),
  }

  memory.set(userId, next)
  const store = readStore()
  store[userId] = next
  writeStore(store)
}

export function clearDiscoverCardsSnapshot() {
  memory.clear()
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // ignore
  }
}
