import { motion } from 'framer-motion'

const fadeEase = [0.4, 0, 0.2, 1]

export default function PageTransition({ children, variant = 'tab' }) {
  const fadeOutDuration = variant === 'push' ? 0.22 : 0.3

  return (
    <motion.div
      className="absolute inset-0 h-full overflow-hidden bg-[var(--ios-bg)]"
      initial={{ opacity: 1, zIndex: 0 }}
      animate={{ opacity: 1, zIndex: 0 }}
      exit={{
        opacity: 0,
        zIndex: 10,
        transition: { duration: fadeOutDuration, ease: fadeEase },
      }}
    >
      {children}
    </motion.div>
  )
}
