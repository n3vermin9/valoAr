import { useEffect, useState } from 'react'
import { subscribeStoryExists } from '../../services/storyService'
import { getStoryReplyQuoteColorClass, getStoryReplySnippet } from '../../utils/storyHelpers'

export default function StoryReplyQuote({ storyReply, onClick, className = '' }) {
  const [storyExists, setStoryExists] = useState(null)

  useEffect(() => {
    if (!storyReply?.storyId || !storyReply?.ownerId) {
      setStoryExists(null)
      return
    }
    return subscribeStoryExists(storyReply.ownerId, storyReply.storyId, setStoryExists)
  }, [storyReply?.storyId, storyReply?.ownerId])

  if (!storyReply) return null

  const removed = storyExists === false
  const snippet = removed ? 'story removed' : getStoryReplySnippet(storyReply.text)
  const colorClass = getStoryReplyQuoteColorClass(storyReply.color)
  const label = storyReply.ownerUsername ? `${storyReply.ownerUsername}'s story` : 'Story'
  const canOpen = Boolean(onClick && storyReply.ownerId && storyExists === true)

  const content = (
    <>
      <p className="text-[11px] font-semibold truncate mb-1 text-white/80">{label}</p>
      <p
        className={`text-xs leading-snug line-clamp-3 whitespace-pre-wrap break-words ${
          removed ? 'text-white/60 italic' : 'text-white/95'
        }`}
      >
        {snippet}
      </p>
    </>
  )

  const boxClass = `rounded-lg px-2.5 py-2 border border-white/10 ${colorClass} ${
    canOpen ? 'hover:brightness-110 active:brightness-95 transition-[filter] cursor-pointer' : ''
  }`

  return (
    <div className={`mb-2 min-w-0 ${className}`}>
      {canOpen ? (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onClick(storyReply)
          }}
          className={`w-full text-left ${boxClass}`}
          aria-label={`Open ${label}`}
        >
          {content}
        </button>
      ) : (
        <div className={boxClass}>{content}</div>
      )}
    </div>
  )
}
