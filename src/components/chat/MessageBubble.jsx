import { useRef, useState } from 'react'
import { IconArrowBackUp, IconCheck, IconChecks } from '@tabler/icons-react'
import { formatMessageTime } from '../../utils/helpers'
import VoiceMessagePlayer from './VoiceMessagePlayer'
import ReplyQuote from './ReplyQuote'
import StoryReplyQuote from './StoryReplyQuote'
import MessageReactions from './MessageReactions'
import MessageText from './MessageText'
import { getStoryReplyDisplay } from '../../utils/storyHelpers'

const SWIPE_REPLY_THRESHOLD = 56

export default function MessageBubble({
  message,
  isOwn,
  currentUserId,
  onContextMenu,
  onLongPress,
  onReply,
  onReplyQuoteClick,
  onStoryReplyClick,
  onReactionClick,
  onMentionClick,
  replyAuthorName,
  senderName,
  highlighted = false,
  militaryTime = false,
  searchActive = false,
  searchQuery = '',
  activeSearchMatch = null,
}) {
  const bubbleRef = useRef(null)
  const touchStartRef = useRef({ x: 0, y: 0 })
  const swipingRef = useRef(false)
  const pressTimerRef = useRef(null)
  const [swipeOffset, setSwipeOffset] = useState(0)

  const getRect = () => bubbleRef.current?.getBoundingClientRect()

  const handleContextMenu = (e) => {
    e.preventDefault()
    onContextMenu?.(message, getRect())
  }

  const clearPressTimer = () => {
    if (pressTimerRef.current) {
      clearTimeout(pressTimerRef.current)
      pressTimerRef.current = null
    }
  }

  const handleTouchStart = (e) => {
    const touch = e.touches[0]
    touchStartRef.current = { x: touch.clientX, y: touch.clientY }
    swipingRef.current = false
    setSwipeOffset(0)
    clearPressTimer()
    pressTimerRef.current = setTimeout(() => onLongPress?.(message, getRect()), 500)
  }

  const handleTouchMove = (e) => {
    const touch = e.touches[0]
    const dx = touch.clientX - touchStartRef.current.x
    const dy = touch.clientY - touchStartRef.current.y
    const horizontal = isOwn ? dx < -8 : dx > 8

    if (horizontal && Math.abs(dx) > Math.abs(dy) * 1.2) {
      swipingRef.current = true
      clearPressTimer()
      const clamped = isOwn ? Math.max(dx, -72) : Math.min(dx, 72)
      setSwipeOffset(clamped)
    }
  }

  const handleTouchEnd = (e) => {
    clearPressTimer()
    const dx = e.changedTouches[0].clientX - touchStartRef.current.x
    const triggered = isOwn ? dx <= -SWIPE_REPLY_THRESHOLD : dx >= SWIPE_REPLY_THRESHOLD
    if (swipingRef.current && triggered) {
      onReply?.(message)
    }
    swipingRef.current = false
    setSwipeOffset(0)
  }

  const handleTouchCancel = () => {
    clearPressTimer()
    swipingRef.current = false
    setSwipeOffset(0)
  }

  const handleDoubleClick = (e) => {
    if (e.target.closest('button, audio, img')) return
    e.preventDefault()
    onReply?.(message)
  }

  const sentTime = formatMessageTime(message.createdAt, militaryTime)
  const hasReactions = message.reactions && Object.keys(message.reactions).length > 0
  const { storyReply, text: displayText } = getStoryReplyDisplay(message)
  const bubbleRadius = isOwn
    ? 'rounded-[1.125rem] rounded-br-[0.25rem]'
    : 'rounded-[1.125rem] rounded-bl-[0.25rem]'

  const bubbleSurfaceClass = `${
    isOwn
      ? searchActive ? 'bg-blue-400' : 'bg-blue-500'
      : searchActive ? 'bg-white/[0.18]' : 'bg-white/10'
  } ${highlighted && !searchActive ? 'message-bubble-flash' : ''}`

  const renderBubbleContent = () => (
    <>
      {message.replyTo && (
        <ReplyQuote
          reply={message.replyTo}
          authorName={replyAuthorName}
          isOwn={isOwn}
          onClick={
            onReplyQuoteClick && message.replyTo.id
              ? () => onReplyQuoteClick(message.replyTo.id)
              : undefined
          }
        />
      )}
      {displayText && (
        <MessageText
          text={displayText}
          isOwn={isOwn}
          onMentionClick={onMentionClick}
          searchQuery={searchQuery}
          activeSearchMatch={activeSearchMatch}
          className="text-sm break-words"
        />
      )}
      {message.audioUrl && <VoiceMessagePlayer src={message.audioUrl} isOwn={isOwn} />}
      {message.imageUrl && (
        <img
          src={message.imageUrl}
          alt=""
          className="rounded-xl max-w-full mb-1 cursor-pointer"
          onClick={() => message.onImageClick?.(message.imageUrl)}
          onDoubleClick={(e) => e.stopPropagation()}
        />
      )}
    </>
  )

  const hasMessageBubble =
    displayText || message.replyTo || message.audioUrl || message.imageUrl

  return (
    <div
      className={`flex ${isOwn ? 'justify-end' : 'justify-start'} mb-2`}
      data-message-id={message.id}
    >
      <div className="relative max-w-[75%]">
        {Math.abs(swipeOffset) > 12 && (
          <div
            className={`absolute top-1/2 -translate-y-1/2 flex items-center justify-center w-8 h-8 rounded-full bg-white/10 text-white/70 pointer-events-none ${
              isOwn ? 'left-full ml-2' : 'right-full mr-2'
            }`}
            style={{ opacity: Math.min(Math.abs(swipeOffset) / SWIPE_REPLY_THRESHOLD, 1) }}
          >
            <IconArrowBackUp size={16} />
          </div>
        )}

        <div
          style={{ transform: swipeOffset ? `translateX(${swipeOffset}px)` : undefined }}
          className="transition-transform duration-75"
        >
          <div className={`flex flex-col gap-1.5 ${isOwn ? 'items-end' : 'items-start'}`}>
            {!isOwn && senderName && (
              <p className="text-[11px] font-medium text-blue-300/90 px-1">{senderName}</p>
            )}
            {storyReply && (
              <StoryReplyQuote
                storyReply={storyReply}
                onClick={onStoryReplyClick}
                isOwn={isOwn}
                stacked={Boolean(displayText)}
              />
            )}
            {hasMessageBubble && (
              <div
                ref={bubbleRef}
                onContextMenu={handleContextMenu}
                onDoubleClick={handleDoubleClick}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
                onTouchCancel={handleTouchCancel}
                className={`px-4 py-2 transition-colors duration-200 message-bubble w-fit max-w-full ${bubbleRadius} ${bubbleSurfaceClass}`}
                data-allow-contextmenu
              >
                {renderBubbleContent()}
              </div>
            )}
          </div>

          {hasReactions && (
            <MessageReactions
              reactions={message.reactions}
              isOwn={isOwn}
              currentUserId={currentUserId}
              onEmojiClick={onReactionClick ? (emoji) => onReactionClick(message, emoji) : undefined}
              className={`mt-1 flex ${isOwn ? 'justify-end' : 'justify-start'}`}
            />
          )}

          {(sentTime || isOwn) && (
            <div className="flex items-center justify-between gap-3 mt-1 px-1 min-h-[16px]">
              {sentTime ? (
                <span className="text-[11px] text-white/40 tabular-nums">{sentTime}</span>
              ) : (
                <span />
              )}
              {isOwn && (
                <span className="inline-flex shrink-0">
                  {message.read ? (
                    <IconChecks size={14} className="text-blue-400" stroke={2} />
                  ) : (
                    <IconCheck size={14} className="text-white/40" stroke={2} />
                  )}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
