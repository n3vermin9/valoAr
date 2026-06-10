import { pageShellClass, pageHeaderClass, pageTitleClass, pageContentClass, pageBottomClearanceClass } from '../../utils/designSystem'

export default function PageShell({
  title,
  trailing,
  children,
  className = '',
  contentClassName = '',
  withNavClearance = true,
  blurTitle = false,
}) {
  return (
    <div className={`${pageShellClass} ${withNavClearance ? pageBottomClearanceClass : ''} relative ${className}`}>
      {title && (
        <header className={`${pageHeaderClass} relative z-10 ${blurTitle ? 'blur-[5px] pointer-events-none transition-[filter] duration-300 ease-out' : ''}`}>
          <h1 className={pageTitleClass}>{title}</h1>
          {trailing}
        </header>
      )}
      <div className={`${pageContentClass} ${contentClassName}`}>{children}</div>
    </div>
  )
}
