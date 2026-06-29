import { useState, useEffect, useRef, useCallback } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { useAuth } from '../../contexts/AuthContext'
import { subscribeChats } from '../../services/chatService'
import { subscribeLikesReceived, fetchUser } from '../../services/userService'
import { isGroupChat, getGroupDisplayName, getGroupPhotoUrl } from '../../utils/groupChat'
import { shouldSuppressChatNotification } from '../../utils/chatMute'
import { notificationGlassClass } from '../../utils/helpers'
import UsernameLabel from '../ui/UsernameLabel'
import { sad } from '../../assets'

function NotificationTitle({ username }) {
  if (!username) return null
  const sep = ' · '
  const idx = username.indexOf(sep)
  if (idx >= 0) {
    const groupName = username.slice(0, idx)
    const senderName = username.slice(idx + sep.length)
    return (
      <p className="font-semibold text-sm truncate text-white flex items-center gap-1 min-w-0">
        <span className="truncate shrink">{groupName}</span>
        <span className="shrink-0 text-white/60">·</span>
        <UsernameLabel username={senderName} className="truncate min-w-0" badgeSize={12} />
      </p>
    )
  }
  return (
    <UsernameLabel username={username} className="font-semibold text-sm truncate text-white" badgeSize={12} />
  )
}

const AUTO_DISMISS_MS = 5000
const DRAG_THRESHOLD = 10
const GROUP_WINDOW_MS = 8000

function getMessageKey(lastMessage) {
  if (!lastMessage) return null
  if (lastMessage.messageId) return `msg_${lastMessage.messageId}`
  const ts = lastMessage.createdAt?.toMillis?.() ?? lastMessage.createdAt ?? ''
  return `${lastMessage.senderId}_${ts}_${lastMessage.text || ''}`
}

function getLikeKey(like) {
  return like.fromUserId || like.id
}

function getGroupKey(notification) {
  if (notification.type === 'chat') return `chat:${notification.chatId}`
  if (notification.type === 'friend_request') return `friend:${notification.fromUserId}`
  return notification.id
}

function getGroupedPreview(notification) {
  const count = notification.messageCount || 1
  if (count <= 1) return notification.preview
  return `${count} new messages`
}

function mergeNotifications(existing, incoming) {
  const messageCount = (existing.messageCount || 1) + 1
  return {
    ...existing,
    preview: incoming.preview,
    messageCount,
    lastGroupedAt: Date.now(),
    revision: (existing.revision || 0) + 1,
    sourceIds: [...(existing.sourceIds || []), incoming.sourceId],
  }
}

function canMerge(existing, incoming, now) {
  if (!existing) return false
  if (getGroupKey(existing) !== getGroupKey(incoming)) return false
  const anchor = existing.lastGroupedAt ?? existing.queuedAt ?? 0
  return now - anchor <= GROUP_WINDOW_MS
}

