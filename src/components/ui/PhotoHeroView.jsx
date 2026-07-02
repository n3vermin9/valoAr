import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import ChevronBack from './ChevronBack'
import { chatFloatingButtonClass, chatRoomTopScrimClass, photoHeroFrameClass, photoHeroFullscreenFrameClass, photoHeroImageClass } from '../../utils/designSystem'

export function PhotoHeroFixedBack({ onBack, className = '' }) {
  if (!onBack) return null

  return (
    <div
      className={`fixed top-[max(0.75rem,var(--ios-safe-top))] left-[var(--ios-page-x-lg)] z-40 pointer-events-auto ${className}`}
    >
      <ChevronBack
        onClick={onBack}
        buttonClassName={`${chatFloatingButtonClass} text-white/80`}
        className="w-6 h-6"
      />
    </div>
  )
}

export function PhotoHeroFixedTopRight({ children, className = '' }) {
  if (!children) return null

  return (
    <div
      className={`fixed top-[max(0.75rem,var(--ios-safe-top))] right-[var(--ios-page-x-lg)] z-40 pointer-events-auto ${className}`}
    >
      {children}
    </div>
  )
}

export function PhotoHeroPlaceholder({ children, className = '' }) {
  return (
    <div className={`${photoHeroFrameClass} bg-white/[0.04] ${className}`}>
      <div
        aria-hidden
        className={chatRoomTopScrimClass}
        style={{ height: 'calc(var(--ios-safe-top) + 4.5rem)' }}
      />
      <div
        aria-hidden
        className="absolute bottom-0 inset-x-0 z-[10] pointer-events-none bg-gradient-to-t from-black via-black/80 to-transparent h-32"
      />
      {children}
    </div>
  )
}

export default function PhotoHeroView({
  photos = [],
  initialIndex = 0,
  onBack,
  showEmbeddedBack = false,
  fullscreen = false,
  className = '',
  topRightSlot = null,
  onPhotoTap,
}) {
  const validPhotos = photos.filter(Boolean)
  const [index, setIndex] = useState(initialIndex)
  const entryCount = validPhotos.length
  const safeIndex = entryCount ? Math.min(index, entryCount - 1) : 0
  const hasMultiplePhotos = entryCount > 1

  useEffect(() => {
    setIndex(initialIndex)
  }, [initialIndex, validPhotos.join('|')])

  useEffect(() => {
    if (entryCount === 0) {
      setIndex(0)
      return
    }
    if (index >= entryCount) setIndex(entryCount - 1)
  }, [entryCount, index])

  if (!validPhotos.length) return null

  const goToPrevious = (e) => {
    e.stopPropagation()
    setIndex((current) => (current - 1 + entryCount) % entryCount)
  }

  const goToNext = (e) => {
    e.stopPropagation()
    setIndex((current) => (current + 1) % entryCount)
  }

  const shellClass = fullscreen
    ? 'fixed inset-0 z-[90] flex items-center justify-center bg-black'
    : `relative w-full bg-black ${className}`

  const frameClass = fullscreen ? photoHeroFullscreenFrameClass : photoHeroFrameClass

  const showBack = showEmbeddedBack && onBack

  return (
    <div className={shellClass}>
      <div className={frameClass}>
        <img
          key={validPhotos[safeIndex]}
          src={validPhotos[safeIndex]}
          alt=""
          className={photoHeroImageClass}
        />

        {hasMultiplePhotos ? (
          <>
            <button
              type="button"
              onClick={goToPrevious}
              className="absolute inset-y-0 left-0 z-[15] w-[38%]"
              aria-label="Previous photo"
            />
            <button
              type="button"
              onClick={onPhotoTap}
              className="absolute inset-y-0 left-[38%] z-[15] w-[24%]"
              aria-label="View photo"
            />
            <button
              type="button"
              onClick={goToNext}
              className="absolute inset-y-0 right-0 z-[15] w-[38%]"
              aria-label="Next photo"
            />
          </>
        ) : (
          <button
            type="button"
            onClick={onPhotoTap}
            className="absolute inset-0 z-[15]"
            aria-label="View photo"
          />
        )}

        <div
          aria-hidden
          className={chatRoomTopScrimClass}
          style={{ height: 'calc(var(--ios-safe-top) + 4.5rem)' }}
        />
        {!fullscreen ? (
          <div
            aria-hidden
            className="absolute bottom-0 inset-x-0 z-[10] pointer-events-none bg-gradient-to-t from-black via-black/80 to-transparent h-32"
          />
        ) : null}

        {hasMultiplePhotos ? (
          <div
            className="absolute top-[calc(var(--ios-safe-top)+2rem)] left-1/2 z-[20] flex w-[min(52vw,200px)] -translate-x-1/2 gap-1 pointer-events-none"
            aria-hidden
          >
            {validPhotos.map((photo, photoIndex) => (
              <div key={photo} className="flex-1 h-[2px] rounded-full bg-white/25 overflow-hidden">
                <div
                  className={`h-full rounded-full bg-white transition-[width] duration-75 ${
                    photoIndex === safeIndex ? 'w-full' : 'w-0'
                  }`}
                />
              </div>
            ))}
          </div>
        ) : null}

        {showBack ? (
          <div className="absolute top-[max(0.75rem,var(--ios-safe-top))] left-[var(--ios-page-x-lg)] z-30">
            <ChevronBack
              onClick={onBack}
              buttonClassName={`${chatFloatingButtonClass} text-white/80`}
              className="w-6 h-6"
            />
          </div>
        ) : null}

        {topRightSlot ? (
          <div className="absolute top-[max(0.75rem,var(--ios-safe-top))] right-[var(--ios-page-x-lg)] z-30">
            {topRightSlot}
          </div>
        ) : null}
      </div>
    </div>
  )
}

export function PhotoHeroContentOverlap({ children, className = '' }) {
  return (
    <motion.div
      layout
      animate={{
        marginTop: '-3.5rem',
        paddingTop: '2rem',
      }}
      transition={{
        layout: { type: 'spring', stiffness: 420, damping: 36 },
        marginTop: { type: 'spring', stiffness: 420, damping: 36 },
        paddingTop: { type: 'spring', stiffness: 420, damping: 36 },
      }}
      className={`relative z-10 bg-gradient-to-b from-transparent via-black/95 to-black ${className}`}
    >
      {children}
    </motion.div>
  )
}
