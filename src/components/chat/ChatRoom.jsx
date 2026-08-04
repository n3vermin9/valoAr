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
  IconLogout,
  IconSearch,
  IconChevronDown,
  IconX,
  IconSettings,
  IconPin,
} from '@tabler/icons-react'
import { useAuth } from '../../contexts/AuthContext'
import {
  subscribeMessages,
  subscribeChat,
  sendMessage,
  markMessagesRead,
  deleteMessage,
  removeChatForUser,
  setTyping,
  subscribeTyping,
  getUnreadCount,
  ensureSavedMessagesChat,
  setMessageReaction,
  touchChatActivity,
  pinChatMessage,
  unpinChatMessage,
} from '../../services/chatService'
import {
  getCachedUser,
  blockUser,
  unblockUser,
  subscribePresence,
  subscribeToUser,
  getUserIdByUsername,
  fetchUsersMap,
} from '../../services/userService'
import { compressImage, uploadChatImage, uploadChatAudio, getChatStatusLabel, isSavedMessagesChat, buildReplyPayload, normalizeUsername, isRemovedChatOpponent, getRemovedChatUsername, usesMilitaryTime, reportBackgroundError } from '../../utils/helpers'
import { canDirectMessage, getDirectMessageBlockReason } from '../../utils/directMessages'
import {
  navGlassMenuClass,
  contextMenuMotion,
  dropdownMenuClass,
  dropdownMenuItemWithIconClass,
  dropdownMenuItemWithIconDangerClass,
  chatFloatingButtonClass,
  chatRoomTopScrimClass,
  chatRoomMessagesClass,
  chatRoomComposerDockClass,
  chatRoomScrollFabClass,
  chatRoomHeaderClass,
  chatRoomMessagesInnerClass,
  chatRoomMessagesStackClass,
} from '../../utils/designSystem'
import GlassNavBar from '../layout/GlassNavBar'
import ChevronBack from '../ui/ChevronBack'
import MessageBubble from './MessageBubble'
import SystemMessage from './SystemMessage'
import MeetupPinnedInfo from './MeetupPinnedInfo'
import DeleteMessageOverlay from './DeleteMessageOverlay'
import ImageViewer from './ImageViewer'
import ChatInput from './ChatInput'
import ChatBackground from './ChatBackground'
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
import { ChatRoomSkeleton } from '../ui/Skeleton'
import { getChatRoomSnapshot, setChatRoomSnapshot } from '../../services/chatRoomCache'
import {
  isGroupChat,
  getGroupDisplayName,
  getDirectOtherId,
  getOtherParticipantIds,
  isGroupAdmin,
  isGroupMember,
  isGroupMemberMuted,
  getGroupMemberProfileIds,
  canAdmin,
} from '../../utils/groupChat'
import { leaveGroupChat, joinGroupViaButton, joinGroupByInviteCode } from '../../services/groupChatService'
import { cancelMeetup } from '../../services/meetupService'
import { getMessageClusterMeta } from '../../utils/messageCluster'
import { isMeetupInfoMessage } from '../../services/systemChatMessage'
import { getStoryReplyDisplay, storyOpenOriginFromRect } from '../../utils/storyHelpers'
import { isChatMuteActive } from '../../utils/chatMute'
import MuteChatModal from './MuteChatModal'
import UsernameLabel from '../ui/UsernameLabel'
import {
  dismissAppKeyboard,
  getNativeKeyboardHeight,
  getAppKeyboardInset,
} from '../../utils/keyboardFocus'
import useChatBackSwipe from '../../hooks/useChatBackSwipe'
import useChatKeyboardLayout, { CHAT_LAYOUT_SETTLE_MS } from '../../hooks/useChatKeyboardLayout'

function getMessageTimeMs(message) {
  if (message.pending) {
    return message.clientCreatedAt ?? Date.now()
  }
  if (message.clientCreatedAt) return message.clientCreatedAt
  const ts = message.createdAt
  if (!ts) return 0
  if (typeof ts === 'number') return ts
  return ts.toMillis?.() ?? 0
}

function appendOptimisticMessage(prev, optimistic) {
  const serverMsgs = prev.filter((message) => !message.pending)
  const pendingMsgs = [...prev.filter((message) => message.pending), optimistic]
  const latestServerMs = serverMsgs.reduce((max, message) => Math.max(max, getMessageTimeMs(message)), 0)
  const normalized = {
    ...optimistic,
    clientCreatedAt: Math.max(Date.now(), latestServerMs + 1, optimistic.clientCreatedAt ?? 0),
  }
  return mergeServerMessages(
    serverMsgs,
    pendingMsgs.map((message) => (message.id === optimistic.id ? normalized : message)),
    prev
  )
}

function messageMatchesPending(serverMsg, pending) {
  if (serverMsg.senderId !== pending.senderId) return false
  if ((serverMsg.text || '') !== (pending.text || '')) return false
  if ((serverMsg.replyTo?.id || null) !== (pending.replyTo?.id || null)) return false
  if (pending.imageUrl && !serverMsg.imageUrl) return false
  if (pending.audioUrl && !serverMsg.audioUrl) return false
  return true
}

function sameReactionMap(a, b) {
  if (a === b) return true
  if (!a || !b) return !a && !b
  const aKeys = Object.keys(a)
  const bKeys = Object.keys(b)
  if (aKeys.length !== bKeys.length) return false
  for (const key of aKeys) {
    if (a[key] !== b[key]) return false
  }
  return true
}

/** True when UI-visible fields match — keeps list rows from re-rendering on no-op snapshots. */
function sameMessageContent(prev, next) {
  if (prev === next) return true
  if (!prev || !next) return false
  return (
    prev.id === next.id &&
    prev.senderId === next.senderId &&
    prev.text === next.text &&
    prev.imageUrl === next.imageUrl &&
    prev.audioUrl === next.audioUrl &&
    prev.read === next.read &&
    prev.pending === next.pending &&
    prev.type === next.type &&
    prev.systemEvent === next.systemEvent &&
    prev.clientCreatedAt === next.clientCreatedAt &&
    prev.replyTo?.id === next.replyTo?.id &&
    prev.storyReply?.storyId === next.storyReply?.storyId &&
    sameReactionMap(prev.reactions, next.reactions)
  )
}

function mergeServerMessages(serverMsgs, pendingMsgs, prevMsgs = []) {
  const prevById = new Map(prevMsgs.map((message) => [message.id, message]))
  const pending = pendingMsgs.length ? pendingMsgs : null

  const enrichedServer = serverMsgs.map((serverMsg) => {
    let next = serverMsg
    if (pending) {
      const match = pending.find((p) => messageMatchesPending(serverMsg, p))
      if (match?.clientCreatedAt) {
        next = { ...serverMsg, clientCreatedAt: match.clientCreatedAt }
      }
    }
    const existing = prevById.get(serverMsg.id)
    if (existing && sameMessageContent(existing, next)) return existing
    return next
  })

  const unmatched = pending
    ? pending.filter(
        (item) => !enrichedServer.some((serverMsg) => messageMatchesPending(serverMsg, item))
      )
    : []

  const merged =
    unmatched.length === 0
      ? enrichedServer
      : [...enrichedServer, ...unmatched].sort((a, b) => getMessageTimeMs(a) - getMessageTimeMs(b))

  if (
    merged.length === prevMsgs.length &&
    merged.every((message, index) => message === prevMsgs[index])
  ) {
    return prevMsgs
  }
  return merged
}

