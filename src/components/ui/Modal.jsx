import { useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { modalGlassClass } from '../../utils/helpers'

export default function Modal({ isOpen, onClose, children, className = '', glass = false }) {
  const ref = useRef(null)

  useEffect(() => {
    const handleClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onClose()
    }
    if (isOpen) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [isOpen, onClose])

  const panelClass = glass
    ? `${modalGlassClass} max-w-md w-full max-h-[90vh] overflow-y-auto ${className}`
    : `bg-black/80 backdrop-blur-xl rounded-2xl border border-white/10 max-w-md w-full max-h-[90vh] overflow-y-auto ${className}`

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={false}
          animate={{ opacity: 1 }}
          className={`fixed inset-0 z-50 flex items-center justify-center p-4 ${
            glass ? 'bg-black/40 backdrop-blur-md' : 'bg-black/50 backdrop-blur-sm'
          }`}
        >
        <motion.div
          ref={ref}
          initial={false}
          animate={{ scale: 1, opacity: 1 }}
          className={panelClass}
        >
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
