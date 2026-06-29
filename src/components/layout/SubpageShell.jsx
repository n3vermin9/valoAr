import { useNavigate, useLocation } from 'react-router-dom'
import ChevronBack from '../ui/ChevronBack'
import { subpageHeaderClass, subpageTitleClass, linkActionClass } from '../../utils/designSystem'

export default function SubpageShell({
  title,
  onBack,
  backTo,
  trailing,
  children,
  footer,
  className = '',
}) {
  const navigate = useNavigate()
  const location = useLocation()

  const handleBack = () => {
    if (onBack) {
      onBack()
      return
    }
    if (backTo) {
      navigate(backTo, { replace: true, state: location.state })
      return
    }
    navigate(-1)
  }

  return (
    <div className={`h-full flex flex-col ${className}`}>
      <div className={subpageHeaderClass}>
        <ChevronBack onClick={handleBack} />
        <h1 className={subpageTitleClass}>{title}</h1>
        {trailing}
      </div>
      <div className="flex-1 overflow-y-auto pb-8">{children}</div>
      {footer ? (
        <div className="shrink-0 px-[var(--ios-page-x-lg)] pb-[max(1.5rem,var(--ios-safe-bottom))]">
          {footer}
        </div>
      ) : null}
    </div>
  )
}

export function SubpageHeaderBar({ title, onBack, trailing }) {
  return (
    <div className={subpageHeaderClass}>
      <ChevronBack onClick={onBack} />
      <h1 className={subpageTitleClass}>{title}</h1>
      {trailing}
    </div>
  )
}

export function SubpageCancelLink({ onClick, label = 'Cancel' }) {
  return (
    <button type="button" onClick={onClick} className={linkActionClass}>
      {label}
    </button>
  )
}
