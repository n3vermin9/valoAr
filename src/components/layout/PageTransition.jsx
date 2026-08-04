import { motion } from 'framer-motion'
import { chatPageSwitchMotion, pageSwitchMotion } from '../../utils/designSystem'

export default function PageTransition({
  children,
  disableTransform = false,
  instantExit = false,
}) {
  const motionProps = disableTransform ? chatPageSwitchMotion : pageSwitchMotion
  const exit = instantExit
    ? { opacity: 0, scale: 1, transition: { duration: 0 }, zIndex: 0 }
    : { ...motionProps.exit, zIndex: 0 }

  return (
    <motion.div
      className={`absolute inset-0 h-full overflow-hidden bg-[var(--ios-bg)] origin-center${
        disableTransform ? ' page-transition-no-transform' : ''
      }`}
      initial={{ ...motionProps.initial, zIndex: 10 }}
      animate={{ ...motionProps.animate, zIndex: 10 }}
      exit={exit}
      transition={motionProps.transition}
    >
      {children}
    </motion.div>
  )
}
