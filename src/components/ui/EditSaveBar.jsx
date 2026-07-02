import { AnimatePresence, motion } from 'framer-motion'
import { btnFilledClass } from '../../utils/designSystem'

const barSpring = { type: 'spring', stiffness: 420, damping: 32 }

export default function EditSaveBar({ visible, formId, loading, disabled, label = 'Save changes' }) {
  return (
    <AnimatePresence>
      {visible ? (
        <motion.div
          key="edit-save-bar"
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 20, opacity: 0 }}
          transition={barSpring}
          className="fixed left-[var(--ios-page-x-lg)] right-[var(--ios-page-x-lg)] z-[71]"
          style={{ bottom: 'calc(var(--ios-safe-bottom) + 1rem)' }}
        >
          <button
            type="submit"
            form={formId}
            disabled={disabled || loading}
            className={`${btnFilledClass} w-full shadow-[0_8px_32px_rgba(0,0,0,0.45)]`}
          >
            {loading ? 'Saving…' : label}
          </button>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}
