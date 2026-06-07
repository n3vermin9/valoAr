import { useState, useEffect, useRef, useCallback, useLayoutEffect } from 'react'
import { createPortal } from 'react-dom'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import toast from 'react-hot-toast'
import { IconDotsVertical, IconBellOff, IconBookmark } from '@tabler/icons-react'
import { useAuth } from '../../contexts/AuthContext'
import {
  subscribeMessages,
  subscribeChat,
  sendMessage,
  markMessagesRead,
  deleteMessage,
  removeChatForUser,
  toggleMuteChat,
  setTyping,
  subscribeTyping,
  getUnreadCount,
  ensureSavedMessagesChat,
} from '../../services/chatService'
import {
  fetchUser,
  blockUser,
  unblockUser,
  subscribePresence,
  subscribeToUser,
} from '../../services/userService'
import { compressImage, uploadChatImage, uploadChatAudio, formatLastSeen, isSavedMessagesChat, headerMenuGlassClass, contextMenuMotion } from '../../utils/helpers'
import ChevronBack from '../ui/ChevronBack'
import MessageBubble from './MessageBubble'
import DeleteMessageOverlay from './DeleteMessageOverlay'
import ImageViewer from './ImageViewer'
import ChatInput from './ChatInput'
import Modal from '../ui/Modal'
import ConfirmDialog from '../ui/ConfirmDialog'
import { PublicProfileView } from '../profile/ProfileView'
import LoadingSpinner from '../ui/LoadingSpinner'
import { sad } from '../../assets'

