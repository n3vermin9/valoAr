import { AnimatePresence, motion } from 'framer-motion'

const TONE_CLASS = {
  error: 'text-red-400',
  success: 'text-green-400',
  neutral: 'text-[var(--ios-label-secondary)]',
}

const hintMotion = {
  initial: { opacity: 0, y: 3 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -2 },
  transition: { duration: 0.22, ease: [0.32, 0.72, 0, 1] },
}

/** Always reserves one line so validation text does not shift the form. */
export default function FieldHint({ tone = 'neutral', children, className = '' }) {
  return (
    <div
      className={`mt-1.5 min-h-[18px] text-[13px] leading-[18px] ${className}`}
      aria-live="polite"
    >
      <AnimatePresence mode="wait" initial={false}>
        {children ? (
          <motion.p
            key={`${tone}:${children}`}
            {...hintMotion}
            className={TONE_CLASS[tone] || TONE_CLASS.neutral}
          >
            {children}
          </motion.p>
        ) : null}
      </AnimatePresence>
    </div>
  )
}
