import { AnimatePresence, motion } from 'framer-motion'

export default function ImageViewer({ src, onClose }) {
  return (
    <AnimatePresence>
      {src && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[60] bg-black/90 flex items-center justify-center p-4"
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
      )}
    </AnimatePresence>
  )
}
