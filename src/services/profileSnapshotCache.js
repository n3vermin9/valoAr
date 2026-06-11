const STORAGE_KEY = 'arvoli-profile-snapshots'
const TTL_MS = 7 * 24 * 60 * 60 * 1000

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
    // ignore quota errors
  }
}

export function getProfileSnapshots(userIds = []) {
  const store = readStore()
  const now = Date.now()
  const result = {}

  for (const userId of userIds) {
    const entry = store[userId]
    if (!entry || now - entry.timestamp > TTL_MS) continue
    result[userId] = {
      id: userId,
      username: entry.username || 'User',
      photos: entry.photo ? [entry.photo] : [],
    }
  }

  return result
}

export function setProfileSnapshot(userId, { username, photo } = {}) {
  if (!userId) return
  const store = readStore()
  store[userId] = {
    username: username || store[userId]?.username || 'User',
    photo: photo ?? store[userId]?.photo ?? null,
    timestamp: Date.now(),
  }
  writeStore(store)
}
