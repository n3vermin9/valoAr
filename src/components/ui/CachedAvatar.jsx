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

  const [displaySrc, setDisplaySrc] = useState(() => {
    if (!src) return fallback
    return getAvatarDisplayUrl(src, pixelSize) || optimizeAvatarUrl(src, pixelSize)
  })

  useEffect(() => {
    if (!src) {
      setDisplaySrc(fallback)
      return
    }

    const optimized = optimizeAvatarUrl(src, pixelSize)
    setDisplaySrc(getAvatarDisplayUrl(src, pixelSize) || optimized)

    let cancelled = false
    preloadAvatarImage(src, pixelSize).then((resolved) => {
      if (!cancelled && resolved) setDisplaySrc(resolved)
    })

    return () => {
      cancelled = true
    }
  }, [src, fallback, pixelSize])

  return (
    <img
      src={displaySrc || fallback}
      alt={alt}
      className={className}
      draggable={draggable}
      decoding="async"
      loading="eager"
    />
  )
}
