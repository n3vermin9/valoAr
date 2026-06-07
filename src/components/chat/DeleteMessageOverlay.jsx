import { useState, useRef, useEffect } from 'react'
import { motion } from 'framer-motion'
import { IconCheck, IconChecks } from '@tabler/icons-react'
import { formatMessageTime, navGlassMenuClass } from '../../utils/helpers'

const MAX_MESSAGE_HEIGHT = 'max-h-[min(50vh,calc(100vh-12rem))]'
const VIEWPORT_PADDING = 16

function clampHorizontal(left, width) {
  const maxLeft = window.innerWidth - VIEWPORT_PADDING - width
  return Math.max(VIEWPORT_PADDING, Math.min(left, maxLeft))
}

export default function MessageActionOverlay({
  message,
  originRect,
  isOwn,
  onDelete,
  onCopy,
  onCancel,
  militaryTime = false,
}) {
  const [deleting, setDeleting] = useState(false)
  const scrollRef = useRef(null)

  const bubbleWidth = originRect.width
  const top = Math.max(VIEWPORT_PADDING, originRect.top)
  const containerStyle = isOwn
    ? {
        top,
        right: Math.max(VIEWPORT_PADDING, window.innerWidth - originRect.right),
        width: bubbleWidth,
      }
    : {
        top,
        left: clampHorizontal(originRect.left, bubbleWidth),
        width: bubbleWidth,
      }

  const sentTime = formatMessageTime(message.createdAt, militaryTime)
  const canCopy = Boolean(message.text || message.imageUrl)

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    requestAnimationFrame(() => {
      el.scrollTop = el.scrollHeight
    })
  }, [message.id, message.text, message.imageUrl, message.audioUrl])

  return (
    <motion.div
      className="fixed inset-0 z-50"
      onClick={onCancel}
      initial={{ opacity: 1 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.04 } }}
    >
      <div className="absolute inset-0 bg-black/55 backdrop-blur-md pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.99, transition: { duration: 0.04 } }}
        transition={{ type: 'spring', stiffness: 420, damping: 34 }}
        style={containerStyle}
        className={`fixed z-10 flex flex-col max-h-[calc(100vh-2rem)] ${
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
            {message.audioUrl && (
              <audio
                controls
                src={message.audioUrl}
                className="w-full min-w-[180px] max-w-full h-9"
                preload="metadata"
              />
            )}
            {message.imageUrl && (
              <img src={message.imageUrl} alt="" className="rounded-xl max-w-full mb-1" />
            )}
            {message.text && <p className="text-sm break-words">{message.text}</p>}
          </div>

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
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ delay: 0.04 }}
            className={`mt-3 shrink-0 py-1 rounded-xl overflow-hidden w-full min-w-[140px] ${navGlassMenuClass}`}
          >
            {canCopy && <ActionItem onClick={() => onCopy(message)}>Copy</ActionItem>}
            {isOwn && canCopy && <div className="my-1.5 mx-3 border-t border-white/10" />}
            {isOwn && (
              <ActionItem
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
        )}
      </motion.div>
    </motion.div>
  )
}

function ActionItem({ children, onClick, danger = false }) {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation()
        onClick()
      }}
      className={`w-full px-4 py-2.5 text-left text-sm font-medium transition-colors hover:bg-white/5 ${
        danger ? 'text-red-400 hover:text-red-300' : 'text-white/90 hover:text-white'
      }`}
    >
      {children}
    </button>
  )
}
