import { IconChevronRight } from '@tabler/icons-react'
import {
  ICON_TONE_CLASSES,
  iconTileClass,
  insetCardOuterClass,
  sectionLabelClass,
  settingsRowClass,
  typoHeadlineClass,
  typoSubheadClass,
} from '../../utils/designSystem'

export function SettingsSection({ title, children, className = '' }) {
  return (
    <section className={className}>
      {title ? <p className={`${sectionLabelClass} normal-case`}>{title}</p> : null}
      <div className={`${insetCardOuterClass} overflow-visible`}>{children}</div>
    </section>
  )
}

export function SettingSwitch({ label, description, checked, onChange, disabled }) {
  return (
    <div className="px-4 py-4 border-b border-white/10 last:border-b-0">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className={typoHeadlineClass}>{label}</p>
          {description ? <p className={`${typoSubheadClass} mt-1`}>{description}</p> : null}
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={checked}
          disabled={disabled}
          onClick={() => onChange(!checked)}
          className={`relative w-12 h-7 rounded-full transition-colors shrink-0 disabled:opacity-50 ${
            checked ? 'bg-blue-500' : 'bg-white/20'
          }`}
        >
          <span
            className={`absolute top-1 left-1 w-5 h-5 rounded-full bg-white transition-transform ${
              checked ? 'translate-x-5' : ''
            }`}
          />
        </button>
      </div>
    </div>
  )
}

export function SettingsNavRow({
  label,
  description,
  onClick,
  disabled = false,
  trailing,
  icon: Icon,
  iconTone = 'blue',
  danger = false,
  value,
}) {
  const iconWrapClass = danger ? ICON_TONE_CLASSES.red : ICON_TONE_CLASSES[iconTone] || ICON_TONE_CLASSES.blue

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`${settingsRowClass} disabled:opacity-40`}
    >
      {Icon ? (
        <span className={`${iconTileClass} ${iconWrapClass}`}>
          <Icon size={20} stroke={1.75} />
        </span>
      ) : null}
      <div className="flex-1 min-w-0 text-left">
        <p className={danger ? 'text-[17px] text-red-400' : typoHeadlineClass}>{label}</p>
        {description ? <p className={`${typoSubheadClass} mt-0.5 leading-snug`}>{description}</p> : null}
      </div>
      {value ? <span className={typoSubheadClass}>{value}</span> : null}
      {trailing === undefined ? (
        <IconChevronRight size={18} className="text-white/35 shrink-0" stroke={1.75} />
      ) : (
        trailing
      )}
    </button>
  )
}

export function SettingsListRow({ label, value, onClick, children }) {
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={`${settingsRowClass} disabled:opacity-40`}>
        {children}
        <div className="flex-1 min-w-0 text-left">
          <p className={typoHeadlineClass}>{label}</p>
        </div>
        {value ? <span className={typoSubheadClass}>{value}</span> : null}
        <IconChevronRight size={18} className="text-white/35 shrink-0" stroke={1.75} />
      </button>
    )
  }

  return (
    <div className={`${settingsRowClass} cursor-default hover:bg-transparent active:bg-transparent`}>
      {children}
      <div className="flex-1 min-w-0">
        <p className={typoHeadlineClass}>{label}</p>
      </div>
      {value ? <span className={typoSubheadClass}>{value}</span> : null}
    </div>
  )
}

export function RoleOptionButton({ label, selected, onClick, disabled }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`flex-1 py-2.5 text-[15px] font-medium rounded-xl transition-colors disabled:opacity-40 ${
        selected ? 'bg-blue-500 text-white' : 'text-white/70 hover:bg-white/[0.06]'
      }`}
    >
      {label}
    </button>
  )
}
