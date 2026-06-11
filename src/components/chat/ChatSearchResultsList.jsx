import { motion } from 'framer-motion'
import { listRowClass, listRowSelectedClass } from '../../utils/designSystem'
import { formatChatTime, getMessagePreviewText } from '../../utils/helpers'
import { getSearchResultPreview } from '../../utils/chatSearch'

function highlightPreview(text, query) {
  const term = query.trim()
  if (!term || !text) return text

  const lowerText = text.toLowerCase()
  const lowerTerm = term.toLowerCase()
  const index = lowerText.indexOf(lowerTerm)
  if (index < 0) return text

  return (
    <>
      {text.slice(0, index)}
      <mark className="chat-search-mark rounded-sm bg-yellow-400/35 text-inherit not-italic">
        {text.slice(index, index + term.length)}
      </mark>
      {text.slice(index + term.length)}
    </>
  )
}

export default function ChatSearchResultsList({
  results,
  query,
  activeMessageId,
  currentUserId,
  getSenderLabel,
  militaryTime = false,
  onSelect,
  onClose,
}) {
  if (!results.length) return null

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.15 }}
      className="absolute inset-0 z-30 pointer-events-none"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/50 backdrop-blur-sm pointer-events-auto"
        onClick={onClose}
        aria-label="Close search results"
      />

      <div
        className="absolute inset-x-0 overflow-y-auto pointer-events-auto bg-[var(--ios-bg)]/95 backdrop-blur-xl"
        style={{
          top: 'var(--chat-room-header-height)',
          bottom: 'var(--chat-room-composer-min-height)',
        }}
      >
        <div className="py-2">
          {results.map((group) => {
            const message = group.message
            const isSelected = message.id === activeMessageId
            const previewSource = message.text
              ? getSearchResultPreview(message.text, query)
              : getMessagePreviewText(message)

            return (
              <button
                key={message.id}
                type="button"
                onClick={() => onSelect(group.firstMatchIndex)}
                className={`${listRowClass} w-full text-left ${
                  isSelected ? listRowSelectedClass : ''
                }`}
              >
                <div
                  className={`w-11 h-11 shrink-0 rounded-full flex items-center justify-center text-xs font-semibold ${
                    message.senderId === currentUserId
                      ? 'bg-blue-500/20 text-blue-200 border border-blue-400/30'
                      : 'bg-white/10 text-white/80 border border-white/15'
                  }`}
                >
                  {getSenderLabel(message.senderId).slice(0, 1).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-3">
                    <p className={`truncate text-sm ${isSelected ? 'font-bold text-white' : 'font-semibold'}`}>
                      {getSenderLabel(message.senderId)}
                      {group.matchCount > 1 ? (
                        <span className="ml-1.5 text-xs font-medium text-white/45">
                          · {group.matchCount} matches
                        </span>
                      ) : null}
                    </p>
                    {message.createdAt ? (
                      <span className={`text-xs shrink-0 ${isSelected ? 'text-blue-400' : 'text-white/40'}`}>
                        {formatChatTime(message.createdAt, militaryTime)}
                      </span>
                    ) : null}
                  </div>
                  <p className={`text-sm truncate mt-0.5 ${isSelected ? 'text-white/80' : 'text-white/50'}`}>
                    {message.text ? highlightPreview(previewSource, query) : previewSource}
                  </p>
                </div>
              </button>
            )
          })}
        </div>
      </div>
    </motion.div>
  )
}
