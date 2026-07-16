const DB_NAME = 'arvoli-map-tiles-v1'
const STORE = 'tiles'
const DB_VERSION = 1
const MAX_ENTRIES = 900
const TTL_MS = 14 * 24 * 60 * 60 * 1000
const VIEW_KEY = 'arvoli-map-view-v1'

let dbPromise = null
let pruneScheduled = false

function openDb() {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB unavailable'))
      return
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'url' })
        store.createIndex('updatedAt', 'updatedAt')
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error || new Error('Failed to open tile cache'))
  })
  return dbPromise
}

function schedulePrune() {
  if (pruneScheduled) return
  pruneScheduled = true
  queueMicrotask(() => {
    pruneScheduled = false
    pruneTileCache().catch(() => {})
  })
}

async function pruneTileCache() {
  const db = await openDb()
  const tx = db.transaction(STORE, 'readwrite')
  const store = tx.objectStore(STORE)
  const index = store.index('updatedAt')
  const now = Date.now()

  await new Promise((resolve, reject) => {
    const stale = []
    const all = []
    const req = index.openCursor()
    req.onsuccess = () => {
      const cursor = req.result
      if (!cursor) {
        stale.forEach((url) => store.delete(url))
        if (all.length > MAX_ENTRIES) {
          all
            .sort((a, b) => a.updatedAt - b.updatedAt)
            .slice(0, all.length - MAX_ENTRIES)
            .forEach((entry) => store.delete(entry.url))
        }
        resolve()
        return
      }
      const value = cursor.value
      if (now - (value.updatedAt || 0) > TTL_MS) stale.push(value.url)
      else all.push({ url: value.url, updatedAt: value.updatedAt || 0 })
      cursor.continue()
    }
    req.onerror = () => reject(req.error)
  })

  await new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
  })
}

/** @returns {Promise<Blob|null>} */
export async function getCachedTileBlob(url) {
  if (!url) return null
  try {
    const db = await openDb()
    const entry = await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly')
      const req = tx.objectStore(STORE).get(url)
      req.onsuccess = () => resolve(req.result || null)
      req.onerror = () => reject(req.error)
    })
    if (!entry?.blob) return null
    if (Date.now() - (entry.updatedAt || 0) > TTL_MS) return null
    return entry.blob
  } catch {
    return null
  }
}

export async function putCachedTileBlob(url, blob) {
  if (!url || !blob) return
  try {
    const db = await openDb()
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite')
      tx.objectStore(STORE).put({
        url,
        blob,
        updatedAt: Date.now(),
        size: blob.size || 0,
      })
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
    schedulePrune()
  } catch {
    // Quota / private mode — ignore
  }
}

export async function fetchAndCacheTile(url) {
  const cached = await getCachedTileBlob(url)
  if (cached) return cached

  const res = await fetch(url, { mode: 'cors', credentials: 'omit', cache: 'force-cache' })
  if (!res.ok) throw new Error(`Tile fetch failed: ${res.status}`)
  const blob = await res.blob()
  putCachedTileBlob(url, blob).catch(() => {})
  return blob
}

export function loadPersistedMapView() {
  try {
    const raw = localStorage.getItem(VIEW_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (
      !parsed ||
      !Array.isArray(parsed.center) ||
      parsed.center.length !== 2 ||
      typeof parsed.zoom !== 'number'
    ) {
      return null
    }
    return {
      center: [Number(parsed.center[0]), Number(parsed.center[1])],
      zoom: Number(parsed.zoom),
      theme: parsed.theme || null,
    }
  } catch {
    return null
  }
}

export function savePersistedMapView({ center, zoom, theme } = {}) {
  if (!center || typeof zoom !== 'number') return
  try {
    localStorage.setItem(
      VIEW_KEY,
      JSON.stringify({
        center: [center[0], center[1]],
        zoom,
        theme: theme || null,
        updatedAt: Date.now(),
      })
    )
  } catch {
    // ignore
  }
}

export async function clearMapTileCache() {
  try {
    const db = await openDb()
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite')
      tx.objectStore(STORE).clear()
      tx.oncomplete = () => resolve()
      tx.onerror = () => reject(tx.error)
    })
  } catch {
    // ignore
  }
}
