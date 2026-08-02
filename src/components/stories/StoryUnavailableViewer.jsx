import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion } from 'framer-motion'
import { IconX } from '@tabler/icons-react'
import { getStoryColorClass, getStoryOpenMotion, storyShellTransition } from '../../utils/storyHelpers'
import { storyGlassButtonClass } from '../../utils/designSystem'

export default function StoryUnavailableViewer({ onClose, openOrigin = null }) {
  const [isPresent, setIsPresent] = useState(true)
  const closedRef = useRef(false)
  const openMotion = useMemo(() => getStoryOpenMotion(openOrigin), [openOrigin])
  const closeScale = Math.min(openMotion.initialScale, 0.86)

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

  return createPortal(
    <motion.div
      data-story-viewer
      initial={{ scale: openMotion.initialScale, opacity: 1 }}
      animate={
        isPresent
          ? { scale: 1, opacity: 1 }
          : { scale: closeScale, opacity: 0 }
      }
      transition={storyShellTransition}
      onAnimationComplete={() => {
        if (!isPresent) finishClose()
      }}
      style={{ transformOrigin: openMotion.transformOrigin }}
      className="fixed inset-0 z-[95] overflow-hidden will-change-transform bg-black"
    >
      <div className={`absolute inset-0 flex flex-col ${getStoryColorClass('slate')}`}>
        <div className="flex items-center justify-end px-4 pt-[calc(var(--ios-safe-top)+12px)] pb-3">
          <button
            type="button"
            onClick={requestClose}
            className={storyGlassButtonClass}
            aria-label="Close"
          >
            <IconX size={22} />
          </button>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center px-8 text-center">
          <p className="text-lg font-semibold text-white/90">Story unavailable</p>
          <p className="mt-2 text-sm text-white/55">
            This story may have expired or been removed.
          </p>
        </div>
      </div>
    </motion.div>,
    document.body
  )
}
