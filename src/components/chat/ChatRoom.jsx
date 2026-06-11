import { useState, useEffect, useRef, useCallback, useLayoutEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import toast from 'react-hot-toast'
import {
  IconDotsVertical,
  IconBellOff,
  IconBell,
  IconTrash,
  IconSearch,
  IconChevronDown,
  IconX,
} from '@tabler/icons-react'
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
  setMessageReaction,
  touchChatActivity,
} from '../../services/chatService'
import {
  getCachedUser,
  blockUser,
  unblockUser,
  subscribePresence,
  subscribeToUser,
  getUserIdByUsername,
} from '../../services/userService'
import { compressImage, uploadChatImage, uploadChatAudio, getChatStatusLabel, isSavedMessagesChat, buildReplyPayload, normalizeUsername, isRemovedChatOpponent, getRemovedChatUsername, usesMilitaryTime } from '../../utils/helpers'
import {
  navGlassMenuClass,
  contextMenuMotion,
  dropdownMenuClass,
  dropdownMenuItemWithIconClass,
  dropdownMenuItemWithIconDangerClass,
  storyGlassButtonClass,
} from '../../utils/designSystem'
import GlassNavBar from '../layout/GlassNavBar'
import ChevronBack from '../ui/ChevronBack'
import MessageBubble from './MessageBubble'
import DeleteMessageOverlay from './DeleteMessageOverlay'
import ImageViewer from './ImageViewer'
import ChatInput from './ChatInput'
import ChatHeaderCenter from './ChatHeaderCenter'
import {
  findChatSearchMatches,
  groupChatSearchMatches,
  getSearchMessageResultIndex,
} from '../../utils/chatSearch'
import ChatSearchResultsList from './ChatSearchResultsList'
import Modal from '../ui/Modal'
import ConfirmDialog from '../ui/ConfirmDialog'
import { getProfileSnapshots } from '../../services/profileSnapshotCache'
import { preloadAvatarImage } from '../../services/avatarImageCache'
import { PublicProfileView } from '../profile/ProfileView'
import ChatStoryViewer from '../stories/ChatStoryViewer'
import LoadingSpinner from '../ui/LoadingSpinner'

function readCachedOtherUser(userId) {
  if (!userId) return null
  return getCachedUser(userId) || getProfileSnapshots([userId])[userId] || null
}