function SwipeableNotification({ notification, onDismiss, onOpen }) {
  const [offsetY, setOffsetY] = useState(0)
  const [autoExit, setAutoExit] = useState(false)
  const dragging = useRef(false)
  const startY = useRef(0)
  const offsetRef = useRef(0)
  const autoTimerRef = useRef(null)

  const dismissUp = useCallback(() => {
    setAutoExit(true)
  }, [])

  const clearAutoTimer = useCallback(() => {
    if (autoTimerRef.current) {
      clearTimeout(autoTimerRef.current)
      autoTimerRef.current = null
    }
  }, [])

  const scheduleAutoDismiss = useCallback(() => {
    clearAutoTimer()
    autoTimerRef.current = setTimeout(dismissUp, AUTO_DISMISS_MS)
  }, [clearAutoTimer, dismissUp])

  useEffect(() => {
    scheduleAutoDismiss()
    return clearAutoTimer
  }, [scheduleAutoDismiss, clearAutoTimer])

  useEffect(() => {
    if (!autoExit) return
    const timer = setTimeout(() => onDismiss(notification.id), 380)
    return () => clearTimeout(timer)
  }, [autoExit, notification.id, onDismiss])

  const handlePointerDown = (e) => {
    if (autoExit) return
    clearAutoTimer()
    dragging.current = false
    startY.current = e.clientY
  }

  const handlePointerMove = (e) => {
    if (autoExit) return
    const dy = e.clientY - startY.current
    if (!dragging.current && dy < -DRAG_THRESHOLD) {
      dragging.current = true
      e.currentTarget.setPointerCapture(e.pointerId)
    }
    if (dragging.current && dy < 0) {
      offsetRef.current = dy
      setOffsetY(dy)
    }
  }

  const handlePointerUp = (e) => {
    if (autoExit) return

    if (dragging.current) {
      dragging.current = false
      if (e.currentTarget.hasPointerCapture?.(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId)
      }
      if (offsetRef.current < -48) {
        dismissUp()
      } else {
        offsetRef.current = 0
        setOffsetY(0)
        scheduleAutoDismiss()
      }
      return
    }

    onOpen(notification)
  }

  const y = autoExit ? -72 : offsetY
  const slideTransition = autoExit
    ? { duration: 0.28, ease: [0.4, 0, 0.2, 1] }
    : { type: 'spring', stiffness: 420, damping: 34, mass: 0.75 }

  const preview = getGroupedPreview(notification)

  return (
    <motion.div
      role="button"
      tabIndex={0}
      initial={{ y: -18 }}
      animate={{ y }}
      exit={{ y: -72 }}
      transition={slideTransition}
      style={{ willChange: 'transform' }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onOpen(notification)
        }
      }}
      className="mx-4 mb-2 cursor-pointer select-none"
    >
      <motion.div
        animate={{ opacity: autoExit ? 0 : 1 }}
        transition={{ duration: autoExit ? 0.22 : 0 }}
        className={`overflow-hidden ${notificationGlassClass}`}
      >
        <div className="flex items-center gap-3 px-4 py-3">
          <img
            src={notification.photo || sad}
            alt=""
            className="w-11 h-11 rounded-full object-cover shrink-0 ring-1 ring-white/10"
          />
          <div className="flex-1 min-w-0">
            <NotificationTitle username={notification.username} />
            <p className="text-xs text-white/70 truncate mt-0.5">{preview}</p>
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}

