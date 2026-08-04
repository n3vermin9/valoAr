import { Capacitor } from '@capacitor/core'

const CACHE_NAME = 'arvoli-avatars-v2'
const blobByUrl = new Map()
const pendingByUrl = new Map()

/** Only rewrite known Google profile-photo URL shapes — never gstatic thumbnails. */
export function optimizeAvatarUrl(url, size = 128) {
  if (!url || typeof url !== 'string') return url

  try {
    const parsed = new URL(url)
    const host = parsed.hostname
    // lh3.googleusercontent.com / *.googleusercontent.com profile photos use =sNNN-c
    if (host.includes('googleusercontent.com') && !host.includes('gstatic.com')) {
      const base = url.replace(/=s\d+(-c)?$/i, '')
      return `${base}=s${size}-c`
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
  // iOS Simulator + CapacitorHttp/URLSession often fail Google image hosts with
  // NSURLError -1017 (HTTP/3). Let <img> load through WKWebView instead.
  if (Capacitor.isNativePlatform()) {
    return optimized
  }

  if (typeof caches !== 'undefined') {
    try {
      const cache = await caches.open(CACHE_NAME)
      let response = await cache.match(optimized)
      if (!response) {
        response = await fetch(optimized, { mode: 'cors', credentials: 'omit', referrerPolicy: 'no-referrer' })
        const type = response.headers.get('content-type') || ''
        if (response.ok && type.startsWith('image/')) {
          await cache.put(optimized, response.clone())
        } else {
          response = null
        }
      }
      if (response?.ok) {
        const type = response.headers.get('content-type') || ''
        if (!type || type.startsWith('image/')) {
          const blob = await response.blob()
          if (blob.size > 0 && (!blob.type || blob.type.startsWith('image/'))) {
            const blobUrl = URL.createObjectURL(blob)
            blobByUrl.set(optimized, blobUrl)
            return blobUrl
          }
        }
      }
    } catch {
      // fall through — display the network URL directly
    }
  }

  return optimized
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
