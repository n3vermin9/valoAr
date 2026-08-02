import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion } from 'framer-motion'
import PhotoHeroView from './PhotoHeroView'
import { getStoryOpenMotion, storyShellTransition } from '../../utils/storyHelpers'

export default function PhotoGallery({
  photos = [],
  initialIndex = 0,
  onClose,
  openOrigin = null,
}) {
  const validPhotos = photos.filter(Boolean)
  const [isPresent, setIsPresent] = useState(true)
  const closedRef = useRef(false)
  const openMotion = useMemo(() => getStoryOpenMotion(openOrigin), [openOrigin])

  const finishClose = useCallback(() => {
    if (closedRef.current) return
    closedRef.current = true
    onClose?.()
  }, [onClose])

  const requestClose = useCallback(() => {
    setIsPresent(false)
  }, [])

  useEffect(() => {
    if (isPresent) return undefined
    const fallback = window.setTimeout(finishClose, 500)
    return () => window.clearTimeout(fallback)
  }, [isPresent, finishClose])

  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === 'Escape') requestClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [requestClose])

  if (!validPhotos.length) return null

  return createPortal(
    <motion.div
      initial={{ scale: openMotion.initialScale, opacity: 1 }}
      animate={
        isPresent
          ? { scale: 1, opacity: 1 }
          : { scale: openMotion.initialScale, opacity: 0 }
      }
      transition={storyShellTransition}
      onAnimationComplete={() => {
        if (!isPresent) finishClose()
      }}
      style={{ transformOrigin: openMotion.transformOrigin }}
      className="fixed inset-0 z-[90] overflow-hidden will-change-transform bg-black"
    >
      <PhotoHeroView
        photos={validPhotos}
        initialIndex={initialIndex}
        onBack={requestClose}
        showEmbeddedBack
        fullscreen
      />
    </motion.div>,
    document.body
  )
}