function ChatNotificationSession({ userId, pathname, username }) {
  const navigate = useNavigate()
  const [activeNotification, setActiveNotification] = useState(null)
  const queueRef = useRef([])
  const knownMessagesRef = useRef(new Map())
  const knownLikesRef = useRef(new Set())
  const notifiedIdsRef = useRef(new Set())
  const chatsInitializedRef = useRef(false)
  const likesInitializedRef = useRef(false)
  const usersRef = useRef({})

  const dismiss = useCallback((id) => {
    setActiveNotification((current) => {
      if (!current || current.id !== id) return current
      return queueRef.current.shift() ?? null
    })
  }, [])

  const openNotification = useCallback(
    (notification) => {
      dismiss(notification.id)
      if (notification.type === 'friend_request') {
        navigate('/liked')
      } else {
        navigate(`/chats/${notification.chatId}`)
      }
    },
    [dismiss, navigate]
  )

  const enqueueNotification = useCallback((item) => {
    if (notifiedIdsRef.current.has(item.sourceId)) return
    notifiedIdsRef.current.add(item.sourceId)

    const now = Date.now()
    const entry = {
      ...item,
      messageCount: 1,
      queuedAt: now,
      lastGroupedAt: now,
      revision: 0,
      sourceIds: [item.sourceId],
    }

    setActiveNotification((current) => {
      if (canMerge(current, entry, now)) {
        return mergeNotifications(current, entry)
      }

      const queue = queueRef.current
      const lastQueued = queue[queue.length - 1]
      if (canMerge(lastQueued, entry, now)) {
        queueRef.current = [...queue.slice(0, -1), mergeNotifications(lastQueued, entry)]
        return current
      }

      if (current) {
        queueRef.current = [...queueRef.current, entry]
        return current
      }

      return entry
    })
  }, [])

  useEffect(() => {
    return subscribeChats(userId, async (chats) => {
      if (!chatsInitializedRef.current) {
        chats.forEach((chat) => {
          knownMessagesRef.current.set(chat.id, getMessageKey(chat.lastMessage))
        })
        chatsInitializedRef.current = true
        return
      }

      for (const chat of chats) {
        const prevKey = knownMessagesRef.current.get(chat.id)
        const newKey = getMessageKey(chat.lastMessage)

        if (!chat.lastMessage || !newKey || prevKey === newKey) {
          if (newKey) knownMessagesRef.current.set(chat.id, newKey)
          continue
        }
        if (chat.isSavedMessages) continue
        if (chat.lastMessage.senderId === userId) {
          knownMessagesRef.current.set(chat.id, newKey)
          continue
        }
        if (shouldSuppressChatNotification(chat, userId, chat.lastMessage, username)) {
          knownMessagesRef.current.set(chat.id, newKey)
          continue
        }
        if (pathname === `/chats/${chat.id}`) {
          knownMessagesRef.current.set(chat.id, newKey)
          continue
        }

        knownMessagesRef.current.set(chat.id, newKey)

        const previewText =
          chat.lastMessage.storyReply && chat.lastMessage.text
            ? chat.lastMessage.text
            : chat.lastMessage.text || '📷 Photo'

        if (isGroupChat(chat)) {
          const senderId = chat.lastMessage.senderId
          if (!senderId) continue

          if (!usersRef.current[senderId]) {
            usersRef.current[senderId] = await fetchUser(senderId)
          }
          const sender = usersRef.current[senderId]

          enqueueNotification({
            id: `chat_${chat.id}_${newKey}`,
            sourceId: `chat_${newKey}`,
            type: 'chat',
            chatId: chat.id,
            username: `${getGroupDisplayName(chat)} · ${sender?.username || 'User'}`,
            photo: getGroupPhotoUrl(chat),
            preview: previewText,
          })
          continue
        }

        const otherId = chat.participants.find((id) => id !== userId)
        if (!otherId) continue

        if (!usersRef.current[otherId]) {
          usersRef.current[otherId] = await fetchUser(otherId)
        }
        const otherUser = usersRef.current[otherId]

        enqueueNotification({
          id: `chat_${chat.id}_${newKey}`,
          sourceId: `chat_${newKey}`,
          type: 'chat',
          chatId: chat.id,
          username: otherUser?.username || 'User',
          photo: otherUser?.photos?.[0],
          preview: previewText,
        })
      }
    })
  }, [userId, pathname, username, enqueueNotification])

  useEffect(() => {
    return subscribeLikesReceived(userId, async (likes) => {
      if (!likesInitializedRef.current) {
        likes.forEach((like) => knownLikesRef.current.add(getLikeKey(like)))
        likesInitializedRef.current = true
        return
      }

      if (pathname === '/liked') {
        likes.forEach((like) => knownLikesRef.current.add(getLikeKey(like)))
        return
      }

      for (const like of likes) {
        const likeKey = getLikeKey(like)
        if (knownLikesRef.current.has(likeKey)) continue
        knownLikesRef.current.add(likeKey)

        const fromId = like.fromUserId || like.id
        if (!usersRef.current[fromId]) {
          usersRef.current[fromId] = await fetchUser(fromId)
        }
        const fromUser = usersRef.current[fromId]

        enqueueNotification({
          id: `like_${likeKey}`,
          sourceId: `like_${likeKey}`,
          type: 'friend_request',
          fromUserId: fromId,
          username: fromUser?.username || 'User',
          photo: fromUser?.photos?.[0],
          preview: like.message || 'Sent you a friend request',
        })
      }
    })
  }, [userId, pathname, enqueueNotification])

  const notificationKey = activeNotification
    ? `${activeNotification.id}-r${activeNotification.revision ?? 0}`
    : 'empty'

  return (
    <div
      className={`pointer-events-auto w-full max-w-md mx-auto ${
        activeNotification ? '' : 'invisible'
      }`}
    >
      <AnimatePresence initial={false} mode="wait">
        {activeNotification ? (
          <SwipeableNotification
            key={notificationKey}
            notification={activeNotification}
            onDismiss={dismiss}
            onOpen={openNotification}
          />
        ) : null}
      </AnimatePresence>
    </div>
  )
}

export default function ChatNotifications() {
  const { user, profile } = useAuth()
  const location = useLocation()

  if (!user?.uid) return null

  return (
    <div className="fixed top-12 left-0 right-0 z-[100] pointer-events-none isolate">
      <ChatNotificationSession
        key={user.uid}
        userId={user.uid}
        pathname={location.pathname}
        username={profile?.username}
      />
    </div>
  )
}
