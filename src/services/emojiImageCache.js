import { emojiToUnified, getAppleEmojiCdnUrl } from '../utils/iosEmoji'
import { MESSAGE_REACTIONS } from '../utils/helpers'

const STORAGE_KEY = 'valo_apple_emoji_v1'
const MAX_STORED = 48
const memoryCache = new Map() // unified -> dataUrl
const pending = new Map()
let hydrated = false

function hydrateFromStorage() {
  if (hydrated || typeof localStorage === 'undefined') return
  hydrated = true
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return
    const parsed = JSON.parse(raw)
    const entries = parsed?.emojis
    if (!entries || typeof entries !== 'object') return
    for (const [unified, dataUrl] of Object.entries(entries)) {
      if (typeof dataUrl === 'string' && dataUrl.startsWith('data:image/')) {
        memoryCache.set(unified, dataUrl)
      }
    }
  } catch {
    // ignore corrupt cache
  }
}

function persistToStorage() {
  if (typeof localStorage === 'undefined') return
  try {
    const emojis = {}
    // Prefer reaction set, then most recently inserted (Map insertion order).
    const preferred = new Set(MESSAGE_REACTIONS.map((e) => emojiToUnified(e)))
    for (const emoji of MESSAGE_REACTIONS) {
      const key = emojiToUnified(emoji)
      const value = memoryCache.get(key)
      if (value) emojis[key] = value
    }
    for (const [key, value] of memoryCache) {
      if (preferred.has(key)) continue
      if (Object.keys(emojis).length >= MAX_STORED) break
      emojis[key] = value
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ v: 1, emojis }))
  } catch {
    // Quota / private mode — keep memory cache only.
  }
}

export function getCachedAppleEmojiDataUrl(emoji) {
  hydrateFromStorage()
  if (!emoji) return null
  const unified = emojiToUnified(emoji)
  return memoryCache.get(unified) || memoryCache.get(unified.replace(/-fe0f$/, '')) || null
}

async function fetchAsDataUrl(url) {
  const response = await fetch(url, {
    mode: 'cors',
    credentials: 'omit',
    referrerPolicy: 'no-referrer',
  })
  if (!response.ok) throw new Error(`emoji fetch ${response.status}`)
  const blob = await response.blob()
  if (!blob.type.startsWith('image/') && blob.type !== '') {
    throw new Error('not an image')
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
}

/** Fetch + store one emoji PNG in memory + localStorage. */
export function cacheAppleEmoji(emoji) {
  hydrateFromStorage()
  if (!emoji) return Promise.resolve(null)
  const unified = emojiToUnified(emoji)
  if (memoryCache.has(unified)) return Promise.resolve(memoryCache.get(unified))
  if (pending.has(unified)) return pending.get(unified)

  const cdnUrl = getAppleEmojiCdnUrl(emoji)
  const promise = fetchAsDataUrl(cdnUrl)
    .catch(async () => {
      // Strip FE0F presentation selector — some datasource files omit it.
      const fallbackUnified = unified.replace(/-fe0f$/, '')
      if (fallbackUnified === unified) throw new Error('no fallback')
      const fallbackUrl = `https://cdn.jsdelivr.net/npm/emoji-datasource-apple/img/apple/64/${fallbackUnified}.png`
      return fetchAsDataUrl(fallbackUrl)
    })
    .then((dataUrl) => {
      memoryCache.set(unified, dataUrl)
      // Cap memory: drop oldest non-reaction entries.
      if (memoryCache.size > MAX_STORED + MESSAGE_REACTIONS.length) {
        const keep = new Set(MESSAGE_REACTIONS.map((e) => emojiToUnified(e)))
        for (const key of memoryCache.keys()) {
          if (memoryCache.size <= MAX_STORED) break
          if (!keep.has(key)) memoryCache.delete(key)
        }
      }
      persistToStorage()
      return dataUrl
    })
    .catch(() => null)
    .finally(() => pending.delete(unified))

  pending.set(unified, promise)
  return promise
}

export function cacheAppleEmojis(emojis) {
  const unique = [...new Set((emojis || []).filter(Boolean))]
  return Promise.all(unique.map((emoji) => cacheAppleEmoji(emoji)))
}

/** Boot / first-chat warm: reaction bar + any already-persisted keys stay hot. */
export function preloadMainEmojis() {
  hydrateFromStorage()
  return cacheAppleEmojis(MESSAGE_REACTIONS)
}

/** Remember a picker selection for next cold start. */
export function rememberUsedEmoji(emoji) {
  if (!emoji) return
  void cacheAppleEmoji(emoji)
}
