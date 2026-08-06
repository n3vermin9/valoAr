import { forwardRef, useRef, useLayoutEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { IconArrowBackUp, IconCopy, IconTrash, IconPin } from '@tabler/icons-react'
import { getStoryReplyDisplay } from '../../utils/storyHelpers'
import {
  dropdownMenuClass,
  dropdownMenuItemWithIconClass,
  dropdownMenuItemWithIconDangerClass,
} from '../../utils/designSystem'
import MessageBubble from './MessageBubble'
import { ReactionPicker } from './MessageReactions'

const contextMenuSurfaceClass =
  'border border-[var(--ios-hairline)] bg-[var(--ios-bg-elevated)] shadow-[var(--ios-glass-shadow-modal)]'

const VIEWPORT_PADDING = 16
const MENU_GAP = 12
const MENU_EASE = [0.32, 0.72, 0, 1]

function clampHorizontal(left, width) {
  const maxLeft = window.innerWidth - VIEWPORT_PADDING - width
  return Math.max(VIEWPORT_PADDING, Math.min(left, maxLeft))
}

const MessageActionOverlay = forwardRef(function MessageActionOverlay(
  {
    message,
    originRect,
    isOwn,
    canDelete = false,
    canPin = false,
    isPinned = false,
    currentUserId,
    onDelete,
    onCopy,
    onReply,
    onReact,
    onPin,
    onUnpin,
    onMentionClick,
    onCancel,
    replyAuthorName,
    militaryTime = true,
    isGroupChat = false,
    senderName,
    senderRole,
    groupChat,
    senderId,
    senderAvatar,
    showSenderNameInBubble = false,
    showAvatar = false,
    tightBottom = false,
  },
  ref
) {
  const [deleting, setDeleting] = useState(false)
  const bubbleWrapRef = useRef(null)
  const menuRef = useRef(null)

  const panelWidth = Math.max(originRect.width, 240)
  const { text: displayText } = getStoryReplyDisplay(message)
  const canCopy = Boolean(displayText || message.imageUrl)

  // Match list max width — do NOT pin to originRect.width (subpixels / overflow
  // gutters shrink the clone and wrap short words like "what").
  const bubbleMaxWidth = Math.min(window.innerWidth * 0.78, window.innerWidth - VIEWPORT_PADDING * 2)

  const bubbleStyle = isOwn
    ? {
        top: originRect.top,
        right: Math.max(VIEWPORT_PADDING, window.innerWidth - originRect.right),
        maxWidth: bubbleMaxWidth,
        willChange: 'top',
      }
    : {
        top: originRect.top,
        left: Math.min(
          clampHorizontal(originRect.left, originRect.width),
          window.innerWidth - VIEWPORT_PADDING - 80
        ),
        maxWidth: bubbleMaxWidth,
        willChange: 'top',
      }

  const menuStyle = isOwn
    ? {
        top: originRect.bottom + MENU_GAP,
        right: Math.max(VIEWPORT_PADDING, window.innerWidth - originRect.right),
        width: panelWidth,
        willChange: 'transform, top',
      }
    : {
        top: originRect.bottom + MENU_GAP,
        left: clampHorizontal(originRect.left, panelWidth),
        width: panelWidth,
        willChange: 'transform, top',
      }

  // Fit once via direct DOM writes — avoids a React state bounce / second paint.
  useLayoutEffect(() => {
    const wrap = bubbleWrapRef.current
    const menu = menuRef.current
    if (!menu) return undefined

    const fitLayout = () => {
      const menuHeight = menu.offsetHeight
      const maxMenuTop = window.innerHeight - VIEWPORT_PADDING - menuHeight

      let nextBubbleTop = originRect.top
      let wrapHeight = wrap?.offsetHeight ?? originRect.height

      if (wrap) {
        wrapHeight = wrap.offsetHeight
        const maxBubbleBottom = maxMenuTop - MENU_GAP
        if (nextBubbleTop + wrapHeight > maxBubbleBottom) {
          nextBubbleTop = Math.max(VIEWPORT_PADDING, maxBubbleBottom - wrapHeight)
        }
        wrap.style.top = `${nextBubbleTop}px`
      }

      const bubbleBottom = nextBubbleTop + wrapHeight
      const preferredMenuTop = bubbleBottom + MENU_GAP
      menu.style.top = `${Math.max(VIEWPORT_PADDING, Math.min(preferredMenuTop, maxMenuTop))}px`
    }

    fitLayout()
    window.addEventListener('resize', fitLayout)
    return () => window.removeEventListener('resize', fitLayout)
  }, [
    originRect.top,
    originRect.height,
    originRect.bottom,
    originRect.left,
    originRect.right,
    originRect.width,
    deleting,
    canCopy,
    canDelete,
    message.id,
  ])

  const handleReact = (emoji) => {
    onCancel()
    onReact(message, emoji)
  }

  const runAndClose = (action) => {
    onCancel()
    action?.()
  }

  return (
    <motion.div
      ref={ref}
      className="fixed inset-0 z-50"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.14, ease: MENU_EASE } }}
      transition={{ duration: 0.14, ease: MENU_EASE }}
    >
      <div
        className="absolute inset-0 bg-[var(--ios-modal-scrim)]"
        onClick={onCancel}
        aria-hidden
      />

      <motion.div
        ref={bubbleWrapRef}
        className="fixed z-[51] pointer-events-auto max-h-[min(50vh,calc(100vh-12rem))] overflow-y-auto overscroll-contain"
        style={bubbleStyle}
        initial={{ opacity: 0.96 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0, transition: { duration: 0.12, ease: MENU_EASE } }}
        transition={{ duration: 0.14, ease: MENU_EASE }}
      >
        <MessageBubble
          message={message}
          isOwn={isOwn}
          currentUserId={currentUserId}
          readOnly
          overlayClone
          militaryTime={militaryTime}
          replyAuthorName={replyAuthorName}
          senderName={senderName}
          senderId={senderId}
          senderRole={senderRole}
          groupChat={groupChat}
          senderAvatar={senderAvatar}
          isGroupChat={isGroupChat}
          showAvatar={showAvatar}
          showSenderNameInBubble={showSenderNameInBubble}
          tightBottom={tightBottom}
          onMentionClick={onMentionClick}
        />
      </motion.div>

      {!deleting && (
        <motion.div
          ref={menuRef}
          className={`fixed z-[52] pointer-events-auto ${isOwn ? 'flex flex-col items-end' : 'flex flex-col items-start'}`}
          style={menuStyle}
          onClick={(e) => e.stopPropagation()}
          initial={{ opacity: 0, y: 6, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 4, scale: 0.97, transition: { duration: 0.12, ease: MENU_EASE } }}
          transition={{ duration: 0.16, ease: MENU_EASE, delay: 0.02 }}
        >
          <div
            className={`rounded-full w-full min-w-[240px] overflow-hidden ${contextMenuSurfaceClass}`}
          >
            <ReactionPicker
              reactions={message.reactions}
              currentUserId={currentUserId}
              onReact={handleReact}
            />
          </div>

          <div
            className={`mt-2 w-full min-w-[140px] ${dropdownMenuClass} ${contextMenuSurfaceClass}`}
          >
            <ActionItem
              icon={IconArrowBackUp}
              onClick={() => runAndClose(() => onReply(message))}
            >
              Reply
            </ActionItem>
            {canCopy && (
              <ActionItem icon={IconCopy} onClick={() => runAndClose(() => onCopy(message))}>
                Copy
              </ActionItem>
            )}
            {canPin && (
              <ActionItem
                icon={IconPin}
                onClick={() =>
                  runAndClose(() => {
                    if (isPinned) onUnpin?.(message)
                    else onPin?.(message)
                  })
                }
              >
                {isPinned ? 'Unpin' : 'Pin'}
              </ActionItem>
            )}
            {canDelete && canCopy && <div className="my-1.5 mx-3 border-t border-[var(--ios-hairline)]" />}
            {canDelete && (
              <ActionItem
                icon={IconTrash}
                danger
                onClick={() => {
                  setDeleting(true)
                  onDelete(message)
                }}
              >
                Delete
              </ActionItem>
            )}
          </div>
        </motion.div>
      )}
    </motion.div>
  )
})

export default MessageActionOverlay

function ActionItem({ children, onClick, icon: Icon, danger = false }) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation()
        onClick()
      }}
      className={danger ? dropdownMenuItemWithIconDangerClass : dropdownMenuItemWithIconClass}
    >
      {Icon && (
        <Icon
          size={18}
          stroke={1.75}
          className={`shrink-0 ${danger ? 'text-[var(--ios-red)]' : 'text-[var(--ios-label-secondary)]'}`}
        />
      )}
      {children}
    </button>
  )
}
