import { useState, useRef, useEffect, useLayoutEffect } from 'react'
import { motion } from 'framer-motion'
import { IconCheck, IconChecks, IconArrowBackUp, IconCopy, IconTrash } from '@tabler/icons-react'
import { formatMessageTime, navGlassMenuClass } from '../../utils/helpers'
import VoiceMessagePlayer from './VoiceMessagePlayer'
import ReplyQuote from './ReplyQuote'
import MessageReactions, { ReactionPicker } from './MessageReactions'
import MessageText from './MessageText'

const MAX_MESSAGE_HEIGHT = 'max-h-[min(50vh,calc(100vh-12rem))]'
const VIEWPORT_PADDING = 16
const BOTTOM_RESERVE = 200

function clampHorizontal(left, width) {
  const maxLeft = window.innerWidth - VIEWPORT_PADDING - width
  return Math.max(VIEWPORT_PADDING, Math.min(left, maxLeft))
}

export default function MessageActionOverlay({
  message,
  originRect,
  isOwn,
  currentUserId,
  onDelete,
  onCopy,
  onReply,
  onReact,
  onMentionClick,
  onCancel,
  replyAuthorName,
  militaryTime = false,
}) {
  const [deleting, setDeleting] = useState(false)
  const [adjustedTop, setAdjustedTop] = useState(originRect.top)
  const scrollRef = useRef(null)
  const panelRef = useRef(null)

  const bubbleWidth = originRect.width
  const containerStyle = isOwn
    ? {
        top: adjustedTop,
        right: Math.max(VIEWPORT_PADDING, window.innerWidth - originRect.right),
        width: bubbleWidth,
      }
    : {
        top: adjustedTop,
        left: clampHorizontal(originRect.left, bubbleWidth),
        width: bubbleWidth,
      }

  const sentTime = formatMessageTime(message.createdAt, militaryTime)
  const canCopy = Boolean(message.text || message.imageUrl)
  const hasReactions = message.reactions && Object.keys(message.reactions).length > 0

  useLayoutEffect(() => {
    const panel = panelRef.current
    if (!panel) return

    const fitPanel = () => {
      const height = panel.offsetHeight
      const maxBottom = window.innerHeight - BOTTOM_RESERVE
      const nextTop = Math.max(VIEWPORT_PADDING, Math.min(originRect.top, maxBottom - height))
      setAdjustedTop(nextTop)
    }

    fitPanel()
    window.addEventListener('resize', fitPanel)
    return () => window.removeEventListener('resize', fitPanel)
  }, [originRect.top, originRect.width, deleting, hasReactions, canCopy, isOwn, message.id])

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    requestAnimationFrame(() => {
      el.scrollTop = el.scrollHeight
    })
  }, [message.id, message.text, message.imageUrl, message.audioUrl, message.replyTo, message.reactions])

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

      <div className="absolute inset-0 pointer-events-none">
        <motion.div
          ref={panelRef}
          initial={{ opacity: 1, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.99, transition: { duration: 0.04 } }}
          transition={{ duration: 0.12, ease: [0.32, 0.72, 0, 1] }}
          style={containerStyle}
          className={`fixed z-10 flex flex-col max-h-[calc(100vh-2rem)] pointer-events-auto ${
            isOwn ? 'items-end' : 'items-start'
          }`}
          onClick={(e) => e.stopPropagation()}
        >
        <div className="w-full min-w-0">
          <div
            ref={scrollRef}
            className={`px-4 py-2 rounded-2xl message-bubble overflow-y-auto ${MAX_MESSAGE_HEIGHT} ${
              isOwn ? 'bg-blue-500 rounded-br-sm' : 'bg-white/10 rounded-bl-sm'
            }`}
          >
            {message.replyTo && (
              <ReplyQuote reply={message.replyTo} authorName={replyAuthorName} isOwn={isOwn} />
            )}
            {message.audioUrl && <VoiceMessagePlayer src={message.audioUrl} isOwn={isOwn} />}
            {message.imageUrl && (
              <img src={message.imageUrl} alt="" className="rounded-xl max-w-full mb-1" />
            )}
            {message.text && (
              <MessageText
                text={message.text}
                isOwn={isOwn}
                onMentionClick={onMentionClick}
                className="text-sm break-words"
              />
            )}
          </div>

          {hasReactions && (
            <MessageReactions
              reactions={message.reactions}
              isOwn={isOwn}
              currentUserId={currentUserId}
              onEmojiClick={handleReact}
              className="mt-1.5"
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

        {!deleting && (
          <>
            <motion.div
              initial={{ opacity: 1, y: 0 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className={`mt-3 shrink-0 rounded-full overflow-hidden w-full min-w-[240px] ${navGlassMenuClass}`}
            >
              <ReactionPicker
                reactions={message.reactions}
                currentUserId={currentUserId}
                onReact={handleReact}
              />
            </motion.div>

            <motion.div
              initial={{ opacity: 1, y: 0 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className={`mt-2 shrink-0 py-1 rounded-xl overflow-hidden w-full min-w-[140px] ${navGlassMenuClass}`}
            >
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
              {isOwn && canCopy && <div className="my-1.5 mx-3 border-t border-white/10" />}
              {isOwn && (
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
            </motion.div>
          </>
        )}
        </motion.div>
      </div>
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
      className={`w-full px-4 py-2.5 text-left text-sm font-medium transition-colors hover:bg-white/5 flex items-center gap-3 ${
        danger ? 'text-red-400 hover:text-red-300' : 'text-white/90 hover:text-white'
      }`}
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
