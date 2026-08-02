import { useMemo } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { getStoryOpenMotion, storyShellTransition } from '../../utils/storyHelpers'

export default function ImageViewer({ src, onClose, openOrigin = null }) {
  const openMotion = useMemo(() => getStoryOpenMotion(openOrigin), [openOrigin])

  return (
    <AnimatePresence>
      {src ? (
        <motion.div
          key={src}
          initial={{ scale: openMotion.initialScale, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: openMotion.initialScale, opacity: 0 }}
          transition={storyShellTransition}
          style={{ transformOrigin: openMotion.transformOrigin }}
          className="fixed inset-0 z-[60] bg-black/90 flex items-center justify-center p-4 will-change-transform"
          onClick={onClose}
        >
          <img
            src={src}
            alt=""
            draggable={false}
            className="max-w-full max-h-full object-contain rounded-lg select-none pointer-events-auto"
            onClick={(e) => e.stopPropagation()}
          />
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}
