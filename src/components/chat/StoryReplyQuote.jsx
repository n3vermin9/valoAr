import { useEffect, useState } from 'react'
import { subscribeStoryExists } from '../../services/storyService'
import { getStoryReplyQuoteColorClass, getStoryReplySnippet } from '../../utils/storyHelpers'

export default function StoryReplyQuote({ storyReply, onClick, className = '' }) {
  const hasStoryTarget = Boolean(storyReply?.storyId && storyReply?.ownerId)
  const storyTargetKey = hasStoryTarget ? `${storyReply.ownerId}:${storyReply.storyId}` : ''
  const [trackedStoryTargetKey, setTrackedStoryTargetKey] = useState('')
  const [subscribedExists, setSubscribedExists] = useState(null)

  if (storyTargetKey !== trackedStoryTargetKey) {
    setTrackedStoryTargetKey(storyTargetKey)
    setSubscribedExists(null)
  }

  useEffect(() => {
    if (!hasStoryTarget) return
    return subscribeStoryExists(storyReply.ownerId, storyReply.storyId, setSubscribedExists)
  }, [hasStoryTarget, storyReply?.ownerId, storyReply?.storyId])

  const storyExists = hasStoryTarget ? subscribedExists : null

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

  const boxClass = `relative overflow-hidden rounded-lg px-2.5 py-2 border border-white/10 ${colorClass} ${
    canOpen ? 'hover:brightness-110 active:brightness-95 transition-[filter] cursor-pointer' : ''
  }`

  const quoteBody = (
    <>
      <span
        className="story-reply-notes-pattern absolute inset-0 rounded-[inherit] pointer-events-none"
        aria-hidden
      />
      <span className="relative z-[1] block min-w-0">{content}</span>
    </>
  )

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
          {quoteBody}
        </button>
      ) : (
        <div className={boxClass}>{quoteBody}</div>
      )}
    </div>
  )
}
