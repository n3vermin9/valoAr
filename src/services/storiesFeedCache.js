import { isStoryActive } from '../utils/storyHelpers'

const STORAGE_KEY = 'arvoli-stories-feed-v1'
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

function slimUser(user) {
  if (!user) return null
  return {
    id: user.id,
    username: user.username || 'User',
    photos: user.photos?.[0] ? [user.photos[0]] : [],
  }
}

function slimFeed(feed = []) {
  return feed
    .map((entry) => ({
      userId: entry.userId,
      stories: (entry.stories || []).filter((story) => isStoryActive(story)),
    }))
    .filter((entry) => entry.stories.length > 0)
}

function slimUsers(users = {}, feed = []) {
  const next = {}
  for (const entry of feed) {
    const user = slimUser(users[entry.userId])
    if (user) next[entry.userId] = user
  }
  return next
}

function normalizeSnapshot(raw) {
  if (!raw || typeof raw !== 'object') return null
  const feed = slimFeed(raw.feed)
  return {
    feed,
    views: raw.views && typeof raw.views === 'object' ? raw.views : {},
    users: slimUsers(raw.users || {}, feed),
    updatedAt: raw.updatedAt || 0,
  }
}

export function getStoriesFeedSnapshot(viewerId) {
  if (!viewerId) return null

  const cached = memory.get(viewerId)
  if (cached) {
    const fresh = normalizeSnapshot(cached)
    if (fresh) {
      memory.set(viewerId, fresh)
      return fresh
    }
  }

  const store = readStore()
  const entry = store[viewerId]
  if (!entry) return null
  if (Date.now() - (entry.updatedAt || 0) > TTL_MS) {
    delete store[viewerId]
    writeStore(store)
    return null
  }

  const fresh = normalizeSnapshot(entry)
  if (!fresh) return null
  memory.set(viewerId, fresh)
  return fresh
}

export function setStoriesFeedSnapshot(viewerId, { feed, views, users } = {}) {
  if (!viewerId) return

  const next = {
    feed: slimFeed(feed),
    views: views && typeof views === 'object' ? views : {},
    users: slimUsers(users || {}, slimFeed(feed)),
    updatedAt: Date.now(),
  }

  memory.set(viewerId, next)

  const store = readStore()
  store[viewerId] = next
  writeStore(store)
}