function readCachedOtherUser(userId) {
  if (!userId) return null
  return getCachedUser(userId) || getProfileSnapshots([userId])[userId] || null
}

export default function ChatRoom() {
  const { matchId } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const isDraft = location.state?.draft === true
  const groupPreviewRequested = location.state?.groupPreview === true
  const previewJoinSlug = location.state?.joinSlug || null
  const previewReturnTo = location.state?.previewReturnTo || '/discover'
  const { user, profile, refreshProfile } = useAuth()
  const roomSnapshot = user?.uid && matchId ? getChatRoomSnapshot(user.uid, matchId) : null
  const [messages, setMessages] = useState(() => roomSnapshot?.messages || [])
  const [otherUser, setOtherUser] = useState(null)
  const [otherUserLoaded, setOtherUserLoaded] = useState(false)
  const [trackedOtherId, setTrackedOtherId] = useState(null)
  const [trackedMatchId, setTrackedMatchId] = useState(matchId)
  const [chatMeta, setChatMeta] = useState(() => roomSnapshot?.chatMeta || null)
  const [chatAvailable, setChatAvailable] = useState(() => Boolean(roomSnapshot?.chatMeta))
  const [loading, setLoading] = useState(() => !roomSnapshot)
  const [isTyping, setIsTyping] = useState(false)
  const [typingUserIds, setTypingUserIds] = useState([])
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
  const [memberProfiles, setMemberProfiles] = useState(() => roomSnapshot?.memberProfiles || {})
  const [showMuteModal, setShowMuteModal] = useState(false)
  const [previewJoining, setPreviewJoining] = useState(false)
  const messagesEndRef = useRef(null)
  const highlightTimerRef = useRef(null)
  const messagesContainerRef = useRef(null)
  const composerDockRef = useRef(null)
  const replyRevealTimerRef = useRef(null)
  const stickToBottomRef = useRef(true)
  const typingTimeoutRef = useRef(null)
  const menuButtonRef = useRef(null)
  const chatWasVisibleRef = useRef(false)
  const markReadTimerRef = useRef(null)
  const messagesRef = useRef(messages)
  const chatMetaRef = useRef(chatMeta)
  const otherUserRef = useRef(otherUser)
  const memberProfilesRef = useRef(memberProfiles)
  const mountAtRef = useRef(Date.now())
  const hadCachedMessagesRef = useRef((roomSnapshot?.messages || []).length > 0)

  const isSavedMessages =
    isSavedMessagesChat(matchId, user?.uid) || chatMeta?.isSavedMessages === true
  const isGroup = isGroupChat(chatMeta)
  const isMeetupChat = isGroup && Boolean(chatMeta?.isMeetup || chatMeta?.meetupId)
  const isMeetupHost = isMeetupChat && chatMeta?.createdBy === user?.uid
  const otherId = isSavedMessages || isGroup ? null : matchId?.split('_').find((id) => id !== user?.uid)
  const iBlockedThem = !isSavedMessages && profile?.blocked?.includes(otherId)
  const theyBlockedMe = !isSavedMessages && chatMeta?.blockedBy?.includes(otherId) && !iBlockedThem
  const areFriends = !isSavedMessages && !isGroup && Boolean(otherId && profile?.matches?.includes(otherId))
  const directMessagesAllowed =
    isSavedMessages ||
    isGroup ||
    areFriends ||
    (otherUserLoaded &&
      canDirectMessage({ myProfile: profile, otherProfile: otherUser, otherId }))
  const directMessageBlockReason =
    !isSavedMessages && !isGroup && otherUserLoaded && !directMessagesAllowed
      ? getDirectMessageBlockReason({
          myProfile: profile,
          otherProfile: otherUser,
          otherId,
          otherUsername: otherDisplayName,
        })
      : null
  const opponentRemoved =
    !isSavedMessages &&
    isRemovedChatOpponent(chatMeta, otherId, otherUser, otherUserLoaded)
  const otherDisplayName = opponentRemoved
    ? getRemovedChatUsername(chatMeta, otherId)
    : otherUser?.username || 'User'
  const chatFrozen =
    !isSavedMessages &&
    ((!isGroup &&
      (iBlockedThem || theyBlockedMe || opponentRemoved || (otherUserLoaded && !directMessagesAllowed))) ||
      (isGroup && isGroupMemberMuted(chatMeta, user?.uid)))
  const isMuted = isChatMuteActive(chatMeta, user.uid)
  const groupName = isGroup ? getGroupDisplayName(chatMeta) : null
  const groupMemberCount = isGroup ? chatMeta?.participants?.length || 0 : 0
  const isGroupMemberUser = isGroup && isGroupMember(chatMeta, user?.uid)
  const isPublicGroup = isGroup && chatMeta?.settings?.visibility === 'public'
  const isGroupPreview =
    groupPreviewRequested && isGroup && isPublicGroup && !isGroupMemberUser
  const canDeleteOthersMessages =
    isGroup && !isGroupPreview && canAdmin(chatMeta, user?.uid, 'deleteMessages')
  const canPinMessages =
    !isGroupPreview &&
    (isGroup
      ? canAdmin(chatMeta, user?.uid, 'deleteMessages') || isGroupAdmin(chatMeta, user?.uid)
      : Boolean(chatMeta?.participants?.includes(user?.uid)))
  const pinnedMeta = chatMeta?.pinnedMessage
  const pinnedMessage = useMemo(
    () => (pinnedMeta?.messageId ? messages.find((m) => m.id === pinnedMeta.messageId) : null),
    [messages, pinnedMeta?.messageId]
  )

  if (otherId !== trackedOtherId) {
    setTrackedOtherId(otherId)
    const initial =
      (roomSnapshot?.otherUser?.id === otherId ? roomSnapshot.otherUser : null) ||
      readCachedOtherUser(otherId)
    setOtherUser(initial)
    setOtherUserLoaded(Boolean(initial))
    if (initial?.photos?.[0]) {
      preloadAvatarImage(initial.photos[0], 64).catch((err) =>
        reportBackgroundError('Chat avatar preload failed', err)
      )
    }
  }

  if (matchId !== trackedMatchId) {
    setTrackedMatchId(matchId)
    const nextSnapshot = user?.uid ? getChatRoomSnapshot(user.uid, matchId) : null
    mountAtRef.current = Date.now()
    hadCachedMessagesRef.current = (nextSnapshot?.messages || []).length > 0
    setChatMeta(nextSnapshot?.chatMeta || null)
    setChatAvailable(Boolean(nextSnapshot?.chatMeta))
    setLoading(!nextSnapshot)
    setMessages(nextSnapshot?.messages || [])
    setMemberProfiles(nextSnapshot?.memberProfiles || {})
    setReplyTo(null)
    setShowSearch(false)
    setShowSearchResultsList(false)
    setSearchQuery('')
    setSearchMatchIndex(0)
  }
  const militaryTime = usesMilitaryTime(profile)

  useEffect(() => {
    document.documentElement.classList.add('chat-room-route', 'chat-room-active')
  }, [matchId])

  useChatKeyboardLayout({
    matchId,
    paneRef: messagesContainerRef,
    dockRef: composerDockRef,
    ready: !(loading && messages.length === 0),
  })

  const closeChat = useCallback(() => {
    void dismissAppKeyboard()
    navigate(isGroupPreview ? previewReturnTo : '/chats')
  }, [navigate, isGroupPreview, previewReturnTo])

  useChatBackSwipe(
    Boolean(matchId) && !deleteTarget && !imageViewer && !storyViewerTarget && !profileViewUserId,
    closeChat
  )

  useEffect(() => {
    messagesRef.current = messages
  }, [messages])

  useEffect(() => {
    chatMetaRef.current = chatMeta
  }, [chatMeta])

  useEffect(() => {
    otherUserRef.current = otherUser
  }, [otherUser])

  useEffect(() => {
    memberProfilesRef.current = memberProfiles
  }, [memberProfiles])

  useEffect(() => {
    if (!user?.uid || !matchId) return
    const timer = window.setTimeout(() => {
      setChatRoomSnapshot(user.uid, matchId, {
        messages: messagesRef.current,
        chatMeta: chatMetaRef.current,
        otherUser: otherUserRef.current,
        memberProfiles: memberProfilesRef.current,
      })
    }, 250)
    return () => window.clearTimeout(timer)
  }, [user?.uid, matchId, messages, chatMeta, otherUser, memberProfiles])

  useEffect(() => {
    chatWasVisibleRef.current = false
  }, [matchId])

  useEffect(() => {
    if (!matchId || !user?.uid) return
    if (isSavedMessagesChat(matchId, user.uid)) {
      ensureSavedMessagesChat(user.uid).catch((err) =>
        reportBackgroundError('Failed to ensure saved messages chat', err)
      )
    }
  }, [matchId, user?.uid])

  useEffect(() => {
    if (!matchId || !user?.uid || isSavedMessages || isGroupPreview) return
    touchChatActivity(matchId, user.uid).catch((err) =>
      reportBackgroundError('Failed to touch chat activity', err)
    )
  }, [matchId, user?.uid, isSavedMessages, isDraft, isGroupPreview])

  const groupSenderIdsKey = useMemo(() => {
    if (!isGroup) return ''
    const ids = new Set()
    for (const msg of messages) {
      if (msg.senderId) ids.add(msg.senderId)
    }
    return [...ids].sort().join(',')
  }, [isGroup, messages])

  useEffect(() => {
    if (!isGroup || !chatMeta) return
    const senderIds = groupSenderIdsKey ? groupSenderIdsKey.split(',') : []
    const ids = getGroupMemberProfileIds(chatMeta, senderIds)
    if (!ids.length) return
    fetchUsersMap(ids).then(setMemberProfiles)
  }, [isGroup, chatMeta, groupSenderIdsKey])

  useEffect(() => {
    if (!otherId || isSavedMessages || isGroup) return
    return subscribeToUser(otherId, (userData) => {
      setOtherUser(userData)
      setOtherUserLoaded(true)
    })
  }, [otherId, isSavedMessages, isGroup])

  useEffect(() => {
    if (!matchId || !user?.uid) return

    const unsubMeta = subscribeChat(matchId, (chat) => {
      const hidden = chat?.hiddenFor?.includes(user.uid)
      const visible = chat && !hidden
      const isGroupChatDoc = isGroupChat(chat)
      const isMember = chat?.participants?.includes(user.uid)
      const isPublic = chat?.settings?.visibility === 'public'

      if (groupPreviewRequested && isGroupChatDoc && !isPublic && visible) {
        navigate('/chats', { replace: true })
        return
      }

      if (groupPreviewRequested && isGroupChatDoc && isPublic && !isMember && visible) {
        chatWasVisibleRef.current = true
        setChatMeta(chat)
        setChatAvailable(true)
        setLoading(false)
        return
      }

      if (visible && (!isGroupChatDoc || isMember)) {
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
  }, [matchId, user?.uid, navigate, isDraft, groupPreviewRequested])

  useEffect(() => {
    if (!isGroup || !chatMeta || !user?.uid || !groupPreviewRequested) return
    if (isGroupMember(chatMeta, user.uid)) {
      navigate(`/chats/${matchId}`, { replace: true, state: {} })
    }
  }, [isGroup, chatMeta, user?.uid, groupPreviewRequested, matchId, navigate])

  useEffect(() => {
    if (!matchId || !user?.uid || !chatAvailable) return

    const scheduleMarkRead = () => {
      if (isGroupPreview) return
      clearTimeout(markReadTimerRef.current)
      markReadTimerRef.current = setTimeout(() => {
        markMessagesRead(matchId, user.uid).catch((err) =>
          reportBackgroundError('Failed to mark messages read', err)
        )
      }, 80)
    }

    const unsub = subscribeMessages(matchId, (msgs) => {
      const age = Date.now() - mountAtRef.current
      const showingCached =
        messagesRef.current.length > 0 || hadCachedMessagesRef.current

      if (msgs.length === 0 && showingCached && age < 2000) {
        setLoading(false)
        return
      }

      setMessages((prev) => {
        const pending = prev.filter((message) => message.pending)
        return mergeServerMessages(msgs, pending, prev)
      })
      setLoading(false)
      if (!isGroupPreview && msgs.some((m) => m.senderId !== user.uid && !m.read)) {
        scheduleMarkRead()
      }
    })

    scheduleMarkRead()
    return () => {
      unsub()
      clearTimeout(markReadTimerRef.current)
      if (!isGroupPreview) {
        markMessagesRead(matchId, user.uid).catch((err) =>
          reportBackgroundError('Failed to mark messages read', err)
        )
      }
    }
  }, [matchId, user?.uid, chatAvailable, isGroupPreview])

  useEffect(() => {
    if (!matchId || !user?.uid || !chatAvailable || isGroupPreview) return

    return subscribeChat(matchId, (chat) => {
      if (getUnreadCount(chat, user.uid) > 0) {
        clearTimeout(markReadTimerRef.current)
        markReadTimerRef.current = setTimeout(() => {
          markMessagesRead(matchId, user.uid).catch((err) =>
            reportBackgroundError('Failed to mark messages read', err)
          )
        }, 80)
      }
    })
  }, [matchId, user?.uid, chatAvailable, isGroupPreview])

  useEffect(() => {
    if (!otherId || isSavedMessages || isGroup) return
    return subscribePresence(otherId, setPresence)
  }, [otherId, isSavedMessages, isGroup])

  useEffect(() => {
    if (!matchId || !user?.uid || isSavedMessages || isGroupPreview || !chatMeta) return

    const participantIds = isGroup
      ? getOtherParticipantIds(chatMeta.participants || [], user.uid)
      : [getDirectOtherId(chatMeta, user.uid)].filter(Boolean)

    if (!participantIds.length) return

    return subscribeTyping(matchId, user.uid, (typing, ids = []) => {
      setIsTyping(typing)
      setTypingUserIds(ids)
    }, { participantIds })
  }, [matchId, user?.uid, isSavedMessages, isGroup, isGroupPreview, chatMeta, chatMeta?.participants?.join(',')])

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
    stickToBottomRef.current = true
  }, [matchId])

  const scrollMessagesToBottom = useCallback((behavior = 'auto') => {
    const el = messagesContainerRef.current
    if (!el) return
    if (behavior === 'smooth') {
      el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
    } else {
      el.scrollTop = el.scrollHeight
    }
  }, [])

  const findMessageEl = useCallback((messageId) => {
    const pane = messagesContainerRef.current
    if (!pane || !messageId) return null
    return pane.querySelector(`[data-message-id="${CSS.escape(messageId)}"]`)
  }, [])

  /**
   * Bring a message into the readable band: below the header, above the composer and
   * keyboard. Scrolls the pane directly — scrollIntoView on iOS can pan the layout
   * viewport and drag the fixed chrome with it.
   */
  const revealMessage = useCallback(
    (messageId, { block = 'end', padding = 12, behavior = 'smooth' } = {}) => {
      const pane = messagesContainerRef.current
      const el = findMessageEl(messageId)
      if (!pane || !el) return false

      const paneRect = pane.getBoundingClientRect()
      const rect = el.getBoundingClientRect()
      // List runs under header + composer; readable band is between those chrome edges.
      const headerBottom =
        document.querySelector('.chat-room-header-pinned')?.getBoundingClientRect().bottom
      const pinBar = document.querySelector('[data-chat-pinned-bar="true"]')
      const pinBottom = pinBar?.getBoundingClientRect().bottom
      const dockTop = composerDockRef.current?.getBoundingClientRect().top
      const chromeTop = Math.max(headerBottom ?? paneRect.top, pinBottom ?? 0)
      const visibleTop = Math.max(paneRect.top, chromeTop) + padding
      const visibleBottom =
        Math.min(paneRect.bottom, dockTop ?? paneRect.bottom) - padding
      const visibleHeight = visibleBottom - visibleTop

      let delta = 0
      if (block === 'center' && rect.height < visibleHeight) {
        delta = rect.top + rect.height / 2 - (visibleTop + visibleHeight / 2)
      } else if (rect.bottom > visibleBottom) {
        delta = rect.bottom - visibleBottom
      } else if (rect.top < visibleTop) {
        delta = rect.top - visibleTop
      }
      if (Math.abs(delta) < 1) return false

      const max = Math.max(0, pane.scrollHeight - pane.clientHeight)
      const next = Math.max(0, Math.min(max, Math.round(pane.scrollTop + delta)))
      if (Math.abs(next - pane.scrollTop) < 1) return false

      if (behavior === 'smooth') pane.scrollTo({ top: next, behavior: 'smooth' })
      else pane.scrollTop = next
      return true
    },
    [findMessageEl]
  )

  const updateScrollToBottom = useCallback(() => {
    const el = messagesContainerRef.current
    if (!el) return
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight
    stickToBottomRef.current = distanceFromBottom <= 120
    setShowScrollToBottom((prev) => {
      const next = distanceFromBottom > 100
      return prev === next ? prev : next
    })
  }, [])

  const scrollToBottom = useCallback(() => {
    stickToBottomRef.current = true
    scrollMessagesToBottom('smooth')
  }, [scrollMessagesToBottom])

  useEffect(() => {
    const el = messagesContainerRef.current
    if (!el) return

    // Dismiss keyboard on vertical scroll only — blurring on pointerdown cancels
    // the touch sequence on iOS and breaks swipe-right to close.
    let touching = false
    let scrollRaf = 0
    const keyboardOpen = () => getNativeKeyboardHeight() > 0 || getAppKeyboardInset() > 0
    const dismissIfOpen = () => {
      if (keyboardOpen()) void dismissAppKeyboard()
    }

    const onPointerDown = () => {
      touching = true
    }
    const onPointerUp = () => {
      touching = false
    }
    const onScroll = () => {
      if (scrollRaf) return
      scrollRaf = requestAnimationFrame(() => {
        scrollRaf = 0
        updateScrollToBottom()
      })
      if (touching) dismissIfOpen()
    }
    const onWheel = () => {
      dismissIfOpen()
    }

    updateScrollToBottom()
    el.addEventListener('pointerdown', onPointerDown, { passive: true })
    el.addEventListener('pointerup', onPointerUp, { passive: true })
    el.addEventListener('pointercancel', onPointerUp, { passive: true })
    el.addEventListener('scroll', onScroll, { passive: true })
    el.addEventListener('wheel', onWheel, { passive: true })
    return () => {
      if (scrollRaf) cancelAnimationFrame(scrollRaf)
      el.removeEventListener('pointerdown', onPointerDown)
      el.removeEventListener('pointerup', onPointerUp)
      el.removeEventListener('pointercancel', onPointerUp)
      el.removeEventListener('scroll', onScroll)
      el.removeEventListener('wheel', onWheel)
    }
  }, [updateScrollToBottom, matchId])

  useEffect(() => {
    const el = messagesContainerRef.current
    if (!el) return undefined

    const observer = new ResizeObserver(() => {
      if (!stickToBottomRef.current) return
      el.scrollTop = el.scrollHeight
    })
    observer.observe(el)

    return () => observer.disconnect()
  }, [matchId, loading])

  const lastThreadKey = `${messages.length}:${messages[messages.length - 1]?.id ?? ''}`

  // Only jump to bottom when the thread grows / last id changes — not on read receipts.
  useLayoutEffect(() => {
    if (deleteTarget) return
    if (!stickToBottomRef.current) return
    scrollMessagesToBottom('auto')
  }, [lastThreadKey, deleteTarget, scrollMessagesToBottom])

  useLayoutEffect(() => {
    if (loading) return
    stickToBottomRef.current = true
    scrollMessagesToBottom('auto')
  }, [matchId, loading, scrollMessagesToBottom])

  const handleOpenImage = useCallback((url, rect) => {
    setImageViewer({
      src: url,
      origin: storyOpenOriginFromRect(rect),
    })
  }, [])

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

    const replyData = replyPayload ? buildReplyPayload(replyPayload) : null
    const needsUpload = Boolean(imageUrl?.startsWith('data:') || audioBlob)
    if (needsUpload) {
      stickToBottomRef.current = true
    }
    let optimisticId = null

    if (!needsUpload) {
      optimisticId = `pending_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
      setReplyTo(null)
      setTyping(matchId, user.uid, false)
      const optimistic = {
        id: optimisticId,
        senderId: user.uid,
        text: text || null,
        imageUrl: imageUrl || null,
        audioUrl: null,
        replyTo: replyData,
        createdAt: null,
        clientCreatedAt: Date.now(),
        pending: true,
        read: isSavedMessages,
      }
      stickToBottomRef.current = true
      setMessages((prev) => appendOptimisticMessage(prev, optimistic))
    }

    try {
      let finalImageUrl = imageUrl
      if (imageUrl?.startsWith('data:')) {
        finalImageUrl = await uploadChatImage(user.uid, matchId, imageUrl)
      }
      let audioUrl = null
      if (audioBlob) {
        audioUrl = await uploadChatAudio(user.uid, matchId, audioBlob)
      }
      await sendMessage(
        matchId,
        user.uid,
        {
          text,
          imageUrl: finalImageUrl,
          audioUrl,
          replyTo: replyData,
        },
        {
          chatData: chatMeta,
          skipEnsureVisible: chatAvailable,
        }
      )
      stickToBottomRef.current = true
      if (needsUpload) {
        setReplyTo(null)
        setTyping(matchId, user.uid, false)
      }
    } catch (err) {
      if (optimisticId) {
        setMessages((prev) => prev.filter((message) => message.id !== optimisticId))
      }
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

      stickToBottomRef.current = true

      if (isSavedMessagesChat(matchId, user.uid)) {
        await ensureSavedMessagesChat(user.uid)
      }

      const audioUrl = await uploadChatAudio(user.uid, matchId, audioBlob)
      if (!audioUrl) {
        throw new Error('Failed to prepare voice message')
      }

      const replyPayload = replyTo ? buildReplyPayload(replyTo) : null
      stickToBottomRef.current = true
      await sendMessage(
        matchId,
        user.uid,
        {
          text: '',
          imageUrl: null,
          audioUrl,
          replyTo: replyPayload,
        },
        {
          chatData: chatMeta,
          skipEnsureVisible: chatAvailable,
        }
      )
      setReplyTo(null)
      setTyping(matchId, user.uid, false)
    },
    [chatFrozen, user, matchId, replyTo, chatMeta, chatAvailable]
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
      await deleteMessage(matchId, message.id, user.uid)
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
    setDeleteTarget(null)
    try {
      await navigator.clipboard.writeText(content)
      toast.success('Copied!')
    } catch {
      toast.error('Failed to copy')
    }
  }

  const visibleMessages = messages.filter((msg) => !removedMessageIds.has(msg.id))
  const hasMeetupInfoMessage = useMemo(
    () => visibleMessages.some((msg) => isMeetupInfoMessage(msg)),
    [visibleMessages]
  )
  const actionTargetIndex = deleteTarget
    ? visibleMessages.findIndex((msg) => msg.id === deleteTarget.message.id)
    : -1
  const actionTargetCluster =
    actionTargetIndex >= 0
      ? getMessageClusterMeta(visibleMessages, actionTargetIndex, user.uid, isGroup)
      : null
  const actionTargetSenderProfile =
    deleteTarget && isGroup ? memberProfiles[deleteTarget.message.senderId] : null

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

  useEffect(() => {
    if (!location.state?.openSearch) return
    setShowSearch(true)
    navigate(location.pathname, {
      replace: true,
      state: location.state?.draft ? { draft: true } : undefined,
    })
  }, [location.key, location.pathname, location.state, navigate])

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

    stickToBottomRef.current = false
    revealMessage(activeSearchMatch.messageId, { block: 'center' })
  }, [showSearch, activeSearchMatch, safeSearchMatchIndex, revealMessage])

  const handleSelectMessageAction = useCallback((message, rect) => {
    if (!rect) return
    setDeleteTarget({ message, rect })
  }, [])

  const handleReplyToMessage = useCallback((message) => {
    setReplyTo(message)
    setDeleteTarget(null)
    if (!message?.id) return

    // The list rides up with the keyboard on its own, so wait for the reply bar and
    // the keyboard to settle, then place the quoted message clear of the composer.
    // Scrolling earlier would fight the keyboard-follow loop mid-animation.
    const last = messagesRef.current[messagesRef.current.length - 1]
    if (last && last.id !== message.id) stickToBottomRef.current = false
    clearTimeout(replyRevealTimerRef.current)
    replyRevealTimerRef.current = setTimeout(() => {
      revealMessage(message.id, { padding: 16 })
    }, CHAT_LAYOUT_SETTLE_MS + 40)
  }, [revealMessage])

  const handleStoryReplyClick = useCallback((storyReply, originEvent) => {
    if (!storyReply?.ownerId) return
    const rect = originEvent?.currentTarget?.getBoundingClientRect?.()
    setStoryViewerTarget({
      ownerId: storyReply.ownerId,
      storyId: storyReply.storyId || null,
      origin: rect ? storyOpenOriginFromRect(rect) : null,
    })
  }, [])

  const handleReactToMessage = useCallback(async (message, emoji) => {
    if (!matchId || !user?.uid) return
    const previousReactions = message.reactions
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
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === message.id ? { ...msg, reactions: previousReactions } : msg
        )
      )
      setDeleteTarget((prev) => {
        if (!prev || prev.message.id !== message.id) return prev
        return { ...prev, message: { ...prev.message, reactions: previousReactions } }
      })
      toast.error('Failed to add reaction')
    }
  }, [matchId, user?.uid])

  const getReplyAuthorName = useCallback(
    (senderId) => {
      if (senderId === user?.uid) return 'You'
      if (isSavedMessages) return 'Saved Messages'
      if (isGroup) return memberProfiles[senderId]?.username || 'User'
      return otherDisplayName
    },
    [user.uid, isSavedMessages, isGroup, memberProfiles, otherDisplayName]
  )

  useEffect(() => {
    return () => {
      clearTimeout(highlightTimerRef.current)
      clearTimeout(replyRevealTimerRef.current)
    }
  }, [])

  const scrollToMessage = useCallback((messageId) => {
    if (!findMessageEl(messageId)) return

    stickToBottomRef.current = false
    revealMessage(messageId, { block: 'center' })

    clearTimeout(highlightTimerRef.current)
    setHighlightedMessageId(null)

    requestAnimationFrame(() => {
      setHighlightedMessageId(messageId)
      highlightTimerRef.current = setTimeout(() => {
        setHighlightedMessageId(null)
      }, 1000)
    })
  }, [findMessageEl, revealMessage])

  const chatStatus = opponentRemoved
    ? { text: 'Account deleted', variant: 'offline' }
    : isGroup
      ? {
          text: `${groupMemberCount} member${groupMemberCount === 1 ? '' : 's'}`,
          variant: 'offline',
        }
      : getChatStatusLabel({ isTyping: false, presence })
  const typingHeaderText = (() => {
    if (!isTyping) return ''
    if (isGroup) {
      if (typingUserIds.length === 1) {
        const username = memberProfiles[typingUserIds[0]]?.username
        return username ? `${username} is typing…` : 'Someone is typing…'
      }
      return typingUserIds.length > 1 ? 'Several people are typing…' : 'Someone is typing…'
    }
    return 'typing…'
  })()
  const statusColor =
    chatStatus.variant === 'online'
      ? 'text-green-400'
      : 'text-white/50'

  const handleMute = () => {
    setShowMenu(false)
    setShowMuteModal(true)
  }

  const handleLeaveGroup = async () => {
    try {
      await leaveGroupChat(matchId, user.uid)
      navigate('/chats')
    } catch {
      toast.error('Failed to leave group')
    }
  }

  const handleCancelMeetup = async () => {
    const meetupId = chatMeta?.meetupId
    if (!meetupId) {
      await handleLeaveGroup()
      return
    }
    try {
      await cancelMeetup(meetupId, user.uid)
      toast.success(isMeetupHost ? 'Meetup cancelled' : 'Left meetup')
      navigate('/chats')
    } catch (err) {
      toast.error(err.message || 'Failed to cancel meetup')
    }
  }

  const handleRemoveChat = async () => {
    try {
      if (isSavedMessages) {
        await removeChatForUser(matchId, user.uid)
        await ensureSavedMessagesChat(user.uid)
        toast.success('Saved messages cleared')
      } else {
        await removeChatForUser(matchId, user.uid)
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
      if (confirmAction === 'leaveGroup') {
        await handleLeaveGroup()
      } else if (confirmAction === 'cancelMeetup') {
        await handleCancelMeetup()
      } else if (confirmAction === 'removeChat') {
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
    if (isGroupPreview) {
      navigate(`/groups/${matchId}`, {
        state: {
          fromChatPreview: true,
          returnTo: `/chats/${matchId}`,
          joinSlug: previewJoinSlug || undefined,
          previewReturnTo,
        },
      })
      return
    }
    if (isGroup) {
      navigate(`/groups/${matchId}`, { state: { fromChat: true, returnTo: `/chats/${matchId}` } })
      return
    }
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

  const openMemberProfile = useCallback(
    (memberId) => {
      if (!memberId) return
      if (messagesContainerRef.current) {
        setSavedScrollPosition(messagesContainerRef.current.scrollTop)
      }
      setDeleteTarget(null)
      setProfileViewUserId(memberId)
    },
    []
  )

  const handleMentionClick = useCallback(
    async (username) => {
      const normalized = normalizeUsername(username)
      if (!normalized) return

      if (isGroup) {
        const memberEntry = Object.entries(memberProfiles).find(
          ([, memberProfile]) => normalizeUsername(memberProfile?.username) === normalized
        )
        if (memberEntry) {
          openMemberProfile(memberEntry[0])
          return
        }
      }

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

      openMemberProfile(targetId)
    },
    [isGroup, memberProfiles, openMemberProfile, profile?.username, user.uid, otherUser?.username, otherId]
  )

  const handlePreviewJoin = async () => {
    if (!user?.uid || !matchId) return
    setPreviewJoining(true)
    try {
      const result = previewJoinSlug
        ? await joinGroupByInviteCode(previewJoinSlug, user.uid, profile?.username)
        : await joinGroupViaButton(matchId, user.uid, profile?.username)
      if (result.status === 'pending') {
        toast.success('Join request sent')
        return
      }
      toast.success('Joined group')
      navigate(`/chats/${matchId}`, { replace: true, state: {} })
    } catch (err) {
      toast.error(err.message || 'Failed to join group')
    } finally {
      setPreviewJoining(false)
    }
  }

  const handlePinMessage = async (message) => {
    if (!matchId || !canPinMessages) return
    setDeleteTarget(null)
    try {
      await pinChatMessage(matchId, user.uid, message.id, chatMeta)
      toast.success('Message pinned')
    } catch (err) {
      toast.error(err.message || 'Failed to pin message')
    }
  }

  const handleUnpinMessage = async () => {
    if (!matchId || !canPinMessages) return
    setDeleteTarget(null)
    try {
      await unpinChatMessage(matchId, user.uid, chatMeta)
      toast.success('Message unpinned')
    } catch (err) {
      toast.error(err.message || 'Failed to unpin message')
    }
  }

  const statusText = chatStatus.text
  const statusColorHeader = statusColor

  const headerMenu = createPortal(
    <AnimatePresence onExitComplete={() => setMenuPos(null)}>
      {showMenu && menuPos && !profileViewUserId && (
        <motion.div
          key="chat-header-menu"
          data-chat-room-portal
          data-chat-id={matchId}
          data-chat-header-menu
          {...contextMenuMotion}
          className={`fixed z-[80] ${dropdownMenuClass} ${navGlassMenuClass}`}
          style={{ top: menuPos.top, right: menuPos.right }}
          onClick={(e) => e.stopPropagation()}
        >
          <MenuItem icon={IconSearch} onClick={openSearch}>
            Search
          </MenuItem>
          {isGroup && isGroupAdmin(chatMeta, user?.uid) && (
            <MenuItem icon={IconSettings} onClick={() => { setShowMenu(false); navigate(`/groups/${matchId}/settings`, { state: { fromChat: true, returnTo: `/chats/${matchId}` } }) }}>
              Group settings
            </MenuItem>
          )}
          {!isSavedMessages && (
            <MenuItem icon={isMuted ? IconBell : IconBellOff} onClick={handleMute}>
              {isMuted ? 'Unmute' : 'Mute'}
            </MenuItem>
          )}
          {isGroup ? (
            <MenuItem
              icon={IconLogout}
              onClick={() => {
                setShowMenu(false)
                setConfirmAction(isMeetupChat ? 'cancelMeetup' : 'leaveGroup')
              }}
              danger
            >
              {isMeetupChat ? (isMeetupHost ? 'Cancel meetup' : 'Leave meetup') : 'Leave group'}
            </MenuItem>
          ) : (
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
          )}
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  )

  // Solid portal (no opacity motion) — avoids blink from showChatPortals fighting Framer.
  const headerPortal =
    !profileViewUserId &&
    createPortal(
      <div data-chat-room-portal data-chat-id={matchId}>
        <div aria-hidden className={chatRoomTopScrimClass} />
        <GlassNavBar liquid className={chatRoomHeaderClass}>
          <div className="pointer-events-auto flex items-center w-full gap-2.5 h-12">
            <div
              className={`shrink-0 overflow-hidden transition-[width] duration-300 ${
                showSearch ? 'w-0 pointer-events-none' : 'w-12'
              }`}
            >
              <ChevronBack
                onClick={() => (isGroupPreview ? navigate(previewReturnTo) : navigate('/chats'))}
                buttonClassName={`${chatFloatingButtonClass} text-white/80`}
                className="w-6 h-6"
              />
            </div>

            <div className="flex min-w-0 flex-1 justify-center">
              <ChatHeaderCenter
                showSearch={showSearch}
                isSavedMessages={isSavedMessages}
                isGroupChat={isGroup}
                groupName={groupName}
                groupPhotoUrl={chatMeta?.photoUrl}
                otherDisplayName={otherDisplayName}
                otherUser={otherUser}
                opponentRemoved={opponentRemoved}
                presence={presence}
                isTyping={isTyping}
                isMuted={isGroupPreview ? false : isMuted}
                isTemporary={chatMeta?.isMeetup || Boolean(chatMeta?.expiresAt)}
                statusText={statusText}
                typingText={typingHeaderText}
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

            <div className="shrink-0 w-12 flex justify-end">
              {showSearch ? (
                <button
                  type="button"
                  onClick={closeSearch}
                  className={`${chatFloatingButtonClass} text-white/80 shrink-0`}
                  aria-label="Close search"
                >
                  <IconX size={22} stroke={2} />
                </button>
              ) : isGroupPreview ? (
                <span className="w-12 h-12 shrink-0" aria-hidden />
              ) : (
                <button
                  ref={menuButtonRef}
                  type="button"
                  onClick={() => setShowMenu((open) => !open)}
                  className={`${chatFloatingButtonClass} text-white/80`}
                  aria-label="Chat options"
                >
                  <IconDotsVertical size={22} />
                </button>
              )}
            </div>
          </div>
        </GlassNavBar>
      </div>,
      document.body
    )

  if (loading && messages.length === 0) {
    return (
      <>
        {headerPortal}
        <div className="h-full">
          <ChatRoomSkeleton />
        </div>
      </>
    )
  }

  return (
    <>
      {headerPortal}
    <div className="h-full flex flex-col">
      {headerMenu}
      <div className="relative flex-1 min-h-0">
        <ChatBackground profile={profile} className="absolute inset-0" />
        {pinnedMessage ? (
          <div
            data-chat-room-chrome
            className="pointer-events-none fixed inset-x-0 z-[35] flex justify-center px-[var(--chat-room-page-x)]"
            style={{ top: 'calc(var(--vv-top, 0px) + var(--chat-room-header-height) + 6px)' }}
            data-chat-pinned-bar="true"
          >
            <button
              type="button"
              onClick={() => scrollToMessage(pinnedMessage.id)}
              className="pointer-events-auto w-[90%] max-w-full text-left rounded-[var(--ios-radius-lg)] border border-white/10 bg-[var(--ios-bg-secondary)]/92 px-3 py-2.5 flex items-center gap-2 shadow-[0_8px_20px_rgba(0,0,0,0.35)]"
            >
              <IconPin size={16} className="text-[var(--ios-blue)] shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium text-[var(--ios-blue)]">
                  {isMeetupInfoMessage(pinnedMessage) ? 'Pinned meetup' : 'Pinned message'}
                </p>
                <p className="text-sm text-white/85 truncate mt-0.5">
                  {getStoryReplyDisplay(pinnedMessage).text ||
                    (pinnedMessage.imageUrl
                      ? 'Photo'
                      : pinnedMessage.audioUrl
                        ? 'Voice message'
                        : 'Message')}
                </p>
              </div>
              {canPinMessages && !isMeetupInfoMessage(pinnedMessage) && (
                <span
                  role="button"
                  tabIndex={0}
                  onClick={(e) => {
                    e.stopPropagation()
                    handleUnpinMessage()
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      e.stopPropagation()
                      handleUnpinMessage()
                    }
                  }}
                  className="shrink-0 self-center flex items-center justify-center p-1 text-white/45 hover:text-white/70"
                  aria-label="Unpin message"
                >
                  <IconX size={16} />
                </span>
              )}
            </button>
          </div>
        ) : null}
        <div
          ref={messagesContainerRef}
          data-chat-room-chrome
          className={`${chatRoomMessagesClass} ${
            deleteTarget ? 'pointer-events-none' : ''
          }`}
        >
          <div
            className={chatRoomMessagesInnerClass}
            style={
              pinnedMessage
                ? { paddingTop: 'calc(var(--chat-room-header-height) + 64px)' }
                : undefined
            }
          >
            <div className={chatRoomMessagesStackClass}>
          {isMeetupChat && !hasMeetupInfoMessage ? (
            <MeetupPinnedInfo
              meetupId={chatMeta?.meetupId}
              chat={chatMeta}
              profile={profile}
            />
          ) : null}
          {visibleMessages.map((msg, index) => {
            if (isMeetupInfoMessage(msg)) {
              return (
                <MeetupPinnedInfo
                  key={msg.id}
                  message={msg}
                  meetupId={chatMeta?.meetupId || msg.meetupId}
                  chat={chatMeta}
                  profile={profile}
                  actionHidden={deleteTarget?.message.id === msg.id}
                  readOnly={isGroupPreview}
                  onContextMenu={isGroupPreview ? undefined : handleSelectMessageAction}
                  onLongPress={isGroupPreview ? undefined : handleSelectMessageAction}
                  onReply={isGroupPreview ? undefined : handleReplyToMessage}
                />
              )
            }
            if (msg.type === 'system' || msg.systemEvent) {
              return <SystemMessage key={msg.id} text={msg.text} />
            }
            const cluster = getMessageClusterMeta(visibleMessages, index, user.uid, isGroup)
            const senderProfile = isGroup ? memberProfiles[msg.senderId] : null
            return (
            <MessageBubble
              key={msg.id}
              message={msg}
              onImageClick={isGroupPreview ? undefined : handleOpenImage}
              isOwn={msg.senderId === user.uid}
              currentUserId={user.uid}
              militaryTime={militaryTime}
              isGroupChat={isGroup}
              showAvatar={cluster.showAvatar}
              showSenderNameInBubble={cluster.showSenderNameInBubble}
              tightBottom={cluster.tightBottom}
              senderAvatar={senderProfile?.photos?.[0]}
              replyAuthorName={msg.replyTo ? getReplyAuthorName(msg.replyTo.senderId) : undefined}
              senderName={
                isGroup && msg.senderId !== user.uid && cluster.showSenderNameInBubble
                  ? senderProfile?.username || 'User'
                  : undefined
              }
              groupChat={isGroup && cluster.showSenderNameInBubble ? chatMeta : undefined}
              senderId={isGroup ? msg.senderId : undefined}
              onSenderClick={isGroup ? openMemberProfile : undefined}
              readOnly={isGroupPreview}
              actionHidden={deleteTarget?.message.id === msg.id}
              highlighted={highlightedMessageId === msg.id}
              searchActive={showSearch && activeSearchMatch?.messageId === msg.id}
              searchQuery={showSearch ? searchQuery : ''}
              activeSearchMatch={
                showSearch && activeSearchMatch?.messageId === msg.id ? activeSearchMatch : null
              }
              onReply={isGroupPreview ? undefined : handleReplyToMessage}
              onReplyQuoteClick={isGroupPreview ? undefined : scrollToMessage}
              onStoryReplyClick={isGroupPreview ? undefined : handleStoryReplyClick}
              onReactionClick={isGroupPreview ? undefined : handleReactToMessage}
              onContextMenu={isGroupPreview ? undefined : handleSelectMessageAction}
              onLongPress={isGroupPreview ? undefined : handleSelectMessageAction}
              onMentionClick={handleMentionClick}
            />
            )
          })}
          <div ref={messagesEndRef} />
            </div>
          </div>
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
              data-chat-room-chrome
              initial={{ opacity: 0, scale: 0.85, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.85, y: 8 }}
              transition={{ duration: 0.18 }}
              onClick={scrollToBottom}
              className={`${chatRoomScrollFabClass} ${chatFloatingButtonClass} text-white/80`}
              aria-label="Scroll to bottom"
            >
              <IconChevronDown size={22} />
            </motion.button>
          )}
        </AnimatePresence>

        <div
          ref={composerDockRef}
          data-chat-composer="true"
          data-chat-room-chrome
          className={chatRoomComposerDockClass}
        >
          <div className={`pointer-events-auto ${deleteTarget ? 'pointer-events-none' : ''}`}>
            {iBlockedThem && (
              <div className="px-4 py-4">
                <button
                  onClick={handleUnblock}
                  className="w-full py-3 bg-blue-500 hover:bg-blue-600 rounded-full font-medium"
                >
                  Unblock
                </button>
              </div>
            )}

            {!iBlockedThem && theyBlockedMe && (
              <div className="px-4 py-4 text-center">
                <p className="text-white/60 text-sm">You can't message this user</p>
              </div>
            )}

            {!iBlockedThem && !theyBlockedMe && directMessageBlockReason && !opponentRemoved && (
              <div className="px-4 py-4 text-center space-y-3">
                <p className="text-white/60 text-sm">{directMessageBlockReason.message}</p>
                {directMessageBlockReason.showSettingsLink && (
                  <button
                    type="button"
                    onClick={() => navigate('/profile', { state: { openSettings: true } })}
                    className="text-sm font-medium text-[var(--ios-blue)]"
                  >
                    Open message settings
                  </button>
                )}
              </div>
            )}

            {opponentRemoved && (
              <div className="px-4 py-4 text-center">
                <p className="text-white/60 text-sm">This account has been deleted — messaging is disabled</p>
              </div>
            )}

            {isGroup && isGroupMemberMuted(chatMeta, user?.uid) && (
              <div className="px-4 py-4 text-center">
                <p className="text-white/60 text-sm">You are muted in this group — messaging is disabled</p>
              </div>
            )}

            {!chatFrozen && !isGroupPreview && (
              <>
                {isTyping && !isSavedMessages && !isGroup && otherUser && !opponentRemoved && (
                  <div className="px-5 py-2 text-xs text-blue-300/90 italic flex items-center gap-1">
                    <UsernameLabel username={otherUser.username} className="text-xs italic" badgeSize={10} />
                    <span>is typing…</span>
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

            {isGroupPreview && (
              <div className="px-4 pt-3 pb-3">
                <button
                  type="button"
                  onClick={handlePreviewJoin}
                  disabled={previewJoining}
                  className="w-full flex items-center justify-center gap-2 py-3 bg-blue-500 hover:bg-blue-600 disabled:opacity-50 rounded-full transition-colors font-medium"
                >
                  {previewJoining ? 'Joining…' : 'Join chat'}
                </button>
              </div>
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
            canDelete={
              !isMeetupInfoMessage(deleteTarget.message) &&
              (deleteTarget.message.senderId === user.uid || canDeleteOthersMessages)
            }
            canPin={canPinMessages && !isMeetupInfoMessage(deleteTarget.message)}
            isPinned={pinnedMeta?.messageId === deleteTarget.message.id}
            onPin={handlePinMessage}
            onUnpin={handleUnpinMessage}
            currentUserId={user.uid}
            militaryTime={militaryTime}
            replyAuthorName={
              deleteTarget.message.replyTo
                ? getReplyAuthorName(deleteTarget.message.replyTo.senderId)
                : undefined
            }
            isGroupChat={isGroup}
            senderName={
              isGroup &&
              deleteTarget.message.senderId !== user.uid &&
              actionTargetCluster?.showSenderNameInBubble
                ? actionTargetSenderProfile?.username || 'User'
                : undefined
            }
            senderAvatar={actionTargetSenderProfile?.photos?.[0]}
            showSenderNameInBubble={actionTargetCluster?.showSenderNameInBubble ?? false}
            showAvatar={actionTargetCluster?.showAvatar ?? false}
            tightBottom={actionTargetCluster?.tightBottom ?? false}
            groupChat={isGroup ? chatMeta : undefined}
            senderId={isGroup ? deleteTarget.message.senderId : undefined}
            onDelete={handleDeleteMessage}
            onCopy={handleCopyMessage}
            onReply={handleReplyToMessage}
            onReact={handleReactToMessage}
            onMentionClick={handleMentionClick}
            onCancel={() => setDeleteTarget(null)}
          />
        )}
      </AnimatePresence>

      <ImageViewer
        src={imageViewer?.src}
        openOrigin={imageViewer?.origin}
        onClose={() => setImageViewer(null)}
      />

      <ConfirmDialog
        isOpen={confirmAction === 'leaveGroup'}
        onClose={() => setConfirmAction(null)}
        onConfirm={runConfirmAction}
        title="Leave group?"
        message="You will leave this group. Chat history stays in the group for other members."
        confirmLabel="Leave group"
        danger
        loading={confirmLoading}
      />

      <ConfirmDialog
        isOpen={confirmAction === 'cancelMeetup'}
        onClose={() => setConfirmAction(null)}
        onConfirm={runConfirmAction}
        title={isMeetupHost ? 'Cancel meetup?' : 'Leave meetup?'}
        message={
          isMeetupHost
            ? 'This will end the meetup for everyone and delete the group chat.'
            : 'You will leave this meetup and its group chat.'
        }
        confirmLabel={isMeetupHost ? 'Cancel meetup' : 'Leave meetup'}
        danger
        loading={confirmLoading}
      />

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
          openOrigin={storyViewerTarget.origin}
          onClose={() => setStoryViewerTarget(null)}
        />
      )}

      <MuteChatModal
        isOpen={showMuteModal}
        onClose={() => setShowMuteModal(false)}
        chatId={matchId}
        chat={chatMeta}
        userId={user?.uid}
        title={isGroup ? 'Group notifications' : 'Chat notifications'}
      />
    </div>
    </>
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
