const cache = new Map()
const TTL = 5 * 60_000

export function getCachedUser(userId) {
  const entry = cache.get(userId)
  if (!entry) return null
  if (Date.now() - entry.timestamp > TTL) {
    cache.delete(userId)
    return null
  }
  return entry.data
}

export function setCachedUser(userId, data) {
  cache.set(userId, { data, timestamp: Date.now() })
}

export function invalidateUser(userId) {
  cache.delete(userId)
}

export function clearCache() {
  cache.clear()
}
