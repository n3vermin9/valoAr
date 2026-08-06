import { motion } from 'framer-motion'
import {
  chatPageSwitchMotion,
  pageSwitchMotion,
  tabSlideTransition,
  tabSlideVariants,
} from '../../utils/designSystem'

export default function PageTransition({
  children,
  disableTransform = false,
  instantExit = false,
  direction = 0,
  useTabSlide = false,
}) {
  if (useTabSlide && !disableTransform) {
    return (
      <motion.div
        className="absolute inset-0 h-full overflow-hidden bg-[var(--ios-bg)] origin-center will-change-transform"
        custom={direction}
        variants={tabSlideVariants}
        initial="enter"
        animate="center"
        exit="exit"
        transition={tabSlideTransition}
      >
        {children}
      </motion.div>
    )
  }

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
