import { createPortal } from 'react-dom'
import { motion } from 'framer-motion'
import { IconX } from '@tabler/icons-react'
import { getStoryColorClass } from '../../utils/storyHelpers'
import { storyGlassButtonClass } from '../../utils/designSystem'

export default function StoryUnavailableViewer({ onClose }) {
  return createPortal(
    <motion.div
      data-story-viewer
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-[95] overflow-hidden"
    >
      <div
        className={`absolute inset-0 flex flex-col ${getStoryColorClass('slate')}`}
      >
        <div className="flex items-center justify-end px-4 pt-[calc(var(--ios-safe-top)+12px)] pb-3">
          <button
            type="button"
            onClick={onClose}
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
