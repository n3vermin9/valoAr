import { useState, useEffect, useRef, useCallback } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { useAuth } from '../../contexts/AuthContext'
import { subscribeChats } from '../../services/chatService'
import { subscribeLikesReceived, fetchUser } from '../../services/userService'
import { notificationGlassClass } from '../../utils/helpers'
import { sad } from '../../assets'

const AUTO_DISMISS_MS = 3000
const DRAG_THRESHOLD = 10

function getMessageKey(lastMessage) {
  if (!lastMessage) return null
  const ts = lastMessage.createdAt?.toMillis?.() ?? lastMessage.createdAt ?? ''
  return `${lastMessage.senderId}_${ts}_${lastMessage.text || ''}`
}

function getLikeKey(like) {
  const fromId = like.fromUserId || like.id
  return `${fromId}_${like.timestamp || ''}`
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

  const dragOpacity = Math.max(0, 1 + offsetY / 120)
  const y = autoExit ? -90 : offsetY
  const opacity = autoExit ? 0 : dragOpacity

  return (
    <motion.div
      layout
      role="button"
      tabIndex={0}
      initial={{ opacity: 0, y: -20, scale: 0.97 }}
      animate={{ opacity, y, scale: autoExit ? 0.98 : 1 }}
      exit={{ opacity: 0, y: -90, scale: 0.98 }}
      transition={{ duration: autoExit ? 0.38 : 0.22, ease: autoExit ? [0.4, 0, 0.2, 1] : 'easeOut' }}
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
      className={`mx-4 mb-2 overflow-hidden cursor-pointer select-none ${notificationGlassClass}`}
    >
      <div className="flex items-center gap-3 px-4 py-3">
        <img
          src={notification.photo || sad}
          alt=""
          className="w-11 h-11 rounded-full object-cover shrink-0 ring-1 ring-white/10"
        />
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm truncate text-white">{notification.username}</p>
          <p className="text-xs text-white/70 truncate mt-0.5">{notification.preview}</p>
        </div>
      </div>
    </motion.div>
  )
}

function pushNotification(setNotifications, item) {
  setNotifications((prev) => {
    if (prev.some((n) => n.id === item.id)) return prev
    return [item, ...prev].slice(0, 3)
  })
}

export default function ChatNotifications() {
  const { user } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [notifications, setNotifications] = useState([])
  const knownMessagesRef = useRef(new Map())
  const knownLikesRef = useRef(new Set())
  const chatsInitializedRef = useRef(false)
  const likesInitializedRef = useRef(false)
  const usersRef = useRef({})

  const dismiss = useCallback((id) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id))
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

  useEffect(() => {
    if (!user?.uid) return

    return subscribeChats(user.uid, async (chats) => {
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
        knownMessagesRef.current.set(chat.id, newKey)

        if (!chat.lastMessage || !newKey || prevKey === newKey) continue
        if (chat.isSavedMessages) continue
        if (chat.lastMessage.senderId === user.uid) continue
        if (chat.mutedBy?.includes(user.uid)) continue
        if (location.pathname === `/chats/${chat.id}`) continue

        const otherId = chat.participants.find((id) => id !== user.uid)
        if (!otherId) continue

        if (!usersRef.current[otherId]) {
          usersRef.current[otherId] = await fetchUser(otherId)
        }
        const otherUser = usersRef.current[otherId]

        pushNotification(setNotifications, {
          id: `chat_${chat.id}_${newKey}`,
          type: 'chat',
          chatId: chat.id,
          username: otherUser?.username || 'User',
          photo: otherUser?.photos?.[0],
          preview: chat.lastMessage.text || '📷 Photo',
        })
      }
    })
  }, [user?.uid, location.pathname])

  useEffect(() => {
    if (!user?.uid) return

    return subscribeLikesReceived(user.uid, async (likes) => {
      if (!likesInitializedRef.current) {
        likes.forEach((like) => knownLikesRef.current.add(getLikeKey(like)))
        likesInitializedRef.current = true
        return
      }

      if (location.pathname === '/liked') {
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

        pushNotification(setNotifications, {
          id: `like_${likeKey}`,
          type: 'friend_request',
          username: fromUser?.username || 'User',
          photo: fromUser?.photos?.[0],
          preview: like.message || 'Sent you a friend request',
        })
      }
    })
  }, [user?.uid, location.pathname])

  if (notifications.length === 0) return null

  return (
    <div className="fixed top-12 left-0 right-0 z-[70] pointer-events-none">
      <div className="pointer-events-auto w-full max-w-md mx-auto">
        <AnimatePresence mode="popLayout">
          {notifications.map((notification) => (
            <SwipeableNotification
              key={notification.id}
              notification={notification}
              onDismiss={dismiss}
              onOpen={openNotification}
            />
          ))}
        </AnimatePresence>
      </div>
    </div>
  )
}
