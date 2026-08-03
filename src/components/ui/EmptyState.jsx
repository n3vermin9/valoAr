import { ICON_TONE_CLASSES, iconTileClass, typoSubheadClass } from '../../utils/designSystem'

/**
 * Empty list / panel placeholder.
 * Prefer title + description; `message` kept for older call sites.
 */
export default function EmptyState({
  message = 'Nothing here yet',
  title,
  description,
  icon: Icon,
  iconTone = 'blue',
  className = '',
}) {
  const heading = title || null
  const body = description || (!title ? message : null)
  const toneClass = ICON_TONE_CLASSES[iconTone] || ICON_TONE_CLASSES.blue

  return (
    <div
      className={`flex w-full max-w-full flex-col items-center justify-center px-6 py-8 ${className}`}
    >
      {Icon ? (
        <span className={`${iconTileClass} w-12 h-12 rounded-[14px] mb-3 ${toneClass}`}>
          <Icon size={24} stroke={1.75} />
        </span>
      ) : null}
      {heading ? (
        <p className="text-[17px] font-medium text-[var(--ios-label)] text-center">{heading}</p>
      ) : null}
      {body ? (
        <p
          className={`${typoSubheadClass} w-full max-w-[17.5rem] text-center leading-snug break-words ${
            heading ? 'mt-1' : ''
          }`}
        >
          {body}
        </p>
      ) : null}
    </div>
  )
}
