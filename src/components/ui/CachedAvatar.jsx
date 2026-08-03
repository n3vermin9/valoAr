import { useState, useEffect } from 'react'
import {
  getAvatarDisplayUrl,
  optimizeAvatarUrl,
  preloadAvatarImage,
} from '../../services/avatarImageCache'

export default function CachedAvatar({
  src,
  fallback,
  size = 56,
  alt = '',
  className = '',
  draggable = false,
}) {
  const pixelSize = Math.max(32, Math.round(size * 2))
  const optimized = src ? optimizeAvatarUrl(src, pixelSize) : null

  const [displaySrc, setDisplaySrc] = useState(() => {
    if (!optimized) return fallback
    return getAvatarDisplayUrl(src, pixelSize) || optimized
  })

  useEffect(() => {
    if (!optimized) {
      setDisplaySrc(fallback)
      return
    }

    // Always paint the network URL first so avatars aren't blank while caching.
    setDisplaySrc(getAvatarDisplayUrl(src, pixelSize) || optimized)

    let cancelled = false
    preloadAvatarImage(src, pixelSize).then((resolved) => {
      if (!cancelled && resolved) setDisplaySrc(resolved)
    })

    return () => {
      cancelled = true
    }
  }, [src, fallback, pixelSize, optimized])

  const handleError = () => {
    if (displaySrc && displaySrc !== optimized && optimized) {
      setDisplaySrc(optimized)
      return
    }
    if (displaySrc !== fallback) setDisplaySrc(fallback)
  }

  return (
    <img
      src={displaySrc || fallback}
      alt={alt}
      className={className}
      draggable={draggable}
      decoding="async"
      loading="eager"
      referrerPolicy="no-referrer"
      onError={handleError}
    />
  )
}
