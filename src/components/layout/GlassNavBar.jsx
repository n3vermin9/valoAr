import { glassNavBarClass } from '../../utils/designSystem'

export default function GlassNavBar({ children, className = '' }) {
  return (
    <div
      className={`${glassNavBarClass} ${className}`}
      style={{ paddingTop: 'calc(var(--ios-safe-top) + 8px)' }}
    >
      {children}
    </div>
  )
}
