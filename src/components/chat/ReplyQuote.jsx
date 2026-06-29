import { getMessagePreviewText } from '../../utils/helpers'

import UsernameLabel from '../ui/UsernameLabel'

export default function ReplyQuote({ reply, authorName, isOwn, onClick, className = '' }) {
  if (!reply) return null

  const preview = getMessagePreviewText(reply)
  const borderClass = isOwn ? 'border-white/50' : 'border-blue-400'
  const authorClass = isOwn ? 'text-white/90' : 'text-blue-300'
  const previewClass = isOwn ? 'text-white/65' : 'text-white/55'

  const content = (
    <>
      <UsernameLabel
        username={authorName}
        className={`text-xs font-semibold truncate ${authorClass}`}
        badgeSize={10}
        as="p"
      />
      <p className={`text-xs truncate ${previewClass}`}>{preview}</p>
    </>
  )

  const baseClass = `block border-l-2 ${borderClass} pl-2.5 py-0.5 mb-1.5 text-left w-full min-w-0 ${className}`

  if (onClick) {
    return (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation()
          onClick()
        }}
        className={`${baseClass} hover:opacity-80 transition-opacity`}
      >
        {content}
      </button>
    )
  }

  return <div className={baseClass}>{content}</div>
}