export default function ChatRoom() {
  const { matchId } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const isDraft = location.state?.draft === true
  const { user, profile, refreshProfile } = useAuth()
  const [messages, setMessages] = useState([])
  const [otherUser, setOtherUser] = useState(null)
  const [otherUserLoaded, setOtherUserLoaded] = useState(false)
  const [trackedOtherId, setTrackedOtherId] = useState(null)
  const [trackedMatchId, setTrackedMatchId] = useState(matchId)
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
  const [profileViewUserId, setProfileViewUserId] = useState(null)
  const [confirmAction, setConfirmAction] = useState(null)
  const [confirmLoading, setConfirmLoading] = useState(false)
  const [savedScrollPosition, setSavedScrollPosition] = useState(0)
  const [replyTo, setReplyTo] = useState(null)
  const [highlightedMessageId, setHighlightedMessageId] = useState(null)
  const [storyViewerTarget, setStoryViewerTarget] = useState(null)
  const [showSearch, setShowSearch] = useState(false)
  const [showSearchResultsList, setShowSearchResultsList] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchMatchIndex, setSearchMatchIndex] = useState(0)
  const [showScrollToBottom, setShowScrollToBottom] = useState(false)
  const messagesEndRef = useRef(null)
  const highlightTimerRef = useRef(null)
  const messagesContainerRef = useRef(null)
  const knownMessageIdsRef = useRef(new Set())
  const typingTimeoutRef = useRef(null)
  const menuButtonRef = useRef(null)
  const chatWasVisibleRef = useRef(false)
  const markReadTimerRef = useRef(null)

  const isSavedMessages =
    isSavedMessagesChat(matchId, user?.uid) || chatMeta?.isSavedMessages === true
  const otherId = isSavedMessages ? null : matchId?.split('_').find((id) => id !== user?.uid)
  const iBlockedThem = !isSavedMessages && profile?.blocked?.includes(otherId)
  const theyBlockedMe = !isSavedMessages && chatMeta?.blockedBy?.includes(otherId) && !iBlockedThem
  const unfriended = !isSavedMessages && chatMeta?.unfriended === true
  const opponentRemoved =
    !isSavedMessages &&
    isRemovedChatOpponent(chatMeta, otherId, otherUser, otherUserLoaded)
  const otherDisplayName = opponentRemoved
    ? getRemovedChatUsername(chatMeta, otherId)
    : otherUser?.username || 'User'
  const chatFrozen = !isSavedMessages && (iBlockedThem || theyBlockedMe || unfriended || opponentRemoved)
  const isMuted = chatMeta?.mutedBy?.includes(user.uid)

  if (otherId !== trackedOtherId) {
    setTrackedOtherId(otherId)
    const initial = readCachedOtherUser(otherId)
    setOtherUser(initial)
    setOtherUserLoaded(Boolean(initial))
    if (initial?.photos?.[0]) {
      preloadAvatarImage(initial.photos[0], 64).catch(() => {})
    }
  }

  if (matchId !== trackedMatchId) {
    setTrackedMatchId(matchId)
    setChatAvailable(false)
    setLoading(true)
    setMessages([])
    setReplyTo(null)
    setShowSearch(false)
    setShowSearchResultsList(false)
    setSearchQuery('')
    setSearchMatchIndex(0)
  }
  const militaryTime = usesMilitaryTime(profile)

  useEffect(() => {
    chatWasVisibleRef.current = false
    knownMessageIdsRef.current = new Set()
  }, [matchId])

  useEffect(() => {
    if (!matchId || !user?.uid) return
    if (isSavedMessagesChat(matchId, user.uid)) {
      ensureSavedMessagesChat(user.uid).catch(() => {})
    }
  }, [matchId, user?.uid])

  useEffect(() => {
    if (!matchId || !user?.uid || isSavedMessages) return
    touchChatActivity(matchId, user.uid).catch(() => {})
  }, [matchId, user?.uid, isSavedMessages, isDraft])

  useEffect(() => {
    if (!otherId || isSavedMessages) return
    return subscribeToUser(otherId, (userData) => {
      setOtherUser(userData)
      setOtherUserLoaded(true)
    })
  }, [otherId, isSavedMessages])

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

  const updateScrollToBottom = useCallback(() => {
    const el = messagesContainerRef.current
    if (!el) return
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight
    setShowScrollToBottom(distanceFromBottom > 100)
  }, [])

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  useEffect(() => {
    const el = messagesContainerRef.current
    if (!el) return

    updateScrollToBottom()
    el.addEventListener('scroll', updateScrollToBottom, { passive: true })
    return () => el.removeEventListener('scroll', updateScrollToBottom)
  }, [updateScrollToBottom, matchId, messages.length])

  useEffect(() => {
    if (deleteTarget) return

    const prevIds = knownMessageIdsRef.current
    const hasNewMessage = messages.some((msg) => !prevIds.has(msg.id))
    knownMessageIdsRef.current = new Set(messages.map((msg) => msg.id))

    if (hasNewMessage) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, deleteTarget])

  const handleTyping = useCallback(
    (typing) => {
      if (!matchId || !user?.uid || chatFrozen) return
      setTyping(matchId, user.uid, typing)
      clearTimeout(typingTimeoutRef.current)
      if (typing) {
        typingTimeoutRef.current = setTimeout(() => setTyping(matchId, user.uid, false), 2000)
      }
    },
    [matchId, user, chatFrozen]
  )

  const handleSend = async ({ text, imageUrl, audioBlob, replyTo: replyPayload }) => {
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
      await sendMessage(matchId, user.uid, {
        text,
        imageUrl: finalImageUrl,
        audioUrl,
        replyTo: replyPayload ? buildReplyPayload(replyPayload) : null,
      })
      setReplyTo(null)
      setTyping(matchId, user.uid, false)
    } catch (err) {
      toast.error(err.message || 'Failed to send message')
    }
  }

  const handleSendVoice = useCallback(
    async (audioBlob) => {
      if (chatFrozen) {
        throw new Error('You cannot send messages in this chat')
      }
      if (!audioBlob?.size) {
        throw new Error('Recording was empty')
      }
      if (!user?.uid || !matchId) {
        throw new Error('You must be signed in to send voice messages')
      }

      if (isSavedMessagesChat(matchId, user.uid)) {
        await ensureSavedMessagesChat(user.uid)
      }

      const audioUrl = await uploadChatAudio(user.uid, matchId, audioBlob)
      if (!audioUrl) {
        throw new Error('Failed to prepare voice message')
      }

      const replyPayload = replyTo ? buildReplyPayload(replyTo) : null
      await sendMessage(matchId, user.uid, {
        text: '',
        imageUrl: null,
        audioUrl,
        replyTo: replyPayload,
      })
      setReplyTo(null)
      setTyping(matchId, user.uid, false)
      requestAnimationFrame(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
      })
    },
    [chatFrozen, user, matchId, replyTo]
  )

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

  const searchMatches = useMemo(
    () => (showSearch && searchQuery.trim() ? findChatSearchMatches(visibleMessages, searchQuery) : []),
    [showSearch, visibleMessages, searchQuery]
  )

  const searchMessageResults = useMemo(
    () => groupChatSearchMatches(searchMatches, visibleMessages),
    [searchMatches, visibleMessages]
  )

  const safeSearchMatchIndex = searchMatches.length
    ? Math.min(searchMatchIndex, searchMatches.length - 1)
    : 0
  const activeSearchMatch = searchMatches[safeSearchMatchIndex] ?? null
  const activeSearchMessageIndex = getSearchMessageResultIndex(searchMessageResults, activeSearchMatch)
  const activeSearchMessageId = activeSearchMatch?.messageId ?? null

  const closeSearch = useCallback(() => {
    setShowSearch(false)
    setShowSearchResultsList(false)
    setSearchQuery('')
    setSearchMatchIndex(0)
  }, [])

  const openSearch = useCallback(() => {
    setShowMenu(false)
    setShowSearch(true)
  }, [])

  const goToOlderSearchMessage = useCallback(() => {
    if (!searchMessageResults.length || !searchMatches.length) return
    setSearchMatchIndex((current) => {
      const currentMatch = searchMatches[Math.min(current, searchMatches.length - 1)]
      const messageIndex = getSearchMessageResultIndex(searchMessageResults, currentMatch)
      const nextMessageIndex = (messageIndex + 1) % searchMessageResults.length
      return searchMessageResults[nextMessageIndex].firstMatchIndex
    })
  }, [searchMessageResults, searchMatches])

  const goToNewerSearchMessage = useCallback(() => {
    if (!searchMessageResults.length || !searchMatches.length) return
    setSearchMatchIndex((current) => {
      const currentMatch = searchMatches[Math.min(current, searchMatches.length - 1)]
      const messageIndex = getSearchMessageResultIndex(searchMessageResults, currentMatch)
      const nextMessageIndex =
        (messageIndex - 1 + searchMessageResults.length) % searchMessageResults.length
      return searchMessageResults[nextMessageIndex].firstMatchIndex
    })
  }, [searchMessageResults, searchMatches])

  const selectSearchMatch = useCallback((matchIndex) => {
    setSearchMatchIndex(matchIndex)
    setShowSearchResultsList(false)
  }, [])

  useEffect(() => {
    if (!showSearch || !activeSearchMatch) return

    const el = messagesContainerRef.current?.querySelector(
      `[data-message-id="${activeSearchMatch.messageId}"]`
    )
    if (!el) return

    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }, [showSearch, activeSearchMatch, safeSearchMatchIndex])

  const handleSelectMessageAction = (message, rect) => {
    if (!rect) return

    setDeleteTarget({ message, rect })

    const row = messagesContainerRef.current?.querySelector(`[data-message-id="${message.id}"]`)
    if (!row) return

    const container = messagesContainerRef.current
    const rowRect = row.getBoundingClientRect()
    const containerRect = container.getBoundingClientRect()
    const spaceBelow = containerRect.bottom - rowRect.bottom

    if (spaceBelow < 220) {
      row.scrollIntoView({ block: 'center', behavior: 'smooth' })

      const updateRect = () => {
        const bubble = row.querySelector('.message-bubble')
        const nextRect = bubble?.getBoundingClientRect() || row.getBoundingClientRect()
        setDeleteTarget((prev) =>
          prev?.message.id === message.id ? { message, rect: nextRect } : prev
        )
      }

      container.addEventListener('scrollend', updateRect, { once: true })
      setTimeout(updateRect, 450)
    }
  }

  const handleReplyToMessage = (message) => {
    setReplyTo(message)
    setDeleteTarget(null)
  }

  const handleStoryReplyClick = (storyReply) => {
    if (!storyReply?.ownerId) return
    setStoryViewerTarget({
      ownerId: storyReply.ownerId,
      storyId: storyReply.storyId || null,
    })
  }

  const handleReactToMessage = async (message, emoji) => {
    if (!matchId || !user?.uid) return
    const reactions = { ...(message.reactions || {}) }
    if (reactions[user.uid] === emoji) {
      delete reactions[user.uid]
    } else {
      reactions[user.uid] = emoji
    }
    const nextReactions = Object.keys(reactions).length ? reactions : undefined

    setMessages((prev) =>
      prev.map((msg) =>
        msg.id === message.id ? { ...msg, reactions: nextReactions } : msg
      )
    )

    setDeleteTarget((prev) => {
      if (!prev || prev.message.id !== message.id) return prev
      return { ...prev, message: { ...prev.message, reactions: nextReactions } }
    })

    try {
      await setMessageReaction(matchId, message.id, user.uid, emoji)
    } catch {
      toast.error('Failed to add reaction')
    }
  }

  const getReplyAuthorName = useCallback(
    (senderId) => {
      if (senderId === user?.uid) return 'You'
      if (isSavedMessages) return 'Saved Messages'
      return otherDisplayName
    },
    [user?.uid, isSavedMessages, otherDisplayName]
  )

  useEffect(() => {
    return () => clearTimeout(highlightTimerRef.current)
  }, [])

  const scrollToMessage = useCallback((messageId) => {
    const el = messagesContainerRef.current?.querySelector(`[data-message-id="${messageId}"]`)
    if (!el) return

    el.scrollIntoView({ behavior: 'smooth', block: 'center' })

    clearTimeout(highlightTimerRef.current)
    setHighlightedMessageId(null)

    requestAnimationFrame(() => {
      setHighlightedMessageId(messageId)
      highlightTimerRef.current = setTimeout(() => {
        setHighlightedMessageId(null)
      }, 1000)
    })
  }, [])

  const chatStatus = opponentRemoved
    ? { text: 'Account deleted', variant: 'offline' }
    : getChatStatusLabel({ isTyping, presence })
  const statusColor =
    chatStatus.variant === 'typing'
      ? 'text-blue-300'
      : chatStatus.variant === 'online'
        ? 'text-green-400'
        : 'text-white/50'

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
      if (isSavedMessages) {
        await ensureSavedMessagesChat(user.uid)
        toast.success('Saved messages cleared')
      } else {
        toast.success('Chat removed')
        navigate('/chats')
      }
    } catch {
      toast.error(isSavedMessages ? 'Failed to clear saved messages' : 'Failed to remove chat')
    }
  }

  const handleBlock = async (targetId) => {
    try {
      await blockUser(user.uid, targetId)
      await refreshProfile()
      toast.success('User blocked')
      setProfileViewUserId(null)
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
    if (!otherId) return
    if (messagesContainerRef.current) {
      setSavedScrollPosition(messagesContainerRef.current.scrollTop)
    }
    setProfileViewUserId(otherId)
  }

  const closeProfile = () => {
    setProfileViewUserId(null)
    requestAnimationFrame(() => {
      if (messagesContainerRef.current) {
        messagesContainerRef.current.scrollTop = savedScrollPosition
      }
    })
  }

  const handleMentionClick = useCallback(
    async (username) => {
      const normalized = normalizeUsername(username)
      if (!normalized) return

      const selfName = normalizeUsername(profile?.username)
      const otherName = normalizeUsername(otherUser?.username)
      let targetId
      if (normalized === selfName) {
        targetId = user.uid
      } else if (normalized === otherName) {
        targetId = otherId
      } else {
        targetId = await getUserIdByUsername(normalized)
      }

      if (!targetId) {
        toast.error('User not found')
        return
      }

      if (messagesContainerRef.current) {
        setSavedScrollPosition(messagesContainerRef.current.scrollTop)
      }
      setDeleteTarget(null)
      setProfileViewUserId(targetId)
    },
    [profile?.username, user, otherUser?.username, otherId]
  )

  const statusText = chatStatus.text
  const statusColorHeader = statusColor

  const headerMenu = createPortal(
    <AnimatePresence onExitComplete={() => setMenuPos(null)}>
      {showMenu && menuPos && (
        <motion.div
          key="chat-header-menu"
          data-chat-header-menu
          {...contextMenuMotion}
          className={`fixed z-[80] ${dropdownMenuClass} ${navGlassMenuClass}`}
          style={{ top: menuPos.top, right: menuPos.right }}
          onClick={(e) => e.stopPropagation()}
        >
          <MenuItem icon={IconSearch} onClick={openSearch}>
            Search
          </MenuItem>
          {!isSavedMessages && (
            <MenuItem icon={isMuted ? IconBell : IconBellOff} onClick={handleMute}>
              {isMuted ? 'Unmute' : 'Mute'}
            </MenuItem>
          )}
          <MenuItem
            icon={IconTrash}
            onClick={() => {
              setShowMenu(false)
              setConfirmAction('removeChat')
            }}
            danger
          >
            {isSavedMessages ? 'Clear chat' : 'Remove Chat'}
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
    <div className="h-full flex flex-col">
      {headerMenu}
      <div className="relative flex-1 min-h-0">
        <div
          ref={messagesContainerRef}
          className={`absolute inset-0 overflow-y-auto px-4 pt-[var(--chat-room-header-height)] pb-[var(--chat-room-composer-min-height)] ${
            deleteTarget ? '!pb-52 pointer-events-none' : ''
          }`}
        >
          {visibleMessages.map((msg) => (
            <MessageBubble
              key={msg.id}
              message={{
                ...msg,
                onImageClick: setImageViewer,
              }}
              isOwn={msg.senderId === user.uid}
              currentUserId={user.uid}
              militaryTime={militaryTime}
              replyAuthorName={msg.replyTo ? getReplyAuthorName(msg.replyTo.senderId) : undefined}
            highlighted={highlightedMessageId === msg.id}
            searchActive={showSearch && activeSearchMatch?.messageId === msg.id}
            searchQuery={showSearch ? searchQuery : ''}
            activeSearchMatch={
              showSearch && activeSearchMatch?.messageId === msg.id ? activeSearchMatch : null
            }
              onReply={handleReplyToMessage}
              onReplyQuoteClick={scrollToMessage}
              onStoryReplyClick={handleStoryReplyClick}
              onReactionClick={handleReactToMessage}
              onContextMenu={handleSelectMessageAction}
              onLongPress={handleSelectMessageAction}
              onMentionClick={handleMentionClick}
            />
          ))}
          <div ref={messagesEndRef} />
        </div>

        <AnimatePresence>
          {showSearch && showSearchResultsList && searchMessageResults.length > 0 && (
            <ChatSearchResultsList
              key="chat-search-results"
              results={searchMessageResults}
              query={searchQuery}
              activeMessageId={activeSearchMessageId}
              currentUserId={user.uid}
              getSenderLabel={getReplyAuthorName}
              militaryTime={militaryTime}
              onSelect={selectSearchMatch}
              onClose={() => setShowSearchResultsList(false)}
            />
          )}
        </AnimatePresence>

        <AnimatePresence>
          {showScrollToBottom && !deleteTarget && !showSearch && (
            <motion.button
              key="scroll-to-bottom"
              type="button"
              initial={{ opacity: 0, scale: 0.85, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.85, y: 8 }}
              transition={{ duration: 0.18 }}
              onClick={scrollToBottom}
              className={`absolute right-4 z-10 ${storyGlassButtonClass}`}
              style={{ bottom: 'calc(var(--chat-room-composer-min-height) + 0.5rem)' }}
              aria-label="Scroll to bottom"
            >
              <IconChevronDown size={20} />
            </motion.button>
          )}
        </AnimatePresence>

        <GlassNavBar liquid className="absolute top-0 inset-x-0 z-20 !bg-transparent pointer-events-none">
          <div className="pointer-events-auto flex items-center w-full gap-2 min-h-11">
            <div
              className={`shrink-0 overflow-hidden transition-[width] duration-300 ${
                showSearch ? 'w-0 pointer-events-none' : 'w-11'
              }`}
            >
              <ChevronBack
                onClick={() => navigate('/chats')}
                buttonClassName={storyGlassButtonClass}
                className="w-5 h-5"
              />
            </div>

            <div className="flex min-w-0 flex-1 justify-center">
              <ChatHeaderCenter
                showSearch={showSearch}
                isSavedMessages={isSavedMessages}
                otherDisplayName={otherDisplayName}
                otherUser={otherUser}
                opponentRemoved={opponentRemoved}
                presence={presence}
                isTyping={isTyping}
                isMuted={isMuted}
                statusText={statusText}
                statusColor={statusColorHeader}
                onOpenProfile={openProfile}
                searchQuery={searchQuery}
                onSearchQueryChange={(value) => {
                  setSearchQuery(value)
                  setSearchMatchIndex(0)
                  setShowSearchResultsList(false)
                }}
                onSearchPrev={goToOlderSearchMessage}
                onSearchNext={goToNewerSearchMessage}
                onSearchClose={closeSearch}
              />
            </div>

            <div className="shrink-0 w-11 flex justify-end">
              {showSearch ? (
                <button
                  type="button"
                  onClick={closeSearch}
                  className={`${storyGlassButtonClass} !p-0 !w-11 !h-11 shrink-0`}
                  aria-label="Close search"
                >
                  <IconX size={20} stroke={2} />
                </button>
              ) : (
                <button
                  ref={menuButtonRef}
                  type="button"
                  onClick={() => setShowMenu((open) => !open)}
                  className={storyGlassButtonClass}
                  aria-label="Chat options"
                >
                  <IconDotsVertical size={20} />
                </button>
              )}
            </div>
          </div>
        </GlassNavBar>

        <div className="absolute bottom-0 inset-x-0 z-20 pointer-events-none bg-transparent">
          <div className="pointer-events-auto bg-transparent">
            {!deleteTarget && iBlockedThem && (
              <div className="px-4 py-4">
                <button
                  onClick={handleUnblock}
                  className="w-full py-3 bg-blue-500 hover:bg-blue-600 rounded-full font-medium"
                >
                  Unblock
                </button>
              </div>
            )}

            {!deleteTarget && !iBlockedThem && theyBlockedMe && (
              <div className="px-4 py-4 text-center">
                <p className="text-white/60 text-sm">You can't message this user</p>
              </div>
            )}

            {!deleteTarget && !iBlockedThem && !theyBlockedMe && unfriended && !opponentRemoved && (
              <div className="px-4 py-4 text-center">
                <p className="text-white/60 text-sm">You are no longer friends — messaging is disabled</p>
              </div>
            )}

            {!deleteTarget && opponentRemoved && (
              <div className="px-4 py-4 text-center">
                <p className="text-white/60 text-sm">This account has been deleted — messaging is disabled</p>
              </div>
            )}

            {!deleteTarget && !chatFrozen && (
              <>
                {isTyping && !isSavedMessages && otherUser && !opponentRemoved && (
                  <div className="px-5 py-2 text-xs text-blue-300/90 italic">
                    {otherUser.username} is typing…
                  </div>
                )}
                <ChatInput
                  key={matchId}
                  focusKey={matchId}
                  chatId={matchId}
                  searchActive={showSearch}
                  searchMatchIndex={activeSearchMessageIndex}
                  searchMatchCount={searchMessageResults.length}
                  onSearchPrev={goToOlderSearchMessage}
                  onSearchNext={goToNewerSearchMessage}
                  onOpenSearchResults={() => setShowSearchResultsList(true)}
                  onSend={handleSend}
                  onSendVoice={handleSendVoice}
                  onTyping={handleTyping}
                  imagePreview={imagePreview}
                  onImageSelect={handleImageSelect}
                  onClearImage={() => setImagePreview(null)}
                  replyTo={replyTo}
                  replyAuthorName={replyTo ? getReplyAuthorName(replyTo.senderId) : undefined}
                  onClearReply={() => setReplyTo(null)}
                />
              </>
            )}
          </div>
        </div>
      </div>

      <AnimatePresence>
        {deleteTarget && (
          <DeleteMessageOverlay
            key={deleteTarget.message.id}
            message={deleteTarget.message}
            originRect={deleteTarget.rect}
            isOwn={deleteTarget.message.senderId === user.uid}
            currentUserId={user.uid}
            militaryTime={militaryTime}
            replyAuthorName={
              deleteTarget.message.replyTo
                ? getReplyAuthorName(deleteTarget.message.replyTo.senderId)
                : undefined
            }
            onDelete={handleDeleteMessage}
            onCopy={handleCopyMessage}
            onReply={handleReplyToMessage}
            onReact={handleReactToMessage}
            onMentionClick={handleMentionClick}
            onCancel={() => setDeleteTarget(null)}
          />
        )}
      </AnimatePresence>

      <ImageViewer src={imageViewer} onClose={() => setImageViewer(null)} />

      <ConfirmDialog
        isOpen={confirmAction === 'removeChat'}
        onClose={() => setConfirmAction(null)}
        onConfirm={runConfirmAction}
        title={isSavedMessages ? 'Clear saved messages?' : 'Remove chat?'}
        message={
          isSavedMessages
            ? 'All saved messages will be deleted. The chat will stay in your list.'
            : 'This will delete all messages and hide the chat for both of you.'
        }
        confirmLabel={isSavedMessages ? 'Clear messages' : 'Remove Chat'}
        danger
        loading={confirmLoading}
      />

      <Modal isOpen={Boolean(profileViewUserId)} onClose={closeProfile} fullscreen>
        {profileViewUserId && (
          <PublicProfileView
            userId={profileViewUserId}
            onClose={closeProfile}
            onBlock={profileViewUserId !== user.uid ? handleBlock : undefined}
            fromChat={profileViewUserId === otherId}
          />
        )}
      </Modal>

      {storyViewerTarget && (
        <ChatStoryViewer
          ownerId={storyViewerTarget.ownerId}
          storyId={storyViewerTarget.storyId}
          onClose={() => setStoryViewerTarget(null)}
        />
      )}
    </div>
  )
}

function MenuItem({ children, onClick, icon: Icon, danger = false }) {
  return (
    <button
      onClick={onClick}
      className={danger ? dropdownMenuItemWithIconDangerClass : dropdownMenuItemWithIconClass}
    >
      {Icon && (
        <Icon size={18} stroke={1.75} className={`shrink-0 ${danger ? 'text-red-400' : 'text-white/55'}`} />
      )}
      {children}
    </button>
  )
}
