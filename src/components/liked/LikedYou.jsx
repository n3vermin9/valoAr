import { useState, useEffect, useMemo, useRef } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
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
  cancelFriendRequest,
  patchProfileAfterMatch,
  subscribeActiveOutgoingRequestIds,
} from '../../services/userService'
import UsernameLabel from '../ui/UsernameLabel'
import { subscribeInbox, markInboxRead, markAllInboxRead } from '../../services/inboxService'
import { subscribeUserStories } from '../../services/storyService'
import { getStoryColorClass } from '../../utils/storyHelpers'
import { sad, star } from '../../assets'
import { APP_NAME, formatLastSeen, reportBackgroundError } from '../../utils/helpers'
import EmptyState from '../ui/EmptyState'
import { ListSkeleton } from '../ui/Skeleton'
import Modal from '../ui/Modal'
import { PublicProfileView } from '../profile/ProfileView'
import PageShell from '../layout/PageShell'
import VerifiedBadge from '../ui/VerifiedBadge'
import IosEmoji from '../ui/IosEmoji'
import ChatStoryViewer from '../stories/ChatStoryViewer'
import StoryUnavailableViewer from '../stories/StoryUnavailableViewer'
import { chatBubblePadClass, chatMessageTextClass, typoSubheadClass, segmentedControlClass, tabSlideTransition, tabSlideVariants } from '../../utils/designSystem'
import { getInboxPageSnapshot, setInboxPageSnapshot } from '../../services/inboxPageCache'

const EMPTY_INBOX_TRUST_MS = 2000

const INBOX_TAB_ORDER = { requests: 0, inbox: 1 }
const inboxListClass =
  'h-full min-h-0 overflow-y-auto px-[var(--ios-page-x-lg)] pt-2'

function StoryReactionPreview({ story, emoji, unavailable = false, onClick }) {
  const cardClass = unavailable
    ? 'bg-[var(--ios-fill-tertiary)]'
    : getStoryColorClass(story?.color)

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation()
        onClick?.(e)
      }}
      className="relative shrink-0 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60"
      aria-label={unavailable ? 'Story unavailable' : 'View story'}
    >
      <div
        className={`w-9 h-12 rounded-lg overflow-hidden flex items-center justify-center px-1 ${cardClass}`}
      >
        {!unavailable && story?.text ? (
          <span className="text-[8px] leading-tight text-white/90 text-center line-clamp-3 break-words">
            {story.text}
          </span>
        ) : null}
      </div>
      <span className="absolute -bottom-1 -right-1 rounded-full bg-black/60 p-0.5 pointer-events-none">
        <IosEmoji emoji={emoji} size={16} />
      </span>
    </button>
  )
}

function inboxTabFromSearch(searchParams) {
  return searchParams.get('tab') === 'requests' ? 'requests' : 'inbox'
}

