import { memo, useEffect, useRef, useState } from 'react'
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
import { chatBubblePadClass, chatMessageTextClass } from '../../utils/designSystem'
import { sad } from '../../assets'

const SWIPE_REPLY_THRESHOLD = 56
/** Finger movement past this cancels long-press (scroll / swipe, not a hold). */
const PRESS_MOVE_CANCEL_PX = 8
const LONG_PRESS_MS = 450
const PRESS_SCALE_MS = 140

function BubbleMeta({ sentTime, isOwn, read, tone = 'own' }) {
  if (!sentTime && !isOwn) return null

  return (
    <span
      className={`inline-flex items-center gap-0.5 shrink-0 select-none leading-none ${
        tone === 'own' ? 'text-white/65' : 'text-[var(--chat-meta)]'
      }`}
    >
      {sentTime && <span className="text-[11px] tabular-nums whitespace-nowrap">{sentTime}</span>}
      {isOwn && (
        <span className="inline-flex shrink-0">
          {read ? (
            <IconChecks size={15} className="text-blue-200" stroke={2} />
          ) : (
            <IconCheck size={15} className="text-white/50" stroke={2} />
          )}
        </span>
      )}
    </span>
  )
}

function TextWithCornerMeta({ children, meta, isOwn = false, fill = false }) {
  if (!meta) return children

  // Inline end-spacer: last line leaves room for the timestamp. Unlike always-on
  // padding, short words can stay on one line while long strings still wrap
  // inside max-w-full (overflow-wrap on MessageText).
  const metaSlot = isOwn ? 'w-[3.25rem]' : 'w-[2.6rem]'

  return (
    <div className={`relative max-w-full min-w-0 ${fill ? 'w-full' : 'w-fit'}`}>
      {children}
      <span className={`inline-block ${metaSlot} align-bottom`} aria-hidden>
        {'\u00a0'}
      </span>
      <span className="absolute bottom-0 right-0 flex items-center leading-none select-none pointer-events-none">
        {meta}
      </span>
    </div>
  )
}

