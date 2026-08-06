import { motion } from 'framer-motion'
import { listRowClass, listRowSelectedClass } from '../../utils/designSystem'
import { formatChatTime, getMessagePreviewText } from '../../utils/helpers'
import { getSearchResultPreview } from '../../utils/chatSearch'
import UsernameLabel from '../ui/UsernameLabel'

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
  militaryTime = true,
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
        className="absolute inset-0 bg-[var(--ios-modal-scrim)] backdrop-blur-sm pointer-events-auto"
        onClick={onClose}
        aria-label="Close search results"
      />

      <div
        className="absolute inset-x-0 overflow-y-auto pointer-events-auto bg-[var(--ios-bg)]/95 backdrop-blur-xl chat-room-messages-pane"
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
                      ? 'bg-blue-500/20 text-[var(--chat-accent)] border border-blue-400/30'
                      : 'bg-[var(--ios-fill-tertiary)] text-[var(--ios-label-secondary)] border border-[var(--ios-hairline)]'
                  }`}
                >
                  {getSenderLabel(message.senderId).slice(0, 1).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-3">
                    <p className={`truncate text-sm flex items-center gap-1 min-w-0 text-[var(--ios-label)] ${isSelected ? 'font-bold' : 'font-semibold'}`}>
                      <UsernameLabel
                        username={getSenderLabel(message.senderId)}
                        className="truncate min-w-0"
                        badgeSize={12}
                      />
                      {group.matchCount > 1 ? (
                        <span className="ml-1.5 text-xs font-medium text-[var(--ios-label-tertiary)]">
                          · {group.matchCount} matches
                        </span>
                      ) : null}
                    </p>
                    {message.createdAt ? (
                      <span className={`text-xs shrink-0 ${isSelected ? 'text-[var(--ios-blue)]' : 'text-[var(--ios-label-tertiary)]'}`}>
                        {formatChatTime(message.createdAt, militaryTime)}
                      </span>
                    ) : null}
                  </div>
                  <p className={`text-sm truncate mt-0.5 ${isSelected ? 'text-[var(--ios-label)]' : 'text-[var(--ios-label-secondary)]'}`}>
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
