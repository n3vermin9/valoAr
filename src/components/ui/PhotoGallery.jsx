import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'

export default function PhotoGallery({ photos = [], initialIndex = 0, onClose }) {
  const [index, setIndex] = useState(initialIndex)
  const validPhotos = photos.filter(Boolean)

  if (!validPhotos.length) return null

  const goPrev = (e) => {
    e.stopPropagation()
    setIndex((i) => (i > 0 ? i - 1 : validPhotos.length - 1))
  }

  const goNext = (e) => {
    e.stopPropagation()
    setIndex((i) => (i < validPhotos.length - 1 ? i + 1 : 0))
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[80] bg-black/95 flex items-center justify-center"
        onClick={onClose}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-20 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-xl"
        >
          ×
        </button>

        {validPhotos.length > 1 && (
          <button
            onClick={goPrev}
            className="absolute left-0 top-0 bottom-0 w-1/3 z-10 cursor-pointer"
            aria-label="Previous photo"
          />
        )}

        <img
          src={validPhotos[index]}
          alt=""
          onClick={(e) => e.stopPropagation()}
          className="relative z-10 max-w-[90vw] max-h-[85vh] object-contain rounded-2xl pointer-events-auto"
        />

        {validPhotos.length > 1 && (
          <button
            onClick={goNext}
            className="absolute right-0 top-0 bottom-0 w-1/3 z-10 cursor-pointer"
            aria-label="Next photo"
          />
        )}

        {validPhotos.length > 1 && (
          <div className="absolute bottom-8 left-0 right-0 z-20 flex justify-center gap-2 pointer-events-none">
            {validPhotos.map((_, i) => (
              <span
                key={i}
                className={`w-2 h-2 rounded-full ${i === index ? 'bg-white' : 'bg-white/30'}`}
              />
            ))}
          </div>
        )}
      </motion.div>
    </AnimatePresence>
  )
}
