import { useState, useEffect, useMemo, useRef } from 'react'
import toast from 'react-hot-toast'
import { IconCheck, IconX } from '@tabler/icons-react'
import { useAuth } from '../../contexts/AuthContext'
import {
  subscribeLikesReceived,
  acceptLike,
  declineLike,
  markLikeAsRead,
  fetchUser,
  fetchDeletedUser,
  getOutgoingRequestIds,
  cancelFriendRequest,
  patchProfileAfterMatch,
} from '../../services/userService'
import UsernameLabel from '../ui/UsernameLabel'
import { subscribeInbox, markInboxRead, markAllInboxRead } from '../../services/inboxService'
import { sad, star } from '../../assets'
import { APP_NAME, formatLastSeen } from '../../utils/helpers'
import EmptyState from '../ui/EmptyState'
import LoadingSpinner from '../ui/LoadingSpinner'
import Modal from '../ui/Modal'
import { PublicProfileView } from '../profile/ProfileView'
import PageShell from '../layout/PageShell'
import VerifiedBadge from '../ui/VerifiedBadge'

export default function LikedYou() {
  const { user, profile, setProfile } = useAuth()
  const [section, setSection] = useState('inbox')
  const [likes, setLikes] = useState([])
  const [profiles, setProfiles] = useState({})
  const [inboxItems, setInboxItems] = useState([])
  const [inboxProfiles, setInboxProfiles] = useState({})
  const [outgoingProfiles, setOutgoingProfiles] = useState({})
  const [loading, setLoading] = useState(true)
  const [viewProfile, setViewProfile] = useState(null)

  const outgoingIds = useMemo(() => getOutgoingRequestIds(profile), [profile])
  const knownLikesRef = useRef(new Set())
  const likesInitializedRef = useRef(false)
  const [sessionUnreadIds, setSessionUnreadIds] = useState(() => new Set())

  const { unreadLikes, readLikes } = useMemo(() => {
    const unread = []
    const read = []
    for (const like of likes) {
      const fromId = like.fromUserId || like.id
      if (sessionUnreadIds.has(fromId)) unread.push(like)
      else read.push(like)
    }
    return { unreadLikes: unread, readLikes: read }
  }, [likes, sessionUnreadIds])

  const unreadInbox = useMemo(() => inboxItems.filter((item) => !item.read), [inboxItems])

  useEffect(() => {
    knownLikesRef.current = new Set()
    likesInitializedRef.current = false
    setSessionUnreadIds(new Set())
  }, [user?.uid])

  useEffect(() => {
    if (!user?.uid) return

    const unsub = subscribeLikesReceived(user.uid, async (receivedLikes) => {
      setLikes(receivedLikes)
      setSessionUnreadIds((prev) => {
        const next = new Set(prev)
        receivedLikes.forEach((like) => {
          if (!like.read) next.add(like.fromUserId || like.id)
        })
        return next
      })

      const profileMap = {}
      await Promise.all(
        receivedLikes.map(async (like) => {
          const fromId = like.fromUserId || like.id
          profileMap[fromId] = (await fetchUser(fromId)) || (await fetchDeletedUser(fromId))
        })
      )
      setProfiles(profileMap)
      setLoading(false)

      if (!likesInitializedRef.current) {
        receivedLikes.forEach((like) => knownLikesRef.current.add(like.fromUserId || like.id))
        likesInitializedRef.current = true
        return
      }

      if (document.hidden && 'Notification' in window && Notification.permission === 'granted') {
        for (const like of receivedLikes) {
          const fromId = like.fromUserId || like.id
          if (knownLikesRef.current.has(fromId)) continue
          knownLikesRef.current.add(fromId)
          new Notification(APP_NAME, {
            body: 'Someone wants to be your friend!',
            icon: star,
          })
        }
      } else {
        receivedLikes.forEach((like) => knownLikesRef.current.add(like.fromUserId || like.id))
      }
    })

    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission()
    }

    return unsub
  }, [user?.uid])

  useEffect(() => {
    if (!user?.uid) return
    return subscribeInbox(user.uid, setInboxItems)
  }, [user?.uid])

  useEffect(() => {
    if (!inboxItems.length) return
    let cancelled = false

    ;(async () => {
      const profileMap = {}
      const actorIds = [...new Set(inboxItems.map((item) => item.actorId).filter(Boolean))]
      await Promise.all(
        actorIds.map(async (id) => {
          profileMap[id] = (await fetchUser(id)) || (await fetchDeletedUser(id))
        })
      )
      if (!cancelled) setInboxProfiles(profileMap)
    })()

    return () => {
      cancelled = true
    }
  }, [inboxItems])

  useEffect(() => {
    if (!outgoingIds.length) {
      setOutgoingProfiles({})
      return
    }
    let cancelled = false

    ;(async () => {
      const profileMap = {}
      await Promise.all(
        outgoingIds.map(async (id) => {
          profileMap[id] = (await fetchUser(id)) || (await fetchDeletedUser(id))
        })
      )
      if (!cancelled) setOutgoingProfiles(profileMap)
    })()

    return () => {
      cancelled = true
    }
  }, [outgoingIds])

  useEffect(() => {
    likes.forEach((like) => {
      if (!like.read) {
        markLikeAsRead(user.uid, like.fromUserId || like.id)
      }
    })
  }, [likes, user?.uid])

  useEffect(() => {
    if (section !== 'inbox' || !user?.uid || unreadInbox.length === 0) return
    markAllInboxRead(user.uid).catch(() => {})
  }, [section, user?.uid, unreadInbox.length])

  const handleAccept = (fromUserId) => {
    setLikes((prev) => prev.filter((l) => (l.fromUserId || l.id) !== fromUserId))
    setProfiles((prev) => {
      const next = { ...prev }
      delete next[fromUserId]
      return next
    })
    setProfile((prev) => patchProfileAfterMatch(prev, fromUserId))
    toast.success("You're now friends!")

    acceptLike(user.uid, fromUserId).catch(() => {
      toast.error('Failed to accept')
    })
  }

  const handleDecline = (fromUserId) => {
    setLikes((prev) => prev.filter((l) => (l.fromUserId || l.id) !== fromUserId))
    setProfiles((prev) => {
      const next = { ...prev }
      delete next[fromUserId]
      return next
    })
    toast.success('Declined')

    declineLike(user.uid, fromUserId).catch(() => {
      toast.error('Failed to decline')
    })
  }

  const handleCancelRequest = (targetId) => {
    setProfile((prev) => {
      if (!prev?.swipes) return prev
      const swipes = { ...prev.swipes }
      delete swipes[targetId]
      return { ...prev, swipes }
    })
    toast.success('Request cancelled')

    cancelFriendRequest(user.uid, targetId).catch(() => {
      toast.error('Failed to cancel request')
    })
  }

  if (loading) {
    return (
      <PageShell title="Inbox">
        <div className="flex-1 flex items-center justify-center">
          <LoadingSpinner />
        </div>
      </PageShell>
    )
  }

  const requestActionBtnClass =
    'h-11 w-11 shrink-0 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/15 border border-white/10 transition-colors'

  const renderRequest = (like) => {
    const fromId = like.fromUserId || like.id
    const p = profiles[fromId]
    if (!p) return null
    const isDeleted = p.deleted === true

    return (
      <div key={fromId}>
        {like.timestamp && (
          <span className="block text-xs text-white/50 mb-1.5 px-1">
            {formatLastSeen(like.timestamp)}
          </span>
        )}
        <div className="p-4 bg-white/5 rounded-full border border-white/10">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setViewProfile(fromId)}
              className="flex items-center gap-4 flex-1 min-w-0 text-left"
            >
              <img
                src={isDeleted ? sad : p.photos?.[0] || sad}
                alt=""
                className="w-16 h-16 rounded-full object-cover shrink-0"
              />
              <div className="min-w-0">
                <p className="font-semibold truncate inline-flex items-center gap-1">
                  {p.username}
                  <VerifiedBadge username={p.username} size={14} />
                </p>
                <p className="text-sm text-white/50">
                  {isDeleted ? 'Account deleted' : `${p.age} years old`}
                </p>
              </div>
            </button>
            <div className="flex gap-2 shrink-0">
              <button
                onClick={() => handleDecline(fromId)}
                className={requestActionBtnClass}
                aria-label="Decline"
              >
                <IconX size={20} className="text-white/70" stroke={2} />
              </button>
              {!isDeleted && (
                <button
                  onClick={() => handleAccept(fromId)}
                  className={requestActionBtnClass}
                  aria-label="Accept"
                >
                  <IconCheck size={20} className="text-white/70" stroke={2.5} />
                </button>
              )}
            </div>
          </div>

          {like.message && (
            <div className="mt-3 flex justify-start">
              <div className="bg-blue-500/20 px-4 py-2 rounded-2xl rounded-bl-sm max-w-[80%]">
                <p className="text-sm">{like.message}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }

  const renderOutgoingRequest = (targetId) => {
    const p = outgoingProfiles[targetId]
    if (!p) return null
    const isDeleted = p.deleted === true

    return (
      <div
        key={targetId}
        className="flex items-center gap-3 p-3 bg-white/5 rounded-2xl border border-white/10"
      >
        <button
          onClick={() => setViewProfile(targetId)}
          className="flex items-center gap-3 flex-1 min-w-0 text-left"
        >
          <img
            src={isDeleted ? sad : p.photos?.[0] || sad}
            alt=""
            className="w-12 h-12 rounded-full object-cover shrink-0"
          />
          <div className="min-w-0">
            <p className="font-medium truncate inline-flex items-center gap-1">
              {p.username}
              <VerifiedBadge username={p.username} size={14} />
            </p>
            <p className="text-xs text-white/50">{isDeleted ? 'Account deleted' : 'Pending'}</p>
          </div>
        </button>
        <button
          onClick={() => handleCancelRequest(targetId)}
          className="px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 rounded-full border border-red-500/30 shrink-0"
        >
          Cancel
        </button>
      </div>
    )
  }

  const inboxMessage = (item) => {
    const name = item.actorUsername || inboxProfiles[item.actorId]?.username || 'Someone'
    const nameLabel = (
      <UsernameLabel username={name} className="font-medium inline-flex" badgeSize={12} as="span" />
    )
    if (item.type === 'story_reaction') {
      return (
        <>
          {nameLabel} reacted {item.emoji} to your story
        </>
      )
    }
    return (
      <>
        You and {nameLabel} are now friends
      </>
    )
  }

  const renderInboxItem = (item) => {
    const actorId = item.actorId
    const p = inboxProfiles[actorId]
    const isDeleted = p?.deleted === true
    const photo = isDeleted ? sad : p?.photos?.[0] || sad

    return (
      <button
        key={item.id}
        type="button"
        onClick={() => {
          if (!item.read) markInboxRead(user.uid, item.id)
          if (actorId) setViewProfile(actorId)
        }}
        className={`w-full flex items-center gap-3 py-3 text-left transition-colors ${
          item.read ? 'opacity-80' : 'bg-white/[0.03]'
        }`}
      >
        <img src={photo} alt="" className="w-12 h-12 rounded-full object-cover shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-sm text-white/90 leading-snug">{inboxMessage(item)}</p>
          <p className="text-xs text-white/45 mt-1">{formatLastSeen(item.timestamp)}</p>
        </div>
        {item.type === 'story_reaction' && (
          <span className="text-xl shrink-0" aria-hidden>
            {item.emoji}
          </span>
        )}
        {!item.read && (
          <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0" aria-label="Unread" />
        )}
      </button>
    )
  }

  const requestsContent =
    likes.length === 0 && outgoingIds.length === 0 ? (
      <EmptyState message="No friend requests yet. Keep discovering!" className="flex-1" />
    ) : (
      <div className="px-[var(--ios-page-x-lg)] mt-2 space-y-4 overflow-y-auto flex-1 min-h-0">
        {outgoingIds.length > 0 && (
          <div className="space-y-3">
            <p className="text-xs font-medium text-white/40 uppercase tracking-wider px-1">Sent</p>
            {outgoingIds.map(renderOutgoingRequest)}
          </div>
        )}
        {likes.length > 0 && (
          <div className="space-y-4">
            {outgoingIds.length > 0 && (
              <p className="text-xs font-medium text-white/40 uppercase tracking-wider px-1 pt-1">
                Received
              </p>
            )}
            {unreadLikes.map(renderRequest)}
            {unreadLikes.length > 0 && readLikes.length > 0 && (
              <div className="flex items-center gap-3 py-1">
                <div className="flex-1 h-px bg-white/10" />
                <span className="text-xs font-medium text-white/40 shrink-0">Earlier</span>
                <div className="flex-1 h-px bg-white/10" />
              </div>
            )}
            {readLikes.map(renderRequest)}
          </div>
        )}
      </div>
    )

  const inboxContent =
    inboxItems.length === 0 ? (
      <EmptyState message="No notifications yet" className="flex-1" />
    ) : (
      <div className="px-[var(--ios-page-x-lg)] mt-2 overflow-y-auto flex-1 min-h-0 divide-y divide-white/5">
        {inboxItems.map(renderInboxItem)}
      </div>
    )

  return (
    <PageShell title="Inbox" contentClassName="flex flex-col min-h-0">
      <InboxSectionTabs
        section={section}
        onSectionChange={setSection}
        requestCount={likes.length}
        inboxUnread={unreadInbox.length}
      />
      {section === 'requests' ? requestsContent : inboxContent}

      <Modal isOpen={!!viewProfile} onClose={() => setViewProfile(null)} fullscreen>
        {viewProfile && (
          <PublicProfileView userId={viewProfile} onClose={() => setViewProfile(null)} />
        )}
      </Modal>
    </PageShell>
  )
}

function InboxSectionTabs({ section, onSectionChange, requestCount, inboxUnread }) {
  return (
    <>
      <div className="mx-[var(--ios-page-x-lg)] border-t border-white/10" aria-hidden />
      <div className="flex px-[var(--ios-page-x-lg)] pt-3 pb-2 z-10">
        {[
          {
            id: 'requests',
            label: requestCount > 0 ? `Requests (${requestCount})` : 'Requests',
          },
          {
            id: 'inbox',
            label: inboxUnread > 0 ? `Inbox (${inboxUnread})` : 'Inbox',
          },
        ].map(({ id, label }) => (
          <button
            key={id}
            type="button"
            onClick={() => onSectionChange(id)}
            className={`flex-1 py-1 text-center text-sm font-semibold transition-colors ${
              section === id ? 'text-white' : 'text-white/45 hover:text-white/70'
            }`}
          >
            {label}
          </button>
        ))}
      </div>
    </>
  )
}
