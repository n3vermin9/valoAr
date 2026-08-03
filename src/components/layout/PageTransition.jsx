import { motion } from 'framer-motion'
import { chatPageSwitchMotion, pageSwitchMotion } from '../../utils/designSystem'

export default function PageTransition({ children, disableTransform = false }) {
  const motionProps = disableTransform ? chatPageSwitchMotion : pageSwitchMotion

  return (
    <motion.div
      className={`absolute inset-0 h-full overflow-hidden bg-[var(--ios-bg)] origin-center${
        disableTransform ? ' page-transition-no-transform' : ''
      }`}
      {...motionProps}
      exit={{
        ...motionProps.exit,
        zIndex: 0,
      }}
      animate={{
        ...motionProps.animate,
        zIndex: 10,
      }}
      initial={{
        ...motionProps.initial,
        zIndex: 10,
      }}
    >
      {children}
    </motion.div>
  )
}
