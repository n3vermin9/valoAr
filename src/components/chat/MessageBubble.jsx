import { useRef } from 'react'
import { IconCheck, IconChecks } from '@tabler/icons-react'
import { formatMessageTime } from '../../utils/helpers'

export default function MessageBubble({ message, isOwn, onContextMenu, onLongPress, militaryTime = false }) {
  const bubbleRef = useRef(null)

  const getRect = () => bubbleRef.current?.getBoundingClientRect()

  const handleContextMenu = (e) => {
    e.preventDefault()
    onContextMenu?.(message, getRect())
  }

  let pressTimer
  const handleTouchStart = () => {
    pressTimer = setTimeout(() => onLongPress?.(message, getRect()), 500)
  }
  const handleTouchEnd = () => clearTimeout(pressTimer)

  const sentTime = formatMessageTime(message.createdAt, militaryTime)

  return (
    <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'} mb-2`}>
      <div className="max-w-[75%]">
        <div
          ref={bubbleRef}
          onContextMenu={handleContextMenu}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          className={`px-4 py-2 rounded-2xl transition-opacity message-bubble ${
            isOwn ? 'bg-blue-500 rounded-br-sm' : 'bg-white/10 rounded-bl-sm'
          }`}
          data-allow-contextmenu
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
            <img
              src={message.imageUrl}
              alt=""
              className="rounded-xl max-w-full mb-1 cursor-pointer"
              onClick={() => message.onImageClick?.(message.imageUrl)}
            />
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
    </div>
  )
}