export default memo(function MessageBubble({
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
  onImageClick,
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
  militaryTime = true,
  searchActive = false,
  searchQuery = '',
  activeSearchMatch = null,
  readOnly = false,
  actionHidden = false,
  overlayClone = false,
  actionOverlay = false,
}) {
  const bubbleRef = useRef(null)
  const touchStartRef = useRef({ x: 0, y: 0 })
  const swipingRef = useRef(false)
  const pressArmedRef = useRef(false)
  const pressTimerRef = useRef(null)
  const pressScaleTimerRef = useRef(null)
  const messageRef = useRef(message)
  const onReplyRef = useRef(onReply)
  const onLongPressRef = useRef(onLongPress)
  const [swipeOffset, setSwipeOffset] = useState(0)
  const [pressing, setPressing] = useState(false)

  useEffect(() => {
    messageRef.current = message
    onReplyRef.current = onReply
    onLongPressRef.current = onLongPress
  })

  const getRect = () => bubbleRef.current?.getBoundingClientRect()

  const handleContextMenu = (e) => {
    if (readOnly) return
    e.preventDefault()
    e.stopPropagation()
    onContextMenu?.(message, getRect())
  }

  const clearPressTimer = () => {
    if (pressTimerRef.current) {
      clearTimeout(pressTimerRef.current)
      pressTimerRef.current = null
    }
    if (pressScaleTimerRef.current) {
      clearTimeout(pressScaleTimerRef.current)
      pressScaleTimerRef.current = null
    }
  }

  // Non-passive touchmove so we can preventDefault and stop the messages
  // scroller / WKWebView from panning the whole thread horizontally.
  useEffect(() => {
    if (readOnly) return undefined
    const el = bubbleRef.current
    if (!el) return undefined

    const cancelPress = () => {
      pressArmedRef.current = false
      clearPressTimer()
      setPressing(false)
    }

    const onTouchStart = (e) => {
      const touch = e.touches[0]
      touchStartRef.current = { x: touch.clientX, y: touch.clientY }
      swipingRef.current = false
      pressArmedRef.current = true
      setSwipeOffset(0)
      clearPressTimer()
      pressScaleTimerRef.current = setTimeout(() => {
        if (pressArmedRef.current) setPressing(true)
      }, PRESS_SCALE_MS)
      pressTimerRef.current = setTimeout(() => {
        if (!pressArmedRef.current) return
        pressArmedRef.current = false
        setPressing(false)
        onLongPressRef.current?.(messageRef.current, el.getBoundingClientRect())
      }, LONG_PRESS_MS)
    }

    const onTouchMove = (e) => {
      const touch = e.touches[0]
      const dx = touch.clientX - touchStartRef.current.x
      const dy = touch.clientY - touchStartRef.current.y
      const absDx = Math.abs(dx)
      const absDy = Math.abs(dy)
      const horizontal = isOwn ? dx < -8 : dx > 8

      // Any real movement = scroll or swipe, not a hold — cancel the context menu.
      if (pressArmedRef.current && (absDx > PRESS_MOVE_CANCEL_PX || absDy > PRESS_MOVE_CANCEL_PX)) {
        cancelPress()
      }

      if (horizontal && absDx > absDy * 1.2) {
        swipingRef.current = true
        cancelPress()
        const clamped = isOwn ? Math.max(dx, -72) : Math.min(dx, 72)
        setSwipeOffset(clamped)
        // Keep the gesture on this bubble — don't scroll/pan the chat list.
        e.preventDefault()
        e.stopPropagation()
      } else if (swipingRef.current) {
        e.preventDefault()
        e.stopPropagation()
      }
    }

    const onTouchEnd = (e) => {
      cancelPress()
      const dx = e.changedTouches[0].clientX - touchStartRef.current.x
      const triggered = isOwn ? dx <= -SWIPE_REPLY_THRESHOLD : dx >= SWIPE_REPLY_THRESHOLD
      if (swipingRef.current && triggered) {
        onReplyRef.current?.(messageRef.current)
      }
      swipingRef.current = false
      setSwipeOffset(0)
    }

    const onTouchCancel = () => {
      cancelPress()
      swipingRef.current = false
      setSwipeOffset(0)
    }

    el.addEventListener('touchstart', onTouchStart, { passive: true })
    el.addEventListener('touchmove', onTouchMove, { passive: false })
    el.addEventListener('touchend', onTouchEnd, { passive: true })
    el.addEventListener('touchcancel', onTouchCancel, { passive: true })

    return () => {
      clearPressTimer()
      el.removeEventListener('touchstart', onTouchStart)
      el.removeEventListener('touchmove', onTouchMove)
      el.removeEventListener('touchend', onTouchEnd)
      el.removeEventListener('touchcancel', onTouchCancel)
    }
  }, [readOnly, isOwn])

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
    ? 'rounded-[var(--chat-bubble-radius)] rounded-br-[0.3rem]'
    : 'rounded-[var(--chat-bubble-radius)] rounded-bl-[0.3rem]'

  const bubbleSurfaceClass = `${
    isOwn
      ? searchActive ? 'bg-blue-400' : 'bg-blue-500'
      : searchActive ? 'bg-[var(--ios-bg-tertiary)] brightness-110' : 'bg-[var(--ios-bg-tertiary)]'
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
            className="text-xs font-semibold text-[var(--chat-accent)] min-w-0"
            badgeSize={12}
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
        <TextWithCornerMeta meta={meta} isOwn={isOwn} fill={showSenderNameInBubble}>
          <MessageText
            text={displayText}
            isOwn={isOwn}
            onMentionClick={onMentionClick}
            onContextMenu={readOnly ? undefined : handleContextMenu}
            searchQuery={searchQuery}
            activeSearchMatch={activeSearchMatch}
            className={chatMessageTextClass}
          />
        </TextWithCornerMeta>
      )}
      {message.audioUrl && (
        <div className={`flex ${isOwn ? 'flex-wrap items-end gap-x-2 gap-y-0' : 'flex-col items-end gap-1'}`}>
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
            onClick={(e) =>
              onImageClick?.(
                message.imageUrl,
                e.currentTarget.getBoundingClientRect()
              )
            }
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
      style={{
        transform: [
          swipeOffset ? `translateX(${swipeOffset}px)` : null,
          pressing ? 'scale(0.97)' : null,
        ]
          .filter(Boolean)
          .join(' ') || undefined,
      }}
      className={`transition-transform duration-100 ease-out min-w-0 origin-center ${
        swipeOffset || pressing ? 'will-change-transform' : ''
      }`}
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
          <div className={`relative w-fit max-w-full min-w-0 ${hasReactions ? 'pb-3' : ''}`}>
            <div
              ref={bubbleRef}
              onContextMenu={readOnly ? undefined : handleContextMenu}
              onDoubleClick={readOnly ? undefined : handleDoubleClick}
              className={`${chatBubblePadClass} transition-colors duration-200 message-bubble w-fit max-w-full min-w-0 touch-pan-y ${actionOverlay ? 'message-bubble-action' : ''} ${bubbleRadius} ${bubbleSurfaceClass}`}
              data-allow-contextmenu={readOnly ? undefined : true}
            >
              {renderBubbleContent()}
            </div>
            {hasReactions && (
              <MessageReactions
                reactions={message.reactions}
                isOwn={isOwn}
                currentUserId={currentUserId}
                onEmojiClick={
                  !readOnly && onReactionClick
                    ? (emoji) => onReactionClick(message, emoji)
                    : undefined
                }
                className={`absolute z-[1] bottom-0 ${isOwn ? 'right-1' : 'left-1'}`}
              />
            )}
          </div>
        )}
      </div>
    </div>
  )

  const rowClass = `flex ${isOwn ? 'justify-end' : 'justify-start'} ${tightBottom ? 'mb-1' : 'mb-2.5'}`

  if (overlayClone) {
    return (
      <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'} w-full`}>
        {bubbleBlock}
      </div>
    )
  }

  if (!isOwn && isGroupChat) {
    return (
      <div className={`${rowClass} ${actionHidden ? 'invisible' : ''}`} data-message-id={message.id}>
        <div className="flex items-end gap-2.5 max-w-[88%] min-w-0">
          <div className="w-9 shrink-0 flex justify-center">
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
                  size={36}
                  alt=""
                  className="w-9 h-9 rounded-full object-cover"
                />
              </button>
            ) : (
              <span className="w-9 h-9" aria-hidden />
            )}
          </div>
          <div className="relative min-w-0 flex-1">
            {Math.abs(swipeOffset) > 12 && (
              <div
                className="absolute top-1/2 -translate-y-1/2 right-full mr-2 flex items-center justify-center w-9 h-9 rounded-full bg-[var(--ios-fill)] text-[var(--ios-label-secondary)] pointer-events-none"
                style={{ opacity: Math.min(Math.abs(swipeOffset) / SWIPE_REPLY_THRESHOLD, 1) }}
              >
                <IconArrowBackUp size={18} />
              </div>
            )}
            {bubbleBlock}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={`${rowClass} ${actionHidden ? 'invisible' : ''}`} data-message-id={message.id}>
      <div className="relative max-w-[78%] min-w-0">
        {Math.abs(swipeOffset) > 12 && (
          <div
            className={`absolute top-1/2 -translate-y-1/2 flex items-center justify-center w-9 h-9 rounded-full bg-[var(--ios-fill)] text-[var(--ios-label-secondary)] pointer-events-none ${
              isOwn ? 'left-full ml-2' : 'right-full mr-2'
            }`}
            style={{ opacity: Math.min(Math.abs(swipeOffset) / SWIPE_REPLY_THRESHOLD, 1) }}
          >
            <IconArrowBackUp size={18} />
          </div>
        )}
        {bubbleBlock}
      </div>
    </div>
  )
})