export default function ChatRoom() {
  const { matchId } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const isDraft = location.state?.draft === true
  const { user, profile, refreshProfile } = useAuth()
  const [messages, setMessages] = useState([])
  const [otherUser, setOtherUser] = useState(null)
  const [chatMeta, setChatMeta] = useState(null)
  const [chatAvailable, setChatAvailable] = useState(false)
  const [loading, setLoading] = useState(true)
  const [isTyping, setIsTyping] = useState(false)
  const [presence, setPresence] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [removedMessageIds, setRemovedMessageIds] = useState(() => new Set())
  const [imageViewer, setImageViewer] = useState(null)
  const [imagePreview, setImagePreview] = useState(null)
  const [showMenu, setShowMenu] = useState(false)
  const [menuPos, setMenuPos] = useState(null)
  const [showProfile, setShowProfile] = useState(false)
  const [confirmAction, setConfirmAction] = useState(null)
  const [confirmLoading, setConfirmLoading] = useState(false)
  const [savedScrollPosition, setSavedScrollPosition] = useState(0)
  const messagesEndRef = useRef(null)
  const messagesContainerRef = useRef(null)
  const typingTimeoutRef = useRef(null)
  const menuButtonRef = useRef(null)
  const chatWasVisibleRef = useRef(false)
  const markReadTimerRef = useRef(null)

  const isSavedMessages =
    isSavedMessagesChat(matchId, user?.uid) || chatMeta?.isSavedMessages === true
  const otherId = isSavedMessages ? null : matchId?.split('_').find((id) => id !== user?.uid)
  const iBlockedThem = !isSavedMessages && profile?.blocked?.includes(otherId)
  const theyBlockedMe = !isSavedMessages && chatMeta?.blockedBy?.includes(otherId) && !iBlockedThem
  const chatFrozen = !isSavedMessages && (iBlockedThem || theyBlockedMe)
  const isMuted = chatMeta?.mutedBy?.includes(user.uid)
  const militaryTime = profile?.useMilitaryTime === true

  useEffect(() => {
    if (!matchId || !user?.uid) return
    if (isSavedMessagesChat(matchId, user.uid)) {
      ensureSavedMessagesChat(user.uid).catch(() => {})
    }
  }, [matchId, user?.uid])

  useEffect(() => {
    if (!otherId || isSavedMessages) return
    return subscribeToUser(otherId, setOtherUser)
  }, [otherId, isSavedMessages])

  useEffect(() => {
    chatWasVisibleRef.current = false
    setChatAvailable(false)
    setLoading(true)
    setMessages([])
  }, [matchId])

  useEffect(() => {
    if (!matchId || !user?.uid) return

    const unsubMeta = subscribeChat(matchId, (chat) => {
      const hidden = chat?.hiddenFor?.includes(user.uid)
      const visible = chat && !hidden

      if (visible) {
        chatWasVisibleRef.current = true
        setChatMeta(chat)
        setChatAvailable(true)
        return
      }

      if (isDraft) {
        setChatMeta(chat)
        setChatAvailable(true)
        setLoading(false)
        return
      }

      if (chatWasVisibleRef.current) {
        navigate('/chats')
        return
      }

      if (!chat || hidden) {
        navigate('/chats', { replace: true })
      }
    })

    return unsubMeta
  }, [matchId, user?.uid, navigate, isDraft])

  useEffect(() => {
    if (!matchId || !user?.uid || !chatAvailable) return

    const scheduleMarkRead = () => {
      clearTimeout(markReadTimerRef.current)
      markReadTimerRef.current = setTimeout(() => {
        markMessagesRead(matchId, user.uid).catch(() => {})
      }, 80)
    }

    const unsub = subscribeMessages(matchId, (msgs) => {
      setMessages(msgs)
      setLoading(false)
      if (msgs.some((m) => m.senderId !== user.uid && !m.read)) {
        scheduleMarkRead()
      }
    })

    scheduleMarkRead()
    return () => {
      unsub()
      clearTimeout(markReadTimerRef.current)
      markMessagesRead(matchId, user.uid).catch(() => {})
    }
  }, [matchId, user?.uid, chatAvailable])

  useEffect(() => {
    if (!matchId || !user?.uid || !chatAvailable) return

    return subscribeChat(matchId, (chat) => {
      if (getUnreadCount(chat, user.uid) > 0) {
        clearTimeout(markReadTimerRef.current)
        markReadTimerRef.current = setTimeout(() => {
          markMessagesRead(matchId, user.uid).catch(() => {})
        }, 80)
      }
    })
  }, [matchId, user?.uid, chatAvailable])

  useEffect(() => {
    if (!otherId || isSavedMessages) return
    return subscribePresence(otherId, setPresence)
  }, [otherId, isSavedMessages])

  useEffect(() => {
    if (!matchId || !user?.uid || isSavedMessages) return
    return subscribeTyping(matchId, user.uid, setIsTyping)
  }, [matchId, user?.uid, isSavedMessages])

  const updateMenuPosition = useCallback(() => {
    const el = menuButtonRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    setMenuPos({ top: rect.bottom + 8, right: window.innerWidth - rect.right })
  }, [])

  useLayoutEffect(() => {
    if (!showMenu) return
    updateMenuPosition()
    window.addEventListener('resize', updateMenuPosition)
    return () => window.removeEventListener('resize', updateMenuPosition)
  }, [showMenu, updateMenuPosition])

  useEffect(() => {
    if (!showMenu) return
    const handleClickOutside = (e) => {
      if (e.target.closest('[data-chat-header-menu]')) return
      if (menuButtonRef.current?.contains(e.target)) return
      setShowMenu(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showMenu])

  useEffect(() => {
    if (deleteTarget) return
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleTyping = useCallback(
    (typing) => {
      if (!matchId || !user?.uid || chatFrozen) return
      setTyping(matchId, user.uid, typing)
      clearTimeout(typingTimeoutRef.current)
      if (typing) {
        typingTimeoutRef.current = setTimeout(() => setTyping(matchId, user.uid, false), 2000)
      }
    },
    [matchId, user?.uid, chatFrozen]
  )

  const handleSend = async ({ text, imageUrl, audioBlob }) => {
    if (chatFrozen) return
    try {
      let finalImageUrl = imageUrl
      if (imageUrl?.startsWith('data:')) {
        finalImageUrl = await uploadChatImage(user.uid, matchId, imageUrl)
      }
      let audioUrl = null
      if (audioBlob) {
        audioUrl = await uploadChatAudio(user.uid, matchId, audioBlob)
      }
      await sendMessage(matchId, user.uid, { text, imageUrl: finalImageUrl, audioUrl })
      setTyping(matchId, user.uid, false)
    } catch (err) {
      toast.error(err.message || 'Failed to send message')
    }
  }

  const handleSendVoice = async (audioBlob) => {
    await handleSend({ text: '', imageUrl: null, audioBlob })
  }

  const handleImageSelect = async (file) => {
    try {
      const dataUrl = await compressImage(file)
      setImagePreview(dataUrl)
    } catch (err) {
      toast.error(err.message)
    }
  }

  const handleDeleteMessage = async (message) => {
    setDeleteTarget(null)
    setRemovedMessageIds((prev) => new Set(prev).add(message.id))
    try {
      await deleteMessage(matchId, message.id)
    } catch {
      setRemovedMessageIds((prev) => {
        const next = new Set(prev)
        next.delete(message.id)
        return next
      })
      toast.error('Failed to delete message')
    }
  }

  const handleCopyMessage = async (message) => {
    const content = message.text || message.imageUrl
    if (!content) {
      toast.error('Nothing to copy')
      return
    }
    try {
      await navigator.clipboard.writeText(content)
      toast.success('Copied!')
      setDeleteTarget(null)
    } catch {
      toast.error('Failed to copy')
    }
  }

  const visibleMessages = messages.filter((msg) => !removedMessageIds.has(msg.id))

  useEffect(() => {
    setRemovedMessageIds((prev) => {
      if (prev.size === 0) return prev
      const next = new Set([...prev].filter((id) => messages.some((msg) => msg.id === id)))
      return next.size === prev.size ? prev : next
    })
  }, [messages])

  const handleSelectMessageAction = (message, rect) => {
    if (!rect) return
    setDeleteTarget({ message, rect })
  }

  const handleMute = async () => {
    setShowMenu(false)
    try {
      const muted = await toggleMuteChat(matchId, user.uid)
      toast.success(muted ? 'Chat muted' : 'Chat unmuted')
    } catch {
      toast.error('Failed to update mute')
    }
  }

  const handleRemoveChat = async () => {
    try {
      await removeChatForUser(matchId, user.uid)
      toast.success('Chat removed')
      navigate('/chats')
    } catch {
      toast.error('Failed to remove chat')
    }
  }

  const handleBlock = async (targetId) => {
    try {
      await blockUser(user.uid, targetId)
      await refreshProfile()
      toast.success('User blocked')
      setShowProfile(false)
    } catch {
      toast.error('Failed to block user')
    }
  }

  const handleUnblock = async () => {
    try {
      await unblockUser(user.uid, otherId)
      await refreshProfile()
      toast.success('User unblocked')
    } catch {
      toast.error('Failed to unblock user')
    }
  }

  const runConfirmAction = async () => {
    setConfirmLoading(true)
    try {
      if (confirmAction === 'removeChat') {
        await handleRemoveChat()
      }
    } catch {
      // handleRemoveChat already toasts
    } finally {
      setConfirmLoading(false)
      setConfirmAction(null)
    }
  }

  const openProfile = () => {
    if (messagesContainerRef.current) {
      setSavedScrollPosition(messagesContainerRef.current.scrollTop)
    }
    setShowProfile(true)
  }

  const closeProfile = () => {
    setShowProfile(false)
    requestAnimationFrame(() => {
      if (messagesContainerRef.current) {
        messagesContainerRef.current.scrollTop = savedScrollPosition
      }
    })
  }

  const statusText = isTyping
    ? 'typing...'
    : presence?.online
      ? 'online'
      : `last seen ${formatLastSeen(presence?.lastSeen)}`

  const statusColor = isTyping ? 'text-white/80' : presence?.online ? 'text-green-500' : 'text-white/50'

  const headerMenu = createPortal(
    <AnimatePresence onExitComplete={() => setMenuPos(null)}>
      {showMenu && menuPos && (
        <motion.div
          key="chat-header-menu"
          data-chat-header-menu
          {...contextMenuMotion}
          className={`fixed z-[80] min-w-[200px] py-1 rounded-xl overflow-hidden ${headerMenuGlassClass}`}
          style={{ top: menuPos.top, right: menuPos.right }}
          onClick={(e) => e.stopPropagation()}
        >
          <MenuItem onClick={handleMute}>{isMuted ? 'Unmute' : 'Mute'}</MenuItem>
          <MenuItem
            onClick={() => {
              setShowMenu(false)
              setConfirmAction('removeChat')
            }}
            danger
          >
            Remove Chat
          </MenuItem>
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
    <div className="h-full flex flex-col pb-4">
      {headerMenu}
      <div className="relative z-20 flex items-center gap-2 px-4 py-3 bg-black/60 backdrop-blur-xl border-b border-white/10">
        <ChevronBack onClick={() => navigate('/chats')} />
        {isSavedMessages ? (
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="w-10 h-10 rounded-full bg-blue-500/15 border border-blue-500/25 flex items-center justify-center shrink-0">
              <IconBookmark size={20} className="text-blue-400" stroke={1.75} />
            </div>
            <div className="text-left min-w-0">
              <p className="font-semibold truncate">Saved Messages</p>
              <p className="text-xs text-white/50">Only you can see this</p>
            </div>
          </div>
        ) : (
          <>
            <button onClick={openProfile} className="flex items-center gap-3 flex-1 min-w-0">
              <img
                src={otherUser?.photos?.[0] || sad}
                alt=""
                className="w-10 h-10 rounded-full object-cover"
              />
              <div className="text-left min-w-0">
                <div className="flex items-center gap-1">
                  <p className="font-semibold truncate">
                    {otherUser?.username || 'User'}
                  </p>
                  {isMuted && (
                    <IconBellOff size={14} className="text-white/50 shrink-0" aria-label="Muted" />
                  )}
                </div>
                <p className={`text-xs ${statusColor}`}>{statusText}</p>
              </div>
            </button>
            <div className="relative">
              <button
                ref={menuButtonRef}
                onClick={() => setShowMenu((open) => !open)}
                className="p-2 hover:bg-white/10 rounded-full"
              >
                <IconDotsVertical size={20} />
              </button>
            </div>
          </>
        )}
      </div>

      <div
        ref={messagesContainerRef}
        className={`flex-1 overflow-y-auto px-4 py-4 ${deleteTarget ? 'blur-sm pointer-events-none' : ''}`}
      >
        {visibleMessages.map((msg) => (
          <MessageBubble
            key={msg.id}
            message={{
              ...msg,
              onImageClick: setImageViewer,
            }}
            isOwn={msg.senderId === user.uid}
            militaryTime={militaryTime}
            onContextMenu={handleSelectMessageAction}
            onLongPress={handleSelectMessageAction}
          />
        ))}
        <div ref={messagesEndRef} />
      </div>

      {!deleteTarget && iBlockedThem && (
        <div className="px-4 py-4 border-t border-white/10 bg-black/60 backdrop-blur-xl">
          <button
            onClick={handleUnblock}
            className="w-full py-3 bg-blue-500 hover:bg-blue-600 rounded-full font-medium"
          >
            Unblock
          </button>
        </div>
      )}

      {!deleteTarget && !iBlockedThem && theyBlockedMe && (
        <div className="px-4 py-4 border-t border-white/10 bg-black/60 backdrop-blur-xl text-center">
          <p className="text-white/60 text-sm">You can't message this user</p>
        </div>
      )}

      {!deleteTarget && !chatFrozen && (
        <ChatInput
          key={matchId}
          focusKey={matchId}
          onSend={handleSend}
          onSendVoice={handleSendVoice}
          onTyping={handleTyping}
          imagePreview={imagePreview}
          onImageSelect={handleImageSelect}
          onClearImage={() => setImagePreview(null)}
        />
      )}

      <AnimatePresence>
        {deleteTarget && (
          <DeleteMessageOverlay
            key={deleteTarget.message.id}
            message={deleteTarget.message}
            originRect={deleteTarget.rect}
            isOwn={deleteTarget.message.senderId === user.uid}
            militaryTime={militaryTime}
            onDelete={handleDeleteMessage}
            onCopy={handleCopyMessage}
            onCancel={() => setDeleteTarget(null)}
          />
        )}
      </AnimatePresence>

      <ImageViewer src={imageViewer} onClose={() => setImageViewer(null)} />

      <ConfirmDialog
        isOpen={confirmAction === 'removeChat'}
        onClose={() => setConfirmAction(null)}
        onConfirm={runConfirmAction}
        title="Remove chat?"
        message="This will delete all messages and hide the chat for both of you."
        confirmLabel="Remove Chat"
        danger
        loading={confirmLoading}
      />

      <Modal isOpen={showProfile} onClose={closeProfile}>
        {otherId && (
          <PublicProfileView
            userId={otherId}
            onClose={closeProfile}
            onBlock={handleBlock}
            fromChat
          />
        )}
      </Modal>
    </div>
  )
}

function MenuItem({ children, onClick, danger = false }) {
  return (
    <button
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
