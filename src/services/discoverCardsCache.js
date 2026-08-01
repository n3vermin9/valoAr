const STORAGE_KEY = 'arvoli-discover-cards-v2'
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

/** Slim card fields needed for instant Discover paint (text + photo URLs). */
function slimProfile(profile) {
  if (!profile?.id) return null
  const photos = (profile.photos || []).filter(Boolean).slice(0, 6)
  return {
    id: profile.id,
    username: profile.username || 'User',
    age: profile.age ?? null,
    bio: typeof profile.bio === 'string' ? profile.bio.slice(0, 500) : '',
    photos,
    gender: profile.gender || null,
    interestedIn: profile.interestedIn || null,
    city: profile.city || null,
    hobbies: Array.isArray(profile.hobbies) ? profile.hobbies.slice(0, 8) : [],
    socials: profile.socials || { telegram: '', instagram: '', tiktok: '' },
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
    // Drop legacy v1 key so old wrong-shaped entries are not left behind.
    localStorage.removeItem('arvoli-discover-cards-v1')
  } catch {
    // ignore
  }
}
