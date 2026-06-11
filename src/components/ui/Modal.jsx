import { useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { modalGlassClass, modalScrimClass } from '../../utils/designSystem'

const overlayTransition = { duration: 0.24, ease: [0.32, 0.72, 0, 1] }

const panelTransition = { type: 'spring', stiffness: 380, damping: 34, mass: 0.82 }

const fullscreenPanelTransition = { type: 'spring', stiffness: 340, damping: 34, mass: 0.9 }

export default function Modal({
  isOpen,
  onClose,
  children,
  className = '',
  glass = false,
  fullscreen = false,
  overlayClassName = 'z-50',
}) {
  const ref = useRef(null)

  useEffect(() => {
    if (fullscreen) return
    const handleClick = (e) => {
      if (!ref.current || ref.current.contains(e.target)) return
      // Story viewer portals to body outside the modal panel — don't dismiss profile underneath
      if (e.target.closest?.('[data-story-viewer]')) return
      onClose()
    }
    if (isOpen) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [isOpen, onClose, fullscreen])

  const panelClass = fullscreen
    ? `w-full h-full max-w-none max-h-none rounded-none overflow-hidden bg-[var(--ios-bg)] flex flex-col ${className}`
    : glass
      ? `${modalGlassClass} max-w-md w-full max-h-[90vh] overflow-y-auto ${className}`
      : `bg-[var(--ios-bg-elevated)] backdrop-blur-xl rounded-[var(--ios-radius-xl)] border border-[var(--ios-separator)] max-w-md w-full max-h-[90vh] overflow-y-auto ${className}`

  const overlayClass = fullscreen
    ? `fixed inset-0 ${overlayClassName} bg-[var(--ios-bg)]`
    : `fixed inset-0 flex items-center justify-center p-4 ${overlayClassName} ${
        glass ? modalScrimClass : 'bg-black/50 backdrop-blur-sm'
      }`

  const panelMotion = fullscreen
    ? {
        initial: { x: '100%' },
        animate: { x: 0 },
        exit: { x: '100%' },
        transition: fullscreenPanelTransition,
      }
    : {
        initial: { opacity: 0, scale: 0.94, y: 14 },
        animate: { opacity: 1, scale: 1, y: 0 },
        exit: { opacity: 0, scale: 0.97, y: 10 },
        transition: panelTransition,
      }

  const overlayMotion = fullscreen
    ? { initial: { opacity: 1 }, animate: { opacity: 1 }, exit: { opacity: 1 } }
    : { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 }, transition: overlayTransition }

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="modal-overlay"
          {...overlayMotion}
          className={overlayClass}
        >
          <motion.div
            ref={ref}
            key="modal-panel"
            {...panelMotion}
            className={panelClass}
          >
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
