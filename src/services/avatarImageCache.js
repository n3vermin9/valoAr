const CACHE_NAME = 'arvoli-avatars-v1'
const blobByUrl = new Map()
const pendingByUrl = new Map()

export function optimizeAvatarUrl(url, size = 128) {
  if (!url || typeof url !== 'string') return url

  try {
    const host = new URL(url).hostname
    if (host.includes('googleusercontent.com')) {
      const base = url.replace(/=s\d+(-c)?$/, '')
      return `${base}=s${size}-c`
    }
    if (host.includes('gstatic.com')) {
      const joiner = url.includes('?') ? '&' : '?'
      return `${url}${joiner}s=${size}`
    }
  } catch {
    // ignore invalid URLs
  }

  return url
}

export function getAvatarDisplayUrl(url, size = 128) {
  const optimized = optimizeAvatarUrl(url, size)
  return blobByUrl.get(optimized) || optimized
}

async function loadAvatarImage(optimized) {
  if (typeof caches !== 'undefined') {
    try {
      const cache = await caches.open(CACHE_NAME)
      let response = await cache.match(optimized)
      if (!response) {
        response = await fetch(optimized, { mode: 'cors', credentials: 'omit' })
        if (response.ok) await cache.put(optimized, response.clone())
      }
      if (response?.ok) {
        const blob = await response.blob()
        const blobUrl = URL.createObjectURL(blob)
        blobByUrl.set(optimized, blobUrl)
        return blobUrl
      }
    } catch {
      // fall through to Image preload
    }
  }

  return new Promise((resolve) => {
    const img = new Image()
    img.decoding = 'async'
    img.onload = () => resolve(optimized)
    img.onerror = () => resolve(optimized)
    img.src = optimized
  })
}

export function preloadAvatarImage(url, size = 128) {
  const optimized = optimizeAvatarUrl(url, size)
  if (!optimized) return Promise.resolve(null)
  if (blobByUrl.has(optimized)) return Promise.resolve(blobByUrl.get(optimized))
  if (pendingByUrl.has(optimized)) return pendingByUrl.get(optimized)

  const promise = loadAvatarImage(optimized).finally(() => {
    pendingByUrl.delete(optimized)
  })
  pendingByUrl.set(optimized, promise)
  return promise
}

export function preloadAvatarImages(urls, size = 128) {
  const unique = [...new Set(urls.filter(Boolean))]
  return Promise.all(unique.map((url) => preloadAvatarImage(url, size)))
}
