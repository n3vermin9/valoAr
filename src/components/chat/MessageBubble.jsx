import { useRef, useState } from 'react'
import { IconArrowBackUp, IconCheck, IconChecks } from '@tabler/icons-react'
import { formatMessageTime } from '../../utils/helpers'
import VoiceMessagePlayer from './VoiceMessagePlayer'
import ReplyQuote from './ReplyQuote'
import StoryReplyQuote from './StoryReplyQuote'
import MessageReactions from './MessageReactions'
import MessageText from './MessageText'
import CachedAvatar from '../ui/CachedAvatar'
import UsernameLabel from '../ui/UsernameLabel'
import GroupRoleBadge from './GroupRoleBadge'
import { getStoryReplyDisplay } from '../../utils/storyHelpers'
import { sad } from '../../assets'

const SWIPE_REPLY_THRESHOLD = 56

function BubbleMeta({ sentTime, isOwn, read, tone = 'own' }) {
  if (!sentTime && !isOwn) return null

  return (
    <span
      className={`inline-flex items-center gap-0.5 shrink-0 self-end select-none leading-none ${
        tone === 'own' ? 'text-white/65' : 'text-white/45'
      }`}
    >
      {sentTime && <span className="text-[10px] tabular-nums">{sentTime}</span>}
      {isOwn && (
        <span className="inline-flex shrink-0">
          {read ? (
            <IconChecks size={13} className="text-blue-200" stroke={2} />
          ) : (
            <IconCheck size={13} className="text-white/50" stroke={2} />
          )}
        </span>
      )}
    </span>
  )
}

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
  senderId,
  senderRole,
  groupChat,
  senderAvatar,
  onSenderClick,
  isGroupChat = false,
  showAvatar = false,
  showSenderNameInBubble = false,
  tightBottom = false,
  highlighted = false,
  militaryTime = false,
  searchActive = false,
  searchQuery = '',
  activeSearchMatch = null,
  readOnly = false,
}) {
  const bubbleRef = useRef(null)
  const touchStartRef = useRef({ x: 0, y: 0 })
  const swipingRef = useRef(false)
  const pressTimerRef = useRef(null)
  const [swipeOffset, setSwipeOffset] = useState(0)

  const getRect = () => bubbleRef.current?.getBoundingClientRect()

  const handleContextMenu = (e) => {
    if (readOnly) return
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
    if (readOnly) return
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
    if (readOnly) return
    if (e.target.closest('button, audio, img')) return
    e.preventDefault()
    onReply?.(message)
  }

  const sentTime = formatMessageTime(message.createdAt || message.clientCreatedAt, militaryTime)
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

  const metaTone = isOwn ? 'own' : 'other'
  const meta = (sentTime || isOwn) && (
    <BubbleMeta sentTime={sentTime} isOwn={isOwn} read={message.read} tone={metaTone} />
  )

  const renderBubbleContent = () => (
    <>
      {showSenderNameInBubble && senderName && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            if (senderId) onSenderClick?.(senderId)
          }}
          onDoubleClick={(e) => e.stopPropagation()}
          className="flex items-center justify-between gap-2 w-full mb-1 hover:opacity-90 transition-opacity text-left min-w-0"
        >
          <UsernameLabel
            username={senderName}
            className="text-[11px] font-semibold text-blue-300/90 min-w-0"
            badgeSize={11}
            as="span"
          />
          {groupChat && senderId ? (
            <GroupRoleBadge chat={groupChat} userId={senderId} />
          ) : senderRole && senderRole !== 'member' ? (
            <GroupRoleBadge role={senderRole} />
          ) : null}
        </button>
      )}
      {message.replyTo && (
        <ReplyQuote
          reply={message.replyTo}
          authorName={replyAuthorName}
          isOwn={isOwn}
          onClick={
            !readOnly && onReplyQuoteClick && message.replyTo.id
              ? () => onReplyQuoteClick(message.replyTo.id)
              : undefined
          }
        />
      )}
      {displayText && (
        <div className="flex flex-wrap items-end gap-x-2 gap-y-0">
          <MessageText
            text={displayText}
            isOwn={isOwn}
            onMentionClick={onMentionClick}
            searchQuery={searchQuery}
            activeSearchMatch={activeSearchMatch}
            className="text-sm break-words min-w-0"
          />
          {meta}
        </div>
      )}
      {message.audioUrl && (
        <div className="flex flex-wrap items-end gap-x-2 gap-y-0">
          <VoiceMessagePlayer src={message.audioUrl} isOwn={isOwn} />
          {!displayText && meta}
        </div>
      )}
      {message.imageUrl && (
        <div className="flex flex-col items-end gap-1">
          <img
            src={message.imageUrl}
            alt=""
            className="rounded-xl max-w-full cursor-pointer"
            onClick={() => message.onImageClick?.(message.imageUrl)}
            onDoubleClick={(e) => e.stopPropagation()}
          />
          {!displayText && !message.audioUrl && meta}
        </div>
      )}
      {!displayText && !message.audioUrl && !message.imageUrl && message.replyTo && meta}
    </>
  )

  const hasMessageBubble =
    displayText || message.replyTo || message.audioUrl || message.imageUrl

  const bubbleBlock = (
    <div
      style={{ transform: swipeOffset ? `translateX(${swipeOffset}px)` : undefined }}
      className="transition-transform duration-75 min-w-0"
    >
      <div className={`flex flex-col gap-1.5 ${isOwn ? 'items-end' : 'items-start'}`}>
        {storyReply && (
          <StoryReplyQuote
            storyReply={storyReply}
            onClick={readOnly ? undefined : onStoryReplyClick}
            isOwn={isOwn}
            stacked={Boolean(displayText)}
          />
        )}
        {hasMessageBubble && (
          <div
            ref={bubbleRef}
            onContextMenu={readOnly ? undefined : handleContextMenu}
            onDoubleClick={readOnly ? undefined : handleDoubleClick}
            onTouchStart={readOnly ? undefined : handleTouchStart}
            onTouchMove={readOnly ? undefined : handleTouchMove}
            onTouchEnd={readOnly ? undefined : handleTouchEnd}
            onTouchCancel={readOnly ? undefined : handleTouchCancel}
            className={`px-3 py-1.5 transition-colors duration-200 message-bubble w-fit max-w-full ${bubbleRadius} ${bubbleSurfaceClass}`}
            data-allow-contextmenu={readOnly ? undefined : true}
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
          onEmojiClick={!readOnly && onReactionClick ? (emoji) => onReactionClick(message, emoji) : undefined}
          className={`mt-1 flex ${isOwn ? 'justify-end' : 'justify-start'}`}
        />
      )}
    </div>
  )

  const rowClass = `flex ${isOwn ? 'justify-end' : 'justify-start'} ${tightBottom ? 'mb-0.5' : 'mb-2'}`

  if (!isOwn && isGroupChat) {
    return (
      <div className={rowClass} data-message-id={message.id}>
        <div className="flex items-end gap-2 max-w-[85%] min-w-0">
          <div className="w-8 shrink-0 flex justify-center">
            {showAvatar ? (
              <button
                type="button"
                onClick={() => onSenderClick?.(senderId)}
                className="rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60"
                aria-label="View profile"
              >
                <CachedAvatar
                  src={senderAvatar}
                  fallback={sad}
                  size={32}
                  alt=""
                  className="w-8 h-8 rounded-full object-cover"
                />
              </button>
            ) : (
              <span className="w-8 h-8" aria-hidden />
            )}
          </div>
          <div className="relative min-w-0 flex-1">
            {Math.abs(swipeOffset) > 12 && (
              <div
                className="absolute top-1/2 -translate-y-1/2 right-full mr-2 flex items-center justify-center w-8 h-8 rounded-full bg-white/10 text-white/70 pointer-events-none"
                style={{ opacity: Math.min(Math.abs(swipeOffset) / SWIPE_REPLY_THRESHOLD, 1) }}
              >
                <IconArrowBackUp size={16} />
              </div>
            )}
            {bubbleBlock}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={rowClass} data-message-id={message.id}>
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
        {bubbleBlock}
      </div>
    </div>
  )
}
