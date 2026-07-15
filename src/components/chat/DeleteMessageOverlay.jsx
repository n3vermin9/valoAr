import { useState, useRef, useLayoutEffect } from 'react'
import { motion } from 'framer-motion'
import { IconArrowBackUp, IconCopy, IconTrash, IconPin } from '@tabler/icons-react'
import { getStoryReplyDisplay } from '../../utils/storyHelpers'
import {
  navGlassMenuClass,
  dropdownMenuClass,
  dropdownMenuItemWithIconClass,
  dropdownMenuItemWithIconDangerClass,
} from '../../utils/designSystem'
import MessageBubble from './MessageBubble'
import { ReactionPicker } from './MessageReactions'

const VIEWPORT_PADDING = 16
const MENU_GAP = 12

function clampHorizontal(left, width) {
  const maxLeft = window.innerWidth - VIEWPORT_PADDING - width
  return Math.max(VIEWPORT_PADDING, Math.min(left, maxLeft))
}

export default function MessageActionOverlay({
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
}) {
  const [deleting, setDeleting] = useState(false)
  const [bubbleTop, setBubbleTop] = useState(originRect.top)
  const [menuTop, setMenuTop] = useState(originRect.bottom + MENU_GAP)
  const bubbleWrapRef = useRef(null)
  const menuRef = useRef(null)

  const panelWidth = Math.max(originRect.width, 240)
  const { text: displayText } = getStoryReplyDisplay(message)
  const canCopy = Boolean(displayText || message.imageUrl)

  const bubbleStyle = isOwn
    ? {
        top: bubbleTop,
        right: Math.max(VIEWPORT_PADDING, window.innerWidth - originRect.right),
        width: originRect.width,
      }
    : {
        top: bubbleTop,
        left: clampHorizontal(originRect.left, originRect.width),
        width: originRect.width,
      }

  const menuStyle = isOwn
    ? {
        top: menuTop,
        right: Math.max(VIEWPORT_PADDING, window.innerWidth - originRect.right),
        width: panelWidth,
      }
    : {
        top: menuTop,
        left: clampHorizontal(originRect.left, panelWidth),
        width: panelWidth,
      }

  useLayoutEffect(() => {
    const wrap = bubbleWrapRef.current
    const menu = menuRef.current
    if (!menu) return

    const fitLayout = () => {
      const menuHeight = menu.offsetHeight
      const maxMenuTop = window.innerHeight - VIEWPORT_PADDING - menuHeight

      let nextBubbleTop = originRect.top
      let wrapHeight = wrap?.offsetHeight ?? originRect.height

      if (wrap) {
        const scrollEl = wrap.querySelector('.message-bubble-action')
        if (scrollEl) {
          scrollEl.scrollTop = scrollEl.scrollHeight
        }
        wrapHeight = wrap.offsetHeight
        const maxBubbleBottom = maxMenuTop - MENU_GAP
        if (nextBubbleTop + wrapHeight > maxBubbleBottom) {
          nextBubbleTop = Math.max(VIEWPORT_PADDING, maxBubbleBottom - wrapHeight)
        }
      }

      setBubbleTop(nextBubbleTop)

      const bubbleBottom = nextBubbleTop + wrapHeight
      const preferredMenuTop = bubbleBottom + MENU_GAP
      setMenuTop(Math.max(VIEWPORT_PADDING, Math.min(preferredMenuTop, maxMenuTop)))
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
    onReact(message, emoji)
    onCancel()
  }

  return (
    <motion.div
      className="fixed inset-0 z-50"
      initial={{ opacity: 1 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.06 } }}
    >
      <div
        className="absolute inset-0 bg-black/55 backdrop-blur-md"
        onClick={onCancel}
        aria-hidden
      />

      <div
        ref={bubbleWrapRef}
        className="fixed z-[51] pointer-events-auto"
        style={bubbleStyle}
      >
        <MessageBubble
          message={message}
          isOwn={isOwn}
          currentUserId={currentUserId}
          readOnly
          overlayClone
          actionOverlay
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
      </div>

      {!deleting && (
        <div
          ref={menuRef}
          className={`fixed z-[52] pointer-events-auto ${isOwn ? 'flex flex-col items-end' : 'flex flex-col items-start'}`}
          style={menuStyle}
          onClick={(e) => e.stopPropagation()}
        >
          <div className={`liquid-glass-pill rounded-full w-full min-w-[240px] ${navGlassMenuClass}`}>
            <ReactionPicker
              reactions={message.reactions}
              currentUserId={currentUserId}
              onReact={handleReact}
            />
          </div>

          <div className={`mt-2 w-full min-w-[140px] ${dropdownMenuClass} ${navGlassMenuClass}`}>
            <ActionItem
              icon={IconArrowBackUp}
              onClick={() => {
                onReply(message)
              }}
            >
              Reply
            </ActionItem>
            {canCopy && (
              <ActionItem icon={IconCopy} onClick={() => onCopy(message)}>
                Copy
              </ActionItem>
            )}
            {canPin && (
              <ActionItem
                icon={IconPin}
                onClick={() => {
                  if (isPinned) onUnpin?.(message)
                  else onPin?.(message)
                }}
              >
                {isPinned ? 'Unpin' : 'Pin'}
              </ActionItem>
            )}
            {canDelete && canCopy && <div className="my-1.5 mx-3 border-t border-white/10" />}
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
        </div>
      )}
    </motion.div>
  )
}

function ActionItem({ children, onClick, icon: Icon, danger = false }) {
  return (
    <button
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
          className={`shrink-0 ${danger ? 'text-red-400' : 'text-white/55'}`}
        />
      )}
      {children}
    </button>
  )
}
