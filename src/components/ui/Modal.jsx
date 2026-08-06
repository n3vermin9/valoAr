import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  modalGlassClass,
  modalScrimClass,
  pageSwitchMotion,
  pushPageMotion,
} from '../../utils/designSystem'
import { setModalOverlayOpen } from '../../utils/modalOverlay'

const overlayTransition = { duration: 0.24, ease: [0.32, 0.72, 0, 1] }

export default function Modal({
  isOpen,
  onClose,
  children,
  className = '',
  glass = false,
  fullscreen = false,
  overlayClassName = 'z-[100]',
}) {
  const ref = useRef(null)

  useEffect(() => {
    if (!isOpen) return
    setModalOverlayOpen(true)
    return () => setModalOverlayOpen(false)
  }, [isOpen])

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

  // Full-screen panels are pages (profiles), so they push in from the trailing edge and
  // carry their own background — a scrim under them would flash before the slide starts.
  const overlayClass = fullscreen
    ? `fixed inset-0 overflow-hidden ${overlayClassName}`
    : `fixed inset-0 flex items-center justify-center p-4 ${overlayClassName} ${
        glass ? modalScrimClass : 'bg-[var(--ios-modal-scrim)] backdrop-blur-sm'
      }`

  const panelMotion = fullscreen
    ? pushPageMotion
    : {
        ...pageSwitchMotion,
        initial: { scale: 1.05, opacity: 0 },
        exit: { scale: 1.05, opacity: 0, transition: pageSwitchMotion.exit.transition },
      }

  const overlayMotion = fullscreen
    ? { initial: { opacity: 1 }, animate: { opacity: 1 }, exit: { opacity: 1 } }
    : { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 }, transition: overlayTransition }

  if (typeof document === 'undefined') return null

  return createPortal(
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
            className={`origin-center ${panelClass}`}
          >
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  )
}
