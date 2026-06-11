import { glassNavBarClass, liquidGlassNavBarClass } from '../../utils/designSystem'

export default function GlassNavBar({ children, className = '', liquid = false }) {
  return (
    <div
      className={`${liquid ? liquidGlassNavBarClass : glassNavBarClass} ${className}`}
      style={{ paddingTop: 'calc(var(--ios-safe-top) + 8px)' }}
    >
      {children}
    </div>
  )
}
