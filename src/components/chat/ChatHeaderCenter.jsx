import { motion, AnimatePresence } from 'framer-motion'
import { IconBellOff, IconUsers } from '@tabler/icons-react'
import { storyGlassBlur } from '../../utils/designSystem'
import CachedAvatar from '../ui/CachedAvatar'
import ChatSearchBar from './ChatSearchBar'
import { sad, logo } from '../../assets'
import { deletedAccountAvatarClass, deletedAccountAvatarSrc } from '../../utils/deletedAccountAvatar'
import VerifiedBadge from '../ui/VerifiedBadge'

const shellTransition = { type: 'spring', stiffness: 260, damping: 30, mass: 1.05 }

export default function ChatHeaderCenter({
  showSearch,
  isSavedMessages,
  isGroupChat,
  groupName,
  groupMemberCount,
  otherDisplayName,
  otherUser,
  opponentRemoved,
  presence,
  isTyping,
  isMuted,
  statusText,
  statusColor,
  onOpenProfile,
  searchQuery,
  onSearchQueryChange,
  onSearchPrev,
  onSearchNext,
  onSearchClose,
}) {
  return (
    <motion.div
      initial={false}
      transition={shellTransition}
      className={
        showSearch
          ? 'w-full min-w-0'
          : `${storyGlassBlur} liquid-glass-pill flex items-center h-11 min-h-11 min-w-0 rounded-full pl-2 pr-4 w-fit max-w-[min(72vw,280px)] hover:brightness-110 active:scale-[0.98]`
      }
    >
      <AnimatePresence mode="wait" initial={false}>
        {showSearch ? (
          <motion.div
            key="chat-search"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className={`${storyGlassBlur} liquid-glass-pill flex items-center h-11 min-h-11 w-full rounded-full pl-2 pr-4`}
          >
            <ChatSearchBar
              inline
              active={showSearch}
              query={searchQuery}
              onQueryChange={onSearchQueryChange}
              onPrev={onSearchPrev}
              onNext={onSearchNext}
              onClose={onSearchClose}
            />
          </motion.div>
        ) : isSavedMessages ? (
          <motion.div
            key="saved"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="flex items-center gap-6 min-w-0 h-full cursor-default"
          >
            <div className="w-8 h-8 rounded-full bg-blue-500/20 border border-blue-500/30 flex items-center justify-center shrink-0">
              <img src={logo} alt="Logo" className="w-6 h-6 object-cover" />
            </div>
            <div className="min-w-0 text-left">
              <p className="font-semibold text-sm truncate text-white">Saved Messages</p>
              <p className="text-[11px] text-white/65 leading-tight">Only you can see this</p>
            </div>
          </motion.div>
        ) : isGroupChat ? (
          <motion.button
            key="group"
            type="button"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onOpenProfile}
            className="flex items-center gap-6 min-w-0 h-full text-left cursor-pointer"
            aria-label={`Open ${groupName} settings`}
          >
            <div className="w-8 h-8 rounded-full bg-blue-500/20 border border-blue-500/30 flex items-center justify-center shrink-0">
              <IconUsers size={18} className="text-blue-400" stroke={1.75} />
            </div>
            <div className="min-w-0 text-left">
              <div className="flex items-center gap-1">
                <p className="font-semibold text-sm truncate text-white">{groupName}</p>
                {isMuted && (
                  <IconBellOff size={13} className="text-white/50 shrink-0" aria-label="Muted" />
                )}
              </div>
              <p className={`text-[11px] leading-tight truncate ${statusColor}`}>{statusText}</p>
            </div>
          </motion.button>
        ) : (
          <motion.button
            key="profile"
            type="button"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onOpenProfile}
            className="flex items-center gap-6 min-w-0 h-full text-left cursor-pointer"
            aria-label={`View ${otherDisplayName}'s profile`}
          >
            <div className="relative shrink-0">
              <CachedAvatar
                src={opponentRemoved ? deletedAccountAvatarSrc : otherUser?.photos?.[0]}
                fallback={sad}
                size={32}
                alt=""
                className={`w-8 h-8 rounded-full object-cover ring-1 ring-white/20 ${
                  opponentRemoved ? deletedAccountAvatarClass : ''
                }`}
              />
              {presence?.online && !isTyping && !opponentRemoved && (
                <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-400 border-2 border-black rounded-full" />
              )}
            </div>
            <div className="min-w-0 text-left">
              <div className="flex items-center gap-1">
                <p className="font-semibold text-sm truncate text-white">{otherDisplayName}</p>
                <VerifiedBadge username={otherUser?.username} size={14} />
                {isMuted && (
                  <IconBellOff size={13} className="text-white/50 shrink-0" aria-label="Muted" />
                )}
              </div>
              <p className={`text-[11px] leading-tight truncate ${statusColor}`}>{statusText}</p>
            </div>
          </motion.button>
        )}
      </AnimatePresence>
    </motion.div>
  )
}
