import { useState, useEffect, useRef, useLayoutEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import toast from 'react-hot-toast'
import { IconCheck, IconChecks, IconBellOff, IconBookmark, IconPin } from '@tabler/icons-react'
import { useAuth } from '../../contexts/AuthContext'
import {
  subscribeChats,
  getUnreadCount,
  toggleMuteChat,
  togglePinChat,
  removeChatForUser,
  subscribeChatListActivity,
} from '../../services/chatService'
import { fetchUser, blockUser } from '../../services/userService'
import { formatChatTime, navGlassMenuClass, isSavedMessagesChat, contextMenuMotion } from '../../utils/helpers'
import EmptyState from '../ui/EmptyState'
import LoadingSpinner from '../ui/LoadingSpinner'
import ConfirmDialog from '../ui/ConfirmDialog'
import { sad } from '../../assets'

export default function ChatList() {
  const { user, profile, refreshProfile } = useAuth()
  const navigate = useNavigate()
  const [chats, setChats] = useState([])
  const [users, setUsers] = useState({})
  const [loading, setLoading] = useState(true)
  const [selectedChatId, setSelectedChatId] = useState(null)
  const [menuPos, setMenuPos] = useState(null)
  const [confirmAction, setConfirmAction] = useState(null)
  const [actionLoading, setActionLoading] = useState(false)
  const [chatActivity, setChatActivity] = useState({})
  const listRef = useRef(null)
  const rowRefs = useRef({})

  const militaryTime = profile?.useMilitaryTime === true

  useEffect(() => {
    if (!user?.uid) return

    return subscribeChats(user.uid, async (chatList) => {
      setChats(chatList)
      const userMap = {}
      for (const chat of chatList) {
        const otherId = chat.participants.find((id) => id !== user.uid)
        if (otherId && !userMap[otherId]) {
          userMap[otherId] = await fetchUser(otherId)
        }
      }
      setUsers(userMap)
      setLoading(false)
    })
  }, [user?.uid])

  useEffect(() => {
    if (!user?.uid || chats.length === 0) {
      setChatActivity({})
      return
    }

    return subscribeChatListActivity(user.uid, chats, setChatActivity)
  }, [user?.uid, chats])

  const updateMenuPosition = useCallback((chatId) => {
    const el = rowRefs.current[chatId]
    if (!el) return
    const rect = el.getBoundingClientRect()
    setMenuPos({ top: rect.bottom + 4, left: rect.left + 64 })
  }, [])

  useLayoutEffect(() => {
    if (!selectedChatId) return
    updateMenuPosition(selectedChatId)
    const onReposition = () => updateMenuPosition(selectedChatId)
    const scrollEl = listRef.current
    scrollEl?.addEventListener('scroll', onReposition, { passive: true })
    window.addEventListener('resize', onReposition)
    return () => {
      scrollEl?.removeEventListener('scroll', onReposition)
      window.removeEventListener('resize', onReposition)
    }
  }, [selectedChatId, updateMenuPosition])

  useEffect(() => {
    if (!selectedChatId) return
    const handleEscape = (e) => {
      if (e.key === 'Escape') setSelectedChatId(null)
    }
    const handleClickOutside = (e) => {
      if (e.button === 2) return
      if (!e.target.closest('[data-chat-context]')) {
        setSelectedChatId(null)
      }
    }
    document.addEventListener('keydown', handleEscape)
    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('keydown', handleEscape)
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [selectedChatId])

  const selectedChat = chats.find((c) => c.id === selectedChatId)
  const selectedOtherId = selectedChat?.participants.find((id) => id !== user.uid)
  const selectedIsMuted = selectedChat?.mutedBy?.includes(user.uid)
  const selectedIsPinned = selectedChat?.pinnedBy?.includes(user.uid)
  const selectedOtherUser = selectedOtherId ? users[selectedOtherId] : null
  const selectedIsSaved = isSavedMessagesChat(selectedChat, user?.uid)
  const selectedIsRemoved = !selectedIsSaved && (selectedChat?.opponentRemoved || !selectedOtherUser)

  const closeMenu = () => setSelectedChatId(null)

  const handleContextMenu = (e, chatId) => {
    e.preventDefault()
    e.stopPropagation()
    updateMenuPosition(chatId)
    setSelectedChatId(chatId)
  }

  const handleMuteToggle = () => {
    const chatId = selectedChatId
    if (!chatId || !user?.uid) return
    const wasMuted = selectedIsMuted
    closeMenu()
    setChats((prev) =>
      prev.map((c) => {
        if (c.id !== chatId) return c
        const mutedBy = c.mutedBy || []
        return {
          ...c,
          mutedBy: wasMuted ? mutedBy.filter((id) => id !== user.uid) : [...mutedBy, user.uid],
        }
      })
    )
    toggleMuteChat(chatId, user.uid).catch(() => {
      toast.error('Failed to update mute')
    })
  }

  const handlePinToggle = () => {
    const chatId = selectedChatId
    if (!chatId || !user?.uid) return
    const wasPinned = selectedIsPinned
    closeMenu()
    setChats((prev) =>
      prev.map((c) => {
        if (c.id !== chatId) return c
        const pinnedBy = c.pinnedBy || []
        return {
          ...c,
          pinnedBy: wasPinned ? pinnedBy.filter((id) => id !== user.uid) : [...pinnedBy, user.uid],
        }
      })
    )
    togglePinChat(chatId, user.uid).catch(() => {
      toast.error('Failed to update pin')
    })
  }

  const handleRemoveChat = async () => {
    setActionLoading(true)
    try {
      await removeChatForUser(selectedChatId, user.uid)
      toast.success(selectedIsSaved ? 'Saved messages cleared' : 'Chat deleted')
      setConfirmAction(null)
      closeMenu()
    } catch {
      toast.error(selectedIsSaved ? 'Failed to clear saved messages' : 'Failed to delete chat')
    } finally {
      setActionLoading(false)
    }
  }

  const handleBlock = async () => {
    if (!selectedOtherId) return
    setActionLoading(true)
    try {
      await blockUser(user.uid, selectedOtherId)
      await refreshProfile()
      toast.success('User blocked')
      setConfirmAction(null)
      closeMenu()
    } catch {
      toast.error('Failed to block user')
    } finally {
      setActionLoading(false)
    }
  }

  const contextMenu = createPortal(
    <AnimatePresence onExitComplete={() => setMenuPos(null)}>
      {selectedChatId && menuPos && (
        <motion.div
          key={selectedChatId}
          data-chat-context
          {...contextMenuMotion}
          className={`fixed z-[80] w-44 rounded-xl overflow-hidden ${navGlassMenuClass}`}
          style={{ top: menuPos.top, left: menuPos.left }}
          onClick={(e) => e.stopPropagation()}
          onContextMenu={(e) => e.preventDefault()}
        >
          {!selectedIsSaved && (
            <ContextMenuItem onClick={handleMuteToggle}>
              {selectedIsMuted ? 'Unmute' : 'Mute'}
            </ContextMenuItem>
          )}
          <ContextMenuItem onClick={handlePinToggle}>
            {selectedIsPinned ? 'Unpin' : 'Pin chat'}
          </ContextMenuItem>
          <ContextMenuItem
            onClick={() => {
              closeMenu()
              setConfirmAction('removeChat')
            }}
            danger
          >
            {selectedIsSaved ? 'Clear saved messages' : 'Delete chat'}
          </ContextMenuItem>
          {!selectedIsRemoved && !selectedIsSaved && (
            <ContextMenuItem
              onClick={() => {
                closeMenu()
                setConfirmAction('block')
              }}
              danger
            >
              Block
            </ContextMenuItem>
          )}
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  )

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <LoadingSpinner />
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col pb-24 relative">
      <h1
        className={`text-xl font-bold px-6 pt-6 relative z-10 ${
          selectedChatId ? 'blur-[5px] pointer-events-none transition-[filter] duration-300 ease-out' : ''
        }`}
      >
        Chats
      </h1>

      {chats.length === 0 ? (
        <EmptyState message="No friends yet. Start discovering people!" className="flex-1" />
      ) : (
        <div ref={listRef} className="mt-4 overflow-y-auto relative z-10">
          {chats.map((chat) => {
            const isSaved = isSavedMessagesChat(chat, user?.uid)
            const otherId = isSaved ? null : chat.participants.find((id) => id !== user.uid)
            const otherUser = otherId ? users[otherId] : null
            const isRemoved = !isSaved && (chat.opponentRemoved || !otherUser)
            const isMuted = chat.mutedBy?.includes(user.uid)
            const isPinned = chat.pinnedBy?.includes(user.uid)
            const lastMsg = chat.lastMessage
            const sentByYou = lastMsg?.senderId === user.uid
            const unreadCount = getUnreadCount(chat, user.uid)
            const isSelected = selectedChatId === chat.id
            const menuOpen = !!selectedChatId
            const activity = chatActivity[chat.id]
            const isTyping = activity?.typing
            const isOnline = activity?.presence?.online

            return (
              <div
                key={chat.id}
                ref={(el) => {
                  rowRefs.current[chat.id] = el
                }}
                data-chat-context={isSelected ? '' : undefined}
                onContextMenu={(e) => handleContextMenu(e, chat.id)}
                className={`relative ${
                  isSelected
                    ? 'z-40'
                    : menuOpen
                      ? 'blur-[6px] transition-[filter] duration-300 ease-out'
                      : ''
                }`}
              >
                <button
                  type="button"
                  data-allow-contextmenu
                  onClick={() => {
                    if (menuOpen) return
                    navigate(`/chats/${chat.id}`)
                  }}
                  className={`w-full flex items-center gap-3 px-6 py-4 transition-colors ${
                    menuOpen && !isSelected ? 'pointer-events-none' : ''
                  } ${isSelected ? 'bg-white/[0.06]' : 'hover:bg-white/5'}`}
                >
                  <div className="relative shrink-0">
                    {isSaved ? (
                      <div className="w-14 h-14 rounded-full bg-blue-500/15 border border-blue-500/25 flex items-center justify-center">
                        <IconBookmark size={26} className="text-blue-400" stroke={1.75} />
                      </div>
                    ) : (
                      <>
                        <img
                          src={otherUser?.photos?.[0] || sad}
                          alt=""
                          className="w-14 h-14 rounded-full object-cover"
                        />
                        {isOnline && !isTyping && (
                          <span className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-green-400 border-2 border-black rounded-full" />
                        )}
                      </>
                    )}
                    {unreadCount > 0 && (
                      <span className="absolute -top-1 -right-1 min-w-[20px] h-5 px-1 bg-blue-500 text-white text-xs font-semibold rounded-full flex items-center justify-center">
                        {unreadCount > 99 ? '99+' : unreadCount}
                      </span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0 text-left">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2 min-w-0">
                        <p
                          className={`truncate ${unreadCount > 0 ? 'font-bold' : 'font-semibold'} ${isRemoved ? 'text-white/50' : ''}`}
                        >
                          {isSaved ? 'Saved Messages' : isRemoved ? 'Deleted user' : otherUser.username}
                        </p>
                        {isMuted && (
                          <IconBellOff size={14} className="text-white/50 shrink-0" aria-label="Muted" />
                        )}
                        {isPinned && (
                          <IconPin size={14} className="text-blue-400 shrink-0" aria-label="Pinned" />
                        )}
                      </div>
                      {lastMsg?.createdAt && (
                        <span
                          className={`text-xs shrink-0 ${unreadCount > 0 ? 'text-blue-400' : 'text-white/40'}`}
                        >
                          {formatChatTime(lastMsg.createdAt, militaryTime)}
                        </span>
                      )}
                    </div>
                    <p
                      className={`text-sm truncate mt-0.5 flex items-center gap-1 ${
                        isTyping
                          ? 'text-blue-300 font-medium italic'
                          : unreadCount > 0
                            ? 'text-white/80 font-medium'
                            : 'text-white/50'
                      }`}
                    >
                      {isTyping ? (
                        'typing…'
                      ) : (
                        <>
                          {sentByYou && (
                            <span className="inline-flex shrink-0 not-italic">
                              {lastMsg?.read ? (
                                <IconChecks size={14} className="text-blue-400" stroke={2} />
                              ) : (
                                <IconCheck size={14} className="text-white/40" stroke={2} />
                              )}
                            </span>
                          )}
                          <span className="truncate">
                            {isSaved
                              ? lastMsg?.text || 'Save notes and messages here'
                              : isRemoved
                                ? 'This account is no longer available'
                                : lastMsg?.text || 'Start a conversation'}
                          </span>
                        </>
                      )}
                    </p>
                  </div>
                </button>
              </div>
            )
          })}
        </div>
      )}

      {contextMenu}

      <ConfirmDialog
        isOpen={confirmAction === 'removeChat'}
        onClose={() => setConfirmAction(null)}
        onConfirm={handleRemoveChat}
        title={selectedIsSaved ? 'Clear saved messages?' : 'Delete chat?'}
        message={
          selectedIsSaved
            ? 'All saved messages will be deleted. The chat will stay in your list.'
            : 'This will delete all messages and hide the chat for both of you.'
        }
        confirmLabel={selectedIsSaved ? 'Clear messages' : 'Delete chat'}
        danger
        loading={actionLoading}
      />

      <ConfirmDialog
        isOpen={confirmAction === 'block'}
        onClose={() => setConfirmAction(null)}
        onConfirm={handleBlock}
        title="Block user?"
        message="They won't be able to message you and will be removed from your friends."
        confirmLabel="Block"
        danger
        loading={actionLoading}
      />
    </div>
  )
}

function ContextMenuItem({ children, onClick, danger = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full px-4 py-2.5 text-left text-sm font-medium transition-colors duration-75 ${
        danger
          ? 'text-red-400 hover:text-red-300 hover:bg-red-500/10 active:bg-red-500/20 active:text-red-200'
          : 'text-white/90 hover:text-white hover:bg-white/[0.08] active:bg-white/[0.14]'
      }`}
    >
      {children}
    </button>
  )
}
