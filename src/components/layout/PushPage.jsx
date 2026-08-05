import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { pushPageMotion } from '../../utils/designSystem'
import { SubpageHeaderBar } from './SubpageShell'

/**
 * Full-screen drill-in page with the iOS push transition.
 *
 * Portaled to the body so the slide is never clipped by (or trapped inside) the
 * transformed page-transition wrapper it is opened from.
 */
export default function PushPage({
  open,
  title,
  onBack,
  trailing,
  header = true,
  zIndexClass = 'z-[80]',
  className = '',
  children,
}) {
  if (typeof document === 'undefined') return null

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          {...pushPageMotion}
          className={`fixed inset-0 ${zIndexClass} bg-[var(--ios-bg)] flex flex-col ${className}`}
        >
          {header ? <SubpageHeaderBar title={title} onBack={onBack} trailing={trailing} /> : null}
          {children}
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  )
}