export default function LikedYou() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const { user, profile, setProfile } = useAuth()
  const snapshot = user?.uid ? getInboxPageSnapshot(user.uid) : null
  const [section, setSection] = useState(() => inboxTabFromSearch(searchParams))
  const sectionDirectionRef = useRef(0)
  const [likes, setLikes] = useState(() => snapshot?.likes || [])
  const [profiles, setProfiles] = useState(() => snapshot?.profiles || {})
  const [inboxItems, setInboxItems] = useState(() => snapshot?.inboxItems || [])
  const [inboxProfiles, setInboxProfiles] = useState(() => snapshot?.inboxProfiles || {})
  const [outgoingProfiles, setOutgoingProfiles] = useState(() => snapshot?.outgoingProfiles || {})
  const [ownStories, setOwnStories] = useState({})
  const [loading, setLoading] = useState(() => !snapshot)
  const [viewProfile, setViewProfile] = useState(null)
  const [storyViewerTarget, setStoryViewerTarget] = useState(null)

  const [outgoingIds, setOutgoingIds] = useState(() => snapshot?.outgoingIds || [])
  const knownLikesRef = useRef(new Set())
  const likesInitializedRef = useRef(false)
  const inboxReadMarkedRef = useRef(false)
  const likesRef = useRef(likes)
  const profilesRef = useRef(profiles)
  const inboxItemsRef = useRef(inboxItems)
  const inboxProfilesRef = useRef(inboxProfiles)

  useEffect(() => {
    const next = inboxTabFromSearch(searchParams)
    setSection((prev) => {
      if (prev !== next) {
        sectionDirectionRef.current =
          (INBOX_TAB_ORDER[next] ?? 0) - (INBOX_TAB_ORDER[prev] ?? 0)
      }
      return next
    })
  }, [searchParams])

  const handleSectionChange = (next) => {
    if (next === section) return
    sectionDirectionRef.current =
      (INBOX_TAB_ORDER[next] ?? 0) - (INBOX_TAB_ORDER[section] ?? 0)
    setSection(next)
    setSearchParams(next === 'requests' ? { tab: 'requests' } : {}, { replace: true })
  }
  const outgoingIdsRef = useRef(outgoingIds)
  const outgoingProfilesRef = useRef(outgoingProfiles)
  const mountAtRef = useRef(Date.now())
  const hadCachedContentRef = useRef(
    (snapshot?.likes || []).length > 0 || (snapshot?.inboxItems || []).length > 0
  )

  useEffect(() => {
    likesRef.current = likes
  }, [likes])
  useEffect(() => {
    profilesRef.current = profiles
  }, [profiles])
  useEffect(() => {
    inboxItemsRef.current = inboxItems
  }, [inboxItems])
  useEffect(() => {
    inboxProfilesRef.current = inboxProfiles
  }, [inboxProfiles])
  useEffect(() => {
    outgoingIdsRef.current = outgoingIds
  }, [outgoingIds])
  useEffect(() => {
    outgoingProfilesRef.current = outgoingProfiles
  }, [outgoingProfiles])

  const persistInboxSnapshot = () => {
    if (!user?.uid) return
    setInboxPageSnapshot(user.uid, {
      likes: likesRef.current,
      profiles: profilesRef.current,
      inboxItems: inboxItemsRef.current,
      inboxProfiles: inboxProfilesRef.current,
      outgoingIds: outgoingIdsRef.current,
      outgoingProfiles: outgoingProfilesRef.current,
    })
  }

  const { unreadLikes, readLikes } = useMemo(() => {
    const unread = []
    const read = []
    for (const like of likes) {
      if (!like.read) unread.push(like)
      else read.push(like)
    }
    return { unreadLikes: unread, readLikes: read }
  }, [likes])

  const unreadInbox = useMemo(() => inboxItems.filter((item) => !item.read), [inboxItems])

  useEffect(() => {
    if (!user?.uid) {
      setOutgoingIds([])
      return
    }
    return subscribeActiveOutgoingRequestIds(
      user.uid,
      (ids) => {
        setOutgoingIds(ids)
        outgoingIdsRef.current = ids
        persistInboxSnapshot()
      },
      (err) => reportBackgroundError('Failed to subscribe to sent requests', err)
    )
  }, [user?.uid])

  useEffect(() => {
    knownLikesRef.current = new Set()
    likesInitializedRef.current = false
    inboxReadMarkedRef.current = false
    const cached = user?.uid ? getInboxPageSnapshot(user.uid) : null
    mountAtRef.current = Date.now()
    hadCachedContentRef.current =
      (cached?.likes || []).length > 0 || (cached?.inboxItems || []).length > 0
    if (cached) {
      setLikes(cached.likes)
      setProfiles(cached.profiles)
      setInboxItems(cached.inboxItems)
      setInboxProfiles(cached.inboxProfiles)
      setOutgoingIds(cached.outgoingIds)
      setOutgoingProfiles(cached.outgoingProfiles)
      setLoading(false)
    } else {
      setLoading(true)
    }
  }, [user?.uid])

  useEffect(() => {
    if (!user?.uid) return

    const trustEmptyTimer = window.setTimeout(() => {
      setLoading(false)
      persistInboxSnapshot()
    }, EMPTY_INBOX_TRUST_MS)

    const unsub = subscribeLikesReceived(user.uid, async (receivedLikes) => {
      const age = Date.now() - mountAtRef.current
      const showingCached =
        likesRef.current.length > 0 ||
        inboxItemsRef.current.length > 0 ||
        hadCachedContentRef.current

      if (receivedLikes.length === 0 && showingCached && age < EMPTY_INBOX_TRUST_MS) {
        setLoading(false)
        return
      }

      setLikes(receivedLikes)

      const profileMap = {}
      await Promise.all(
        receivedLikes.map(async (like) => {
          const fromId = like.fromUserId || like.id
          profileMap[fromId] = (await fetchUser(fromId)) || (await fetchDeletedUser(fromId))
        })
      )
      setProfiles(profileMap)
      setLoading(false)
      likesRef.current = receivedLikes
      profilesRef.current = profileMap
      persistInboxSnapshot()

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

    return () => {
      unsub()
      window.clearTimeout(trustEmptyTimer)
    }
  }, [user?.uid])

  useEffect(() => {
    if (!user?.uid) return
    return subscribeInbox(user.uid, (items) => {
      setInboxItems(items)
      inboxItemsRef.current = items
      persistInboxSnapshot()
    })
  }, [user?.uid])

  useEffect(() => {
    if (!user?.uid) return

    const hasUnread = inboxItems.some((item) => !item.read)
    if (!hasUnread) {
      inboxReadMarkedRef.current = false
      return
    }
    if (inboxReadMarkedRef.current) return

    inboxReadMarkedRef.current = true
    markAllInboxRead(user.uid).catch((err) => {
      inboxReadMarkedRef.current = false
      reportBackgroundError('Failed to mark inbox as read', err)
    })
  }, [user?.uid, inboxItems])

  useEffect(() => {
    if (!user?.uid) return
    return subscribeUserStories(user.uid, (stories) => {
      const byId = {}
      for (const story of stories) byId[story.id] = story
      setOwnStories(byId)
    })
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
      if (!cancelled) {
        setInboxProfiles(profileMap)
        inboxProfilesRef.current = profileMap
        persistInboxSnapshot()
      }
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
      if (!cancelled) {
        setOutgoingProfiles(profileMap)
        outgoingProfilesRef.current = profileMap
        persistInboxSnapshot()
      }
    })()

    return () => {
      cancelled = true
    }
  }, [outgoingIds])

  useEffect(() => {
    likes.forEach((like) => {
      if (!like.read) {
        markLikeAsRead(user.uid, like.fromUserId || like.id).catch((err) =>
          reportBackgroundError('Failed to mark like as read', err)
        )
      }
    })
  }, [likes, user?.uid])

  const handleAccept = async (fromUserId) => {
    const previousLikes = likes
    const previousProfiles = profiles
    const previousProfile = profile
    setLikes((prev) => prev.filter((l) => (l.fromUserId || l.id) !== fromUserId))
    setProfiles((prev) => {
      const next = { ...prev }
      delete next[fromUserId]
      return next
    })
    setProfile((prev) => patchProfileAfterMatch(prev, fromUserId))
    try {
      await acceptLike(user.uid, fromUserId)
      toast.success("You're now friends!")
      persistInboxSnapshot()
    } catch {
      setLikes(previousLikes)
      setProfiles(previousProfiles)
      setProfile(previousProfile)
      toast.error('Failed to accept')
    }
  }

  const handleDecline = async (fromUserId) => {
    const previousLikes = likes
    const previousProfiles = profiles
    setLikes((prev) => prev.filter((l) => (l.fromUserId || l.id) !== fromUserId))
    setProfiles((prev) => {
      const next = { ...prev }
      delete next[fromUserId]
      return next
    })
    try {
      await declineLike(user.uid, fromUserId)
      toast.success('Declined')
      persistInboxSnapshot()
    } catch {
      setLikes(previousLikes)
      setProfiles(previousProfiles)
      toast.error('Failed to decline')
    }
  }

  const handleCancelRequest = async (targetId) => {
    const previousProfile = profile
    const previousOutgoingIds = outgoingIds
    setOutgoingIds((prev) => prev.filter((id) => id !== targetId))
    setProfile((prev) => {
      if (!prev?.swipes) return prev
      const swipes = { ...prev.swipes }
      delete swipes[targetId]
      return { ...prev, swipes }
    })
    try {
      await cancelFriendRequest(user.uid, targetId)
      toast.success('Request cancelled')
      persistInboxSnapshot()
    } catch {
      setProfile(previousProfile)
      setOutgoingIds(previousOutgoingIds)
      toast.error('Failed to cancel request')
    }
  }

  const requestActionBtnClass =
    'h-11 w-11 shrink-0 flex items-center justify-center rounded-full bg-[var(--ios-fill-tertiary)] hover:bg-[var(--ios-fill-secondary)] border border-[var(--ios-hairline)] transition-colors'

  const hasCachedOrLoadedContent =
    !loading || likes.length > 0 || inboxItems.length > 0 || outgoingIds.length > 0

  if (!hasCachedOrLoadedContent) {
    return (
      <PageShell title="Inbox">
        <ListSkeleton rows={5} />
      </PageShell>
    )
  }

  const renderRequest = (like) => {
    const fromId = like.fromUserId || like.id
    const p = profiles[fromId]
    if (!p) return null
    const isDeleted = p.deleted === true

    return (
      <div key={fromId}>
        {like.timestamp && (
          <span className="block text-xs text-[var(--ios-label-tertiary)] mb-1.5 px-1">
            {formatLastSeen(like.timestamp)}
          </span>
        )}
        <div className="rounded-[var(--ios-radius-lg)] border border-[var(--ios-separator)] bg-[var(--ios-fill-tertiary)] overflow-hidden">
          <div className="flex items-center gap-3 p-4">
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
                <p className={`${typoSubheadClass} text-[var(--ios-label-secondary)]`}>
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
                <IconX size={20} className="text-[var(--ios-label-secondary)]" stroke={2} />
              </button>
              {!isDeleted && (
                <button
                  onClick={() => handleAccept(fromId)}
                  className={requestActionBtnClass}
                  aria-label="Accept"
                >
                  <IconCheck size={20} className="text-[var(--ios-label-secondary)]" stroke={2.5} />
                </button>
              )}
            </div>
          </div>

          {like.message && (
            <div className="px-4 pb-4">
              <div
                className={`inline-block max-w-full ${chatBubblePadClass} bg-[var(--ios-bg-tertiary)] rounded-[var(--chat-bubble-radius)] rounded-bl-[0.3rem]`}
              >
                <p className={`${chatMessageTextClass} text-[var(--ios-label)] whitespace-pre-wrap`}>
                  {like.message}
                </p>
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
        className="flex items-center gap-3 p-3 bg-[var(--ios-fill-tertiary)] rounded-2xl border border-[var(--ios-hairline)]"
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
            <p className="text-xs text-[var(--ios-label-tertiary)]">{isDeleted ? 'Account deleted' : 'Pending'}</p>
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
      return <>{nameLabel} reacted to your story</>
    }
    if (item.type === 'group_join_request') {
      return (
        <>
          {nameLabel} requested to join {item.groupName || 'your group'}
        </>
      )
    }
    if (item.type === 'group_join_approved') {
      return <>Your request to join {item.groupName || 'the group'} was approved</>
    }
    if (item.type === 'group_join_denied') {
      return <>Your request to join {item.groupName || 'the group'} was declined</>
    }
    if (item.type === 'meetup_join') {
      return (
        <>
          {nameLabel} joined {item.meetupTitle || 'your meetup'}
        </>
      )
    }
    return (
      <>
        You and {nameLabel} are now friends
      </>
    )
  }

  const handleStoryPreviewClick = (item) => {
    if (!item.read) markInboxRead(user.uid, item.id)
    const story = ownStories[item.storyId]
    if (story) {
      setStoryViewerTarget({ ownerId: user.uid, storyId: item.storyId })
      return
    }
    setStoryViewerTarget({ unavailable: true })
  }

  const handleInboxItemClick = (item) => {
    if (!item.read) markInboxRead(user.uid, item.id)

    if (item.type === 'group_join_request' && item.chatId) {
      navigate(`/groups/${item.chatId}/settings/join`)
      return
    }
    if ((item.type === 'group_join_approved' || item.type === 'group_join_denied') && item.chatId) {
      navigate(`/chats/${item.chatId}`)
      return
    }
    if (item.type === 'meetup_join' && item.chatId) {
      navigate(`/chats/${item.chatId}`)
      return
    }
    if (item.actorId) setViewProfile(item.actorId)
  }

  const renderInboxItem = (item) => {
    const actorId = item.actorId
    const p = inboxProfiles[actorId]
    const isDeleted = p?.deleted === true
    const photo = isDeleted ? sad : p?.photos?.[0] || sad
    const story = item.type === 'story_reaction' ? ownStories[item.storyId] : null

    return (
      <button
        key={item.id}
        type="button"
        onClick={() => handleInboxItemClick(item)}
        className={`w-full flex items-center gap-3 py-3 text-left transition-colors ${
          item.read ? 'opacity-80' : 'bg-[var(--ios-fill-tertiary)]'
        }`}
      >
        <img src={photo} alt="" className="w-12 h-12 rounded-full object-cover shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="text-sm text-[var(--ios-label)] leading-snug">{inboxMessage(item)}</p>
          <p className="text-xs text-[var(--ios-label-tertiary)] mt-1">{formatLastSeen(item.timestamp)}</p>
        </div>
        {item.type === 'story_reaction' && (
          <StoryReactionPreview
            story={story}
            emoji={item.emoji}
            unavailable={!story}
            onClick={() => handleStoryPreviewClick(item)}
          />
        )}
        {!item.read && (
          <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0" aria-label="Unread" />
        )}
      </button>
    )
  }

  const requestsContent =
    likes.length === 0 && outgoingIds.length === 0 ? (
      <EmptyState message="No friend requests yet. Keep discovering!" className="h-full" />
    ) : (
      <div className={`${inboxListClass} space-y-4`}>
        {outgoingIds.length > 0 && (
          <div className="space-y-3">
            <p className="text-xs font-medium text-[var(--ios-label-tertiary)] uppercase tracking-wider px-1">Sent</p>
            {outgoingIds.map(renderOutgoingRequest)}
          </div>
        )}
        {likes.length > 0 && (
          <div className="space-y-4">
            {outgoingIds.length > 0 && (
              <p className="text-xs font-medium text-[var(--ios-label-tertiary)] uppercase tracking-wider px-1 pt-1">
                Received
              </p>
            )}
            {unreadLikes.map(renderRequest)}
            {unreadLikes.length > 0 && readLikes.length > 0 && (
              <div className="flex items-center gap-3 py-1">
                <div className="flex-1 h-px bg-[var(--ios-hairline)]" />
                <span className="text-xs font-medium text-[var(--ios-label-tertiary)] shrink-0">Earlier</span>
                <div className="flex-1 h-px bg-[var(--ios-hairline)]" />
              </div>
            )}
            {readLikes.map(renderRequest)}
          </div>
        )}
      </div>
    )

  const inboxContent =
    inboxItems.length === 0 ? (
      <EmptyState message="No notifications yet" className="h-full" />
    ) : (
      <div className={`${inboxListClass} divide-y divide-[var(--ios-hairline)]`}>
        {inboxItems.map(renderInboxItem)}
      </div>
    )

  return (
    <PageShell title="Inbox" contentClassName="flex flex-col min-h-0">
      <InboxSectionTabs
        section={section}
        onSectionChange={handleSectionChange}
        requestCount={likes.length}
        inboxUnread={unreadInbox.length}
      />
      <div className="flex-1 min-h-0 relative overflow-hidden">
        <AnimatePresence mode="sync" initial={false} custom={sectionDirectionRef.current}>
          <motion.div
            key={section}
            custom={sectionDirectionRef.current}
            variants={tabSlideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={tabSlideTransition}
            className="absolute inset-0 flex flex-col min-h-0 origin-center will-change-transform"
          >
            {section === 'requests' ? requestsContent : inboxContent}
          </motion.div>
        </AnimatePresence>
      </div>

      <Modal isOpen={!!viewProfile} onClose={() => setViewProfile(null)} fullscreen>
        {viewProfile && (
          <PublicProfileView userId={viewProfile} onClose={() => setViewProfile(null)} />
        )}
      </Modal>

      {storyViewerTarget?.unavailable && (
        <StoryUnavailableViewer onClose={() => setStoryViewerTarget(null)} />
      )}
      {storyViewerTarget?.ownerId && (
        <ChatStoryViewer
          ownerId={storyViewerTarget.ownerId}
          storyId={storyViewerTarget.storyId}
          onClose={() => setStoryViewerTarget(null)}
        />
      )}
    </PageShell>
  )
}

function InboxSectionTabs({ section, onSectionChange, requestCount, inboxUnread }) {
  return (
    <div className="px-[var(--ios-page-x-lg)] pt-1 pb-1 z-10">
      <div className={segmentedControlClass}>
        {[
          {
            id: 'requests',
            label: requestCount > 0 ? `Requests (${requestCount})` : 'Requests',
          },
          {
            id: 'inbox',
            label: inboxUnread > 0 ? `Inbox (${inboxUnread})` : 'Inbox',
          },
        ].map(({ id, label }) => {
          const active = section === id
          return (
            <button
              key={id}
              type="button"
              onClick={() => onSectionChange(id)}
              className={`relative flex-1 py-2 text-center text-sm font-medium rounded-full transition-colors ${
                active
                  ? 'text-white'
                  : 'text-[var(--ios-label-secondary)] hover:text-[var(--ios-label)]'
              }`}
            >
              {active ? (
                <motion.span
                  layoutId="inbox-section-pill"
                  className="absolute inset-0 rounded-full bg-[var(--ios-blue)] shadow-sm"
                  transition={tabSlideTransition}
                  aria-hidden
                />
              ) : null}
              <span className="relative z-[1]">{label}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
