import { motion } from 'framer-motion'
import { pageSwitchMotion } from '../../utils/designSystem'

export default function PageTransition({ children }) {
  return (
    <motion.div
      className="absolute inset-0 h-full overflow-hidden bg-[var(--ios-bg)] origin-center"
      {...pageSwitchMotion}
      exit={{
        ...pageSwitchMotion.exit,
        zIndex: 0,
      }}
      animate={{
        ...pageSwitchMotion.animate,
        zIndex: 10,
      }}
      initial={{
        ...pageSwitchMotion.initial,
        zIndex: 10,
      }}
    >
      {children}
    </motion.div>
  )
}
