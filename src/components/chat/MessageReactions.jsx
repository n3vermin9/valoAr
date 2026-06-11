import { MESSAGE_REACTIONS } from '../../utils/helpers'

function groupReactions(reactions = {}) {
  const groups = {}
  for (const [userId, emoji] of Object.entries(reactions)) {
    if (!emoji) continue
    if (!groups[emoji]) groups[emoji] = []
    groups[emoji].push(userId)
  }
  return groups
}

export default function MessageReactions({
  reactions,
  isOwn,
  currentUserId,
  onEmojiClick,
  className = '',
}) {
  const groups = groupReactions(reactions)
  const entries = Object.entries(groups)
  if (entries.length === 0) return null

  return (
    <div className={`flex flex-wrap gap-1 ${className}`}>
      {entries.map(([emoji, userIds]) => {
        const mine = userIds.includes(currentUserId)
        const pillClass = `inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-xs border transition-colors ${
          mine
            ? 'bg-blue-500/25 border-blue-400/40'
            : isOwn
              ? 'bg-white/15 border-white/20 hover:bg-white/20'
              : 'bg-black/30 border-white/10 hover:bg-white/10'
        } ${onEmojiClick ? 'cursor-pointer' : ''}`

        if (!onEmojiClick) {
          return (
            <span key={emoji} className={pillClass}>
              <span>{emoji}</span>
              {userIds.length > 1 && (
                <span className="text-[10px] text-white/60 tabular-nums">{userIds.length}</span>
              )}
            </span>
          )
        }

        return (
          <button
            key={emoji}
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onEmojiClick(emoji)
            }}
            className={pillClass}
            aria-label={mine ? `Remove ${emoji} reaction` : `React with ${emoji}`}
          >
            <span>{emoji}</span>
            {userIds.length > 1 && (
              <span className="text-[10px] text-white/60 tabular-nums">{userIds.length}</span>
            )}
          </button>
        )
      })}
    </div>
  )
}

export function ReactionPicker({ reactions, currentUserId, onReact, className = '' }) {
  const myReaction = reactions?.[currentUserId]

  return (
    <div className={`flex items-center justify-center gap-0.5 px-2 py-2 ${className}`}>
      {MESSAGE_REACTIONS.map((emoji) => (
        <button
          key={emoji}
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onReact(emoji)
          }}
          className={`h-9 w-9 flex items-center justify-center rounded-full text-lg transition-colors ${
            myReaction === emoji ? 'bg-blue-500/30 scale-110' : 'hover:bg-white/10'
          }`}
          aria-label={`React with ${emoji}`}
        >
          {emoji}
        </button>
      ))}
    </div>
  )
}
