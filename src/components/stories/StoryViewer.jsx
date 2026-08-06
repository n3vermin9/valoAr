import { useState, useEffect, useLayoutEffect, useRef, useCallback, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, animate, motion, useMotionValue, useTransform } from 'framer-motion'
import {
  IconX,
  IconTrash,
  IconShare,
  IconEye,
  IconSend,
  IconHeart,
  IconMoodSmile,
} from '@tabler/icons-react'
import toast from 'react-hot-toast'
import {
  deleteStory,
  deleteExpiredStories,
  recordStoryView,
  replyToStory,
  setStoryReaction,
  subscribeStoryReactions,
  subscribeStoryWatchers,
} from '../../services/storyService'
import { joinMeetup, subscribeMeetup, fetchMeetup, isMeetupActive, meetupExpiryMs } from '../../services/meetupService'
import { canDirectMessage } from '../../utils/directMessages'
import { useAuth } from '../../contexts/AuthContext'
import { fetchMapPlace } from '../../services/placesService'
import {
  STORY_DURATION_MS,
  getStoryColorClass,
  storyCreatedMs,
  formatStoryTime,
  formatStoryViewTime,
  formatMeetupStoryTimer,
  isMeetupStory,
  getMeetupMapCoords,
  preloadMeetupMapTiles,
  toTimestampMs,
  shareStory,
  MAX_STORY_REPLY_LENGTH,
  getStoryOpenMotion,
  storyShellTransition,
  storySlideVariants,
  storyUserSlideTransition,
} from '../../utils/storyHelpers'
import { fetchUser, fetchDeletedUser, fetchUsersMap } from '../../services/userService'
import { deletedAccountAvatarClass, deletedAccountAvatarSrc } from '../../utils/deletedAccountAvatar'
import {
  storyGlassButtonClass,
  storyGlassPillClass,
  storyGlassInputClass,
  storyWatchersScrimClass,
  storyWatchersSheetClass,
  storyAuthorBubbleClass,
  storyProgressTrackClass,
  storyProgressFillClass,
  storyPausedBadgeClass,
  typoCaptionClass,
} from '../../utils/designSystem'
import ConfirmDialog from '../ui/ConfirmDialog'
import Modal from '../ui/Modal'
import IosEmoji from '../ui/IosEmoji'
import MeetupStoryCard from './MeetupStoryCard'
import IosEmojiField from '../ui/IosEmojiField'
import EmojiPickerPopover from '../ui/EmojiPickerPopover'
import { PublicProfileView } from '../profile/ProfileView'
import MessageReactions, { ReactionPicker } from '../chat/MessageReactions'
import UsernameLabel from '../ui/UsernameLabel'
import { useOverlayKeyboardInset } from '../../hooks/useOverlayKeyboardInset'
import { isMobileInputDevice } from '../../utils/iosInput'
import { focusFieldWithoutScroll, resetDocumentScroll } from '../../utils/keyboardFocus'
import { sad } from '../../assets'

function getTapZone(clientX) {
  const width = window.innerWidth
  if (clientX < width * 0.33) return 'left'
  if (clientX > width * 0.66) return 'right'
  return 'center'
}

function findNextUserWithStories(queue, fromIndex) {
  for (let i = fromIndex + 1; i < queue.length; i++) {
    if (queue[i]?.stories?.length) return i
  }
  return -1
}

function findPrevUserWithStories(queue, fromIndex) {
  for (let i = fromIndex - 1; i >= 0; i--) {
    if (queue[i]?.stories?.length) return i
  }
  return -1
}

function cloneQueue(queue) {
  return queue.map((entry) => ({
    userId: entry.userId,
    stories: (entry.stories || []).map((story) => ({ ...story })),
  }))
}

function resolveStoryNav(queue, nav) {
  if (!queue.length) {
    return { userIndex: 0, storyIndex: 0, entry: null, stories: [], story: null }
  }

  let userIndex = Math.min(Math.max(0, nav.userIndex), queue.length - 1)
  let entry = queue[userIndex]
  let stories = entry?.stories || []

  if (!stories.length) {
    const nextUser = findNextUserWithStories(queue, userIndex)
    const prevUser = findPrevUserWithStories(queue, userIndex)
    if (nextUser >= 0) userIndex = nextUser
    else if (prevUser >= 0) userIndex = prevUser
    entry = queue[userIndex]
    stories = entry?.stories || []
  }

  if (!stories.length) {
    return { userIndex, storyIndex: 0, entry, stories: [], story: null }
  }

  const storyIndex = Math.min(Math.max(0, nav.storyIndex), stories.length - 1)
  return {
    userIndex,
    storyIndex,
    entry,
    stories,
    story: stories[storyIndex],
  }
}

const STORY_FOOTER_ROW_H = 'h-11'

/** Swipe down to dismiss: how far / how fast a drag has to be to let go of the story. */
const SWIPE_CLOSE_PX = 110
const SWIPE_CLOSE_VELOCITY = 0.45
const SWIPE_START_PX = 8
/** Swipe up to reply (others) or open viewers (own). */
const SWIPE_UP_PX = 72
const SWIPE_UP_VELOCITY = 0.4
/** Travel that maps to the full shrink-away, so short drags barely move the card. */
const SWIPE_RANGE_PX = 420
const SWIPE_SNAP_BACK = { type: 'spring', stiffness: 560, damping: 42, mass: 0.7 }
/** Exits accelerate out — the open ease decelerates and would crawl at the end. */
const STORY_CLOSE_TRANSITION = { duration: 0.2, ease: [0.4, 0, 1, 1] }

function StoryReactionButton({
  showReactionPicker,
  onTogglePicker,
  storyReactions,
  viewerId,
  onReact,
  iconSize = 20,
  className = '',
  /** When the heart sits alone in the footer, center the tray over it. */
  pickerAlign = 'end',
}) {
  const myReaction = storyReactions[viewerId]
  const centered = pickerAlign === 'center'
  const pickerAnchorClass = centered
    ? 'absolute bottom-full left-1/2 mb-2 z-10'
    : 'absolute bottom-full right-0 mb-2 z-10'
  const centerX = centered ? '-50%' : 0

  return (
    <div data-reaction-ui className={`relative shrink-0 flex items-center h-full ${className}`}>
      <AnimatePresence>
        {showReactionPicker && (
          <motion.div
            key="story-reaction-picker"
            initial={{ opacity: 0, y: 6, scale: 0.96, x: centerX }}
            animate={{ opacity: 1, y: 0, scale: 1, x: centerX }}
            exit={{ opacity: 0, y: 6, scale: 0.96, x: centerX }}
            transition={{ duration: 0.12 }}
            className={pickerAnchorClass}
          >
            <div
              className={`${storyGlassInputClass} px-1.5 py-1`}
            >
              <ReactionPicker
                reactions={storyReactions}
                currentUserId={viewerId}
                onReact={onReact}
                className="justify-center gap-0.5 px-0.5 py-0"
              />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <motion.button
        type="button"
        onClick={onTogglePicker}
        whileTap={{ scale: 0.88 }}
        className={`${storyGlassButtonClass} h-full aspect-square !p-0 shrink-0 ${
          myReaction ? 'bg-white/20' : ''
        }`}
        aria-label="React to story"
        aria-expanded={showReactionPicker}
      >
        {myReaction ? (
          <IosEmoji emoji={myReaction} size={iconSize + 2} />
        ) : (
          <IconHeart size={iconSize} className="text-white/90" stroke={2.5} fill="none" />
        )}
      </motion.button>
    </div>
  )
}

export default function StoryViewer({
  queue = [],
  startIndex = 0,
  initialStoryIndex = 0,
  users = {},
  viewerId,
  viewerUsername = '',
  viewerPhoto = null,
  friendIds = [],
  onClose,
  onNavigateToProfile: _onNavigateToProfile,
  openOrigin = null,
  onStoryViewed,
}) {
  const { profile: viewerProfile } = useAuth()
  const [sessionQueue, setSessionQueue] = useState(() => cloneQueue(queue))
  const [nav, setNav] = useState({ userIndex: startIndex, storyIndex: initialStoryIndex })
  const [progress, setProgress] = useState(0)
  const [paused, setPaused] = useState(false)
  const [holding, setHolding] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [replyText, setReplyText] = useState('')
  const [replyFocused, setReplyFocused] = useState(false)
  const [replying, setReplying] = useState(false)
  const [showWatchers, setShowWatchers] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [profileUserId, setProfileUserId] = useState(null)
  const [replySentPulse, setReplySentPulse] = useState(false)
  const [watchers, setWatchers] = useState([])
  const [watcherPhotos, setWatcherPhotos] = useState({})
  const [watcherDeleted, setWatcherDeleted] = useState({})
  const [storyReactions, setStoryReactions] = useState({})
  const [optimisticReaction, setOptimisticReaction] = useState(null)
  const [reactionPulse, setReactionPulse] = useState(null)
  const [showReactionPicker, setShowReactionPicker] = useState(false)
  const [showReplyEmoji, setShowReplyEmoji] = useState(false)
  const [meetupData, setMeetupData] = useState(null)
  const [fetchedPlaceCoords, setFetchedPlaceCoords] = useState(null)
  const [participantProfiles, setParticipantProfiles] = useState({})
  const [countdownTick, setCountdownTick] = useState(0)
  const [confirmJoinMeetup, setConfirmJoinMeetup] = useState(false)
  const [joiningMeetup, setJoiningMeetup] = useState(false)
  const [isPresent, setIsPresent] = useState(true)
  const [swipeClosing, setSwipeClosing] = useState(false)
  const [slideGeneration, setSlideGeneration] = useState(0)
  const swipeRef = useRef({ tracking: false, active: false, dy: 0, direction: null })
  const swipeY = useMotionValue(0)
  const swipeProgress = useTransform(swipeY, [0, SWIPE_RANGE_PX], [0, 1])
  const swipeScale = useTransform(swipeProgress, [0, 1], [1, 0.82])
  const swipeRadius = useTransform(swipeProgress, [0, 1], ['0px', '32px'])
  const slideDirectionRef = useRef(1)
  const frameRef = useRef(null)
  const rafRef = useRef(null)
  const startRef = useRef(0)
  const elapsedRef = useRef(0)
  const holdTimerRef = useRef(null)
  const holdActiveRef = useRef(false)
  const pointerRef = useRef({ time: 0, x: 0, y: 0, zone: 'center' })
  const queueRef = useRef(sessionQueue)
  const navRef = useRef(nav)
  const openedAtRef = useRef(performance.now())
  const blockGhostClickRef = useRef(false)
  const closedRef = useRef(false)
  const lastCenterTapRef = useRef(0)
  const recordedViewsRef = useRef(new Set())
  const replyInputRef = useRef(null)
  const replyInFlightRef = useRef(false)
  const meetupStoryHandledRef = useRef(null)
  const navigate = useNavigate()
  queueRef.current = sessionQueue
  navRef.current = nav

  useEffect(() => {
    if (!viewerId) return
    deleteExpiredStories(viewerId).catch(() => {})
  }, [viewerId])

  const OPEN_TAP_GUARD_MS = 400

  const beginUserSlide = useCallback((direction) => {
    slideDirectionRef.current = direction
    setSlideGeneration((g) => g + 1)
  }, [])

  const requestClose = useCallback(() => {
    blockGhostClickRef.current = true
    setIsPresent(false)
  }, [])

  /** Let the swipe carry the story the rest of the way out instead of scaling to the avatar. */
  const closeBySwipe = useCallback(() => {
    setSwipeClosing(true)
    animate(swipeY, window.innerHeight, STORY_CLOSE_TRANSITION)
    requestClose()
  }, [requestClose, swipeY])

  const scheduleClose = requestClose

  const finishClose = useCallback(() => {
    if (closedRef.current) return
    closedRef.current = true
    onClose()
    window.setTimeout(() => {
      blockGhostClickRef.current = false
    }, 400)
  }, [onClose])

  useEffect(() => {
    const swallowGhostClick = (e) => {
      if (!blockGhostClickRef.current) return
      e.preventDefault()
      e.stopPropagation()
    }
    document.addEventListener('click', swallowGhostClick, true)
    document.addEventListener('touchend', swallowGhostClick, true)
    return () => {
      document.removeEventListener('click', swallowGhostClick, true)
      document.removeEventListener('touchend', swallowGhostClick, true)
    }
  }, [])

  useEffect(() => {
    const active = document.activeElement
    if (
      active &&
      active !== document.body &&
      !active.closest?.('[data-story-viewer]')
    ) {
      active.blur()
    }

    const blockBackgroundKeys = (e) => {
      if (e.target.closest?.('[data-story-viewer]')) return
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault()
        e.stopPropagation()
      }
    }
    document.addEventListener('keydown', blockBackgroundKeys, true)
    return () => document.removeEventListener('keydown', blockBackgroundKeys, true)
  }, [])

  useEffect(() => {
    if (isPresent) return
    const fallback = window.setTimeout(finishClose, 500)
    return () => clearTimeout(fallback)
  }, [isPresent, finishClose])

  const handleShellAnimationComplete = () => {
    if (!isPresent) finishClose()
  }

  const resolved = resolveStoryNav(sessionQueue, nav)
  const openMotion = useMemo(() => getStoryOpenMotion(openOrigin), [openOrigin])
  // Keep last valid frame so close can animate even if the story drops out mid-exit
  // (common for non-friend / public stories when the parent feed refreshes).
  if (resolved.entry && resolved.story) {
    frameRef.current = resolved
  }
  const frame = resolved.entry && resolved.story ? resolved : frameRef.current
  const { userIndex, storyIndex, entry, stories, story } = frame || resolved
  const ownerId = entry?.userId
  const owner = users[ownerId]
  const isOwn = viewerId === ownerId
  const isFriend = friendIds.includes(ownerId)
  const canReply =
    !isOwn &&
    (isFriend ||
      canDirectMessage({ myProfile: viewerProfile, otherProfile: owner, otherId: ownerId }))
  const viewCount = watchers.length

  let effectiveReactions = storyReactions
  if (optimisticReaction && optimisticReaction.storyId === story?.id) {
    effectiveReactions = { ...storyReactions }
    if (optimisticReaction.emoji) effectiveReactions[viewerId] = optimisticReaction.emoji
    else delete effectiveReactions[viewerId]
  }

  const isMeetupAnnouncement = isMeetupStory(story)
  const meetupLoaded = Boolean(meetupData)
  const meetupChatId = meetupData?.chatId || story?.meetupChatId || null
  const meetupExpiresAtMs = meetupData
    ? meetupExpiryMs(meetupData)
    : toTimestampMs(story?.meetupExpiresAt)
  const meetupStillActive = meetupLoaded
    ? isMeetupActive(meetupData)
    : meetupExpiresAtMs > 0
      ? meetupExpiresAtMs > Date.now()
      : true
  const isJoinedMeetup = isOwn || Boolean(meetupData?.participants?.includes(viewerId))
  const meetupIsFull =
    meetupLoaded &&
    (meetupData.participants?.length || 0) >= (meetupData.maxMembers || 0)
  const showMeetupJoin =
    isMeetupAnnouncement &&
    !isOwn &&
    viewerId &&
    !isJoinedMeetup &&
    meetupStillActive &&
    (meetupLoaded ? !meetupIsFull : true)
  const meetupTimeLeft =
    !isMeetupAnnouncement || !meetupExpiresAtMs
      ? ''
      : formatMeetupStoryTimer(meetupExpiresAtMs)
  const mapCoords = getMeetupMapCoords(story, meetupData) || fetchedPlaceCoords
  const mapCoordsPending =
    isMeetupAnnouncement &&
    !mapCoords &&
    Boolean(story?.meetupPlaceId || meetupData?.placeId || story?.meetupPlaceLat)
  const meetupMaxMembers = meetupData?.maxMembers || story?.meetupMaxMembers || 10
  const meetupParticipants = meetupData?.participants ?? story?.meetupParticipantIds ?? []
  const effectiveParticipantProfiles = useMemo(() => {
    const merged = { ...participantProfiles }
    const storyGenders = story?.meetupParticipantGenders || {}

    meetupParticipants.forEach((id) => {
      if (storyGenders[id]) {
        merged[id] = { ...(merged[id] || {}), gender: storyGenders[id] }
      } else if (!merged[id]?.gender && users[id]?.gender) {
        merged[id] = { ...(merged[id] || {}), gender: users[id].gender }
      }
    })

    return merged
  }, [participantProfiles, story?.meetupParticipantGenders, meetupParticipants, users])

  const interactionBlocked =
    replyFocused ||
    showWatchers ||
    showReactionPicker ||
    showReplyEmoji ||
    replying ||
    confirmDelete ||
    confirmJoinMeetup ||
    Boolean(profileUserId)
  const isPaused = paused || holding || interactionBlocked

  useEffect(() => {
    const nextStory = stories[storyIndex + 1]
    const nextOwnerId = entry?.userId
    const nextOwnerPhoto = users[nextOwnerId]?.photos?.[0]
    if (nextOwnerPhoto) {
      const img = new Image()
      img.decoding = 'async'
      img.src = nextOwnerPhoto
    }
    if (nextStory?.imageUrl) {
      const img = new Image()
      img.decoding = 'async'
      img.src = nextStory.imageUrl
    }
    if (isMeetupStory(story)) {
      const coords = getMeetupMapCoords(story, null)
      if (coords) {
        preloadMeetupMapTiles(coords.lat, coords.lng)
      } else if (story.meetupPlaceId) {
        fetchMapPlace(story.meetupPlaceId).then((place) => {
          if (place?.lat != null && place?.lng != null) {
            preloadMeetupMapTiles(place.lat, place.lng)
          }
        })
      }
    }
  }, [storyIndex, stories, entry?.userId, users, story])

  const {
    inset: keyboardInset,
    keyboardOpen,
    ease: keyboardEase,
    ms: keyboardMs,
  } = useOverlayKeyboardInset(canReply)

  // Typing with keyboard open: send takes the reaction slot. Keyboard dismiss resets.
  const replyComposing = keyboardOpen && Boolean(replyText.trim())
  const showDesktopSend = !isMobileInputDevice() && !replyComposing

  useEffect(() => {
    if (!replyComposing) return
    setShowReactionPicker(false)
    setShowReplyEmoji(false)
  }, [replyComposing])

  useEffect(() => {
    if (!replyFocused && !keyboardOpen) return
    resetDocumentScroll()
  }, [replyFocused, keyboardOpen, keyboardInset])

  const footerReserve = canReply
    ? keyboardOpen
      ? `calc(${keyboardInset}px + 80px)`
      : 'calc(var(--ios-safe-bottom) + 128px)'
    : isOwn
      ? 'calc(var(--ios-safe-bottom) + 72px)'
      : 'calc(var(--ios-safe-bottom) + 56px)'

  const replyFooterStyle = {
    paddingBottom: keyboardOpen ? '12px' : 'calc(var(--ios-safe-bottom) + 12px)',
    marginBottom: keyboardOpen ? `${keyboardInset}px` : '0px',
    transition: `margin-bottom ${keyboardMs}ms ${keyboardEase}, padding-bottom ${keyboardMs}ms ${keyboardEase}`,
  }

  const goNextStory = useCallback(() => {
    setReplyText('')
    setProgress(0)
    elapsedRef.current = 0

    const q = queueRef.current
    const { userIndex: ui, storyIndex: si } = navRef.current
    const currentStories = q[ui]?.stories || []

    if (si < currentStories.length - 1) {
      setNav({ userIndex: ui, storyIndex: si + 1 })
      return
    }

    const nextUser = findNextUserWithStories(q, ui)
    if (nextUser >= 0) {
      beginUserSlide(1)
      setNav({ userIndex: nextUser, storyIndex: 0 })
      return
    }

    scheduleClose()
  }, [scheduleClose, beginUserSlide])

  const goPrevStory = useCallback(() => {
    setReplyText('')
    setProgress(0)
    elapsedRef.current = 0

    const q = queueRef.current
    const { userIndex: ui, storyIndex: si } = navRef.current

    if (si > 0) {
      setNav({ userIndex: ui, storyIndex: si - 1 })
      return
    }

    const prevUser = findPrevUserWithStories(q, ui)
    if (prevUser >= 0) {
      const prevStories = q[prevUser]?.stories || []
      beginUserSlide(-1)
      setNav({
        userIndex: prevUser,
        storyIndex: Math.max(0, prevStories.length - 1),
      })
      return
    }

    scheduleClose()
  }, [scheduleClose, beginUserSlide])

  useEffect(() => {
    if (!story?.id || !viewerId || !ownerId || isOwn) return
    const viewKey = `${ownerId}:${story.id}`
    if (recordedViewsRef.current.has(viewKey)) return
    recordedViewsRef.current.add(viewKey)
    const createdMs = storyCreatedMs(story)
    onStoryViewed?.(ownerId, createdMs)
    recordStoryView(
      viewerId,
      ownerId,
      story.id,
      viewerUsername,
      viewerPhoto,
      createdMs
    ).catch(() => {
      recordedViewsRef.current.delete(viewKey)
    })
  }, [story?.id, viewerId, ownerId, viewerUsername, viewerPhoto, isOwn, onStoryViewed])

  useEffect(() => {
    if (!isOwn || !story?.id) return
    return subscribeStoryWatchers(ownerId, story.id, setWatchers)
  }, [isOwn, ownerId, story?.id])

  useEffect(() => {
    if (!ownerId || !story?.id) {
      setStoryReactions({})
      return
    }
    return subscribeStoryReactions(ownerId, story.id, setStoryReactions)
  }, [ownerId, story?.id])

  useEffect(() => {
    setOptimisticReaction(null)
  }, [story?.id])

  useLayoutEffect(() => {
    if (!isMeetupAnnouncement || !story?.meetupId) {
      setMeetupData(null)
      return
    }

    let cancelled = false
    fetchMeetup(story.meetupId).then((data) => {
      if (!cancelled && data) {
        setMeetupData((prev) => prev || data)
        if (data.participants?.length) {
          fetchUsersMap(data.participants).then((profiles) => {
            if (!cancelled) setParticipantProfiles(profiles)
          })
        }
      }
    })

    const unsub = subscribeMeetup(story.meetupId, (data) => {
      setMeetupData(data)
      if (data?.participants?.length) {
        fetchUsersMap(data.participants).then((profiles) => {
          if (!cancelled) setParticipantProfiles(profiles)
        })
      }
    })
    return () => {
      cancelled = true
      unsub()
    }
  }, [isMeetupAnnouncement, story?.meetupId])

  useLayoutEffect(() => {
    const ids = meetupData?.participants ?? story?.meetupParticipantIds ?? []
    const storyGenders = story?.meetupParticipantGenders || {}

    if (Object.keys(storyGenders).length > 0) {
      setParticipantProfiles((prev) => {
        const next = { ...prev }
        Object.entries(storyGenders).forEach(([id, gender]) => {
          next[id] = { ...(next[id] || {}), gender }
        })
        return next
      })
    }

    if (!ids.length) return

    let cancelled = false
    fetchUsersMap(ids).then((profiles) => {
      if (!cancelled) setParticipantProfiles((prev) => ({ ...prev, ...profiles }))
    })

    return () => {
      cancelled = true
    }
  }, [
    meetupData?.participants?.join(','),
    story?.meetupParticipantIds?.join(','),
    story?.id,
  ])

  useLayoutEffect(() => {
    if (!isMeetupAnnouncement) {
      setFetchedPlaceCoords(null)
      return
    }

    const coords = getMeetupMapCoords(story, meetupData)
    if (coords) {
      preloadMeetupMapTiles(coords.lat, coords.lng)
      return
    }

    const placeId = story?.meetupPlaceId || meetupData?.placeId
    if (!placeId) return

    let cancelled = false
    fetchMapPlace(placeId).then((place) => {
      if (cancelled || place?.lat == null || place?.lng == null) return
      const nextCoords = { lat: place.lat, lng: place.lng }
      setFetchedPlaceCoords(nextCoords)
      preloadMeetupMapTiles(nextCoords.lat, nextCoords.lng)
    })

    return () => {
      cancelled = true
    }
  }, [
    isMeetupAnnouncement,
    story?.id,
    story?.meetupPlaceId,
    story?.meetupPlaceLat,
    story?.meetupPlaceLng,
    meetupData?.placeId,
    meetupData?.placeLat,
    meetupData?.placeLng,
  ])

  useEffect(() => {
    if (!isMeetupAnnouncement || !meetupExpiresAtMs) return
    const timer = window.setInterval(() => setCountdownTick((tick) => tick + 1), 1000)
    return () => window.clearInterval(timer)
  }, [isMeetupAnnouncement, meetupExpiresAtMs])

  useEffect(() => {
    setConfirmJoinMeetup(false)
    meetupStoryHandledRef.current = null
  }, [story?.id])

  useEffect(() => {
    if (!isMeetupAnnouncement || !story?.id) return

    const expiredByStory = meetupExpiresAtMs > 0 && meetupExpiresAtMs <= Date.now()
    const expiredByMeetup = meetupLoaded && meetupData && !isMeetupActive(meetupData)
    if (!expiredByStory && !expiredByMeetup) return

    const handleKey = `${story.id}:${expiredByMeetup ? 'live' : 'story'}`
    if (meetupStoryHandledRef.current === handleKey) return
    meetupStoryHandledRef.current = handleKey

    const removeStory = async () => {
      if (isOwn) {
        try {
          await deleteStory(viewerId, story.id)
        } catch {
          // Feed sync will still hide ended meetup stories.
        }
        setSessionQueue((prev) =>
          prev.map((entry) => ({
            ...entry,
            stories: entry.stories.filter((s) => s.id !== story.id),
          }))
        )
      }
      goNextStory()
    }

    removeStory()
  }, [
    isMeetupAnnouncement,
    story?.id,
    meetupExpiresAtMs,
    meetupLoaded,
    meetupData,
    isOwn,
    viewerId,
    goNextStory,
  ])

  useEffect(() => {
    if (!showReactionPicker) return
    const handleOutside = (e) => {
      if (e.target.closest?.('[data-reaction-ui]')) return
      setShowReactionPicker(false)
    }
    document.addEventListener('pointerdown', handleOutside, true)
    return () => document.removeEventListener('pointerdown', handleOutside, true)
  }, [showReactionPicker])

  useEffect(() => {
    if (!showWatchers || watchers.length === 0) return
    let cancelled = false

    ;(async () => {
      const photos = {}
      const deleted = {}
      await Promise.all(
        watchers.map(async (w) => {
          const id = w.viewerId || w.id
          const user = await fetchUser(id)
          if (user?.photos?.[0]) {
            photos[id] = user.photos[0]
            return
          }
          const deletedUser = await fetchDeletedUser(id)
          if (deletedUser) {
            deleted[id] = true
            return
          }
          if (w.photoUrl) photos[id] = w.photoUrl
        })
      )
      if (!cancelled) {
        setWatcherPhotos(photos)
        setWatcherDeleted(deleted)
      }
    })()

    return () => {
      cancelled = true
    }
  }, [watchers, showWatchers])

  useEffect(() => {
    if (story || !sessionQueue.length) return
    if (!sessionQueue.some((entry) => entry.stories?.length)) {
      scheduleClose()
    }
  }, [story, sessionQueue, scheduleClose])

  useEffect(() => {
    if (!story || isPaused) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      return
    }

    startRef.current = performance.now() - elapsedRef.current

    const tick = (now) => {
      const elapsed = now - startRef.current
      const pct = Math.min(1, elapsed / STORY_DURATION_MS)
      setProgress(pct)
      if (pct >= 1) {
        goNextStory()
        return
      }
      rafRef.current = requestAnimationFrame(tick)
    }

    rafRef.current = requestAnimationFrame(tick)
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [story?.id, isPaused, goNextStory])

  const clearHoldTimer = () => {
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current)
      holdTimerRef.current = null
    }
  }

  const handleStoryReaction = async (emoji) => {
    if (!viewerId || isOwn || !ownerId || !story?.id || !emoji) return

    const removing = effectiveReactions[viewerId] === emoji
    setOptimisticReaction({ storyId: story.id, emoji: removing ? null : emoji })
    if (!removing) {
      setReactionPulse(emoji)
      window.setTimeout(() => setReactionPulse(null), 700)
    }

    try {
      await setStoryReaction(ownerId, story.id, viewerId, emoji, viewerUsername || 'User')
    } catch {
      setOptimisticReaction(null)
      toast.error('Could not react')
    }
  }

  const handleStoryPointerDown = (e) => {
    if (interactionBlocked) return

    const zone = getTapZone(e.clientX)
    pointerRef.current = { time: performance.now(), x: e.clientX, y: e.clientY, zone }
    swipeRef.current = { tracking: true, active: false, dy: 0, direction: null }
    holdActiveRef.current = false
    clearHoldTimer()

    if (zone === 'center') {
      holdTimerRef.current = setTimeout(() => {
        holdActiveRef.current = true
        elapsedRef.current += performance.now() - startRef.current
        setHolding(true)
      }, 120)
    }
  }

  const handleStoryPointerMove = (e) => {
    if (interactionBlocked || swipeClosing) return

    const swipe = swipeRef.current
    // Only a pressed pointer drags — a hovering mouse also fires pointermove.
    if (!swipe.tracking) return
    if (e.pointerType === 'mouse' && e.buttons === 0) {
      swipe.tracking = false
      if (swipe.active) {
        swipe.active = false
        swipe.dy = 0
        swipe.direction = null
        animate(swipeY, 0, SWIPE_SNAP_BACK)
      }
      return
    }

    const dy = e.clientY - pointerRef.current.y
    const dx = e.clientX - pointerRef.current.x
    if (!swipe.active) {
      if (Math.abs(dy) < SWIPE_START_PX || Math.abs(dy) <= Math.abs(dx)) return
      const goingUp = dy < 0
      // Up only when it can open reply or the viewers sheet.
      if (goingUp && !canReply && !isOwn) return
      swipe.active = true
      swipe.direction = goingUp ? 'up' : 'down'
      // A drag is not a tap — drop the pending long-press so the story does not pause.
      clearHoldTimer()
    }

    if (swipe.direction === 'up') {
      // Track distance only — do not lift the story (avoids a black gap under the canvas).
      swipe.dy = Math.max(0, -dy)
      return
    }

    swipe.dy = Math.max(0, dy)
    swipeY.set(swipe.dy)
  }

  const focusStoryReply = useCallback(() => {
    setPaused(true)
    setReplyFocused(true)
    // Keep focus in the same gesture tick so the system keyboard can open on iOS.
    // preventScroll stops WKWebView from panning the page before our inset lifts the footer.
    focusFieldWithoutScroll(replyInputRef.current)
  }, [])

  const handleReplyFieldPointerDown = (e) => {
    // Emoji / send controls handle their own taps.
    if (e.target.closest('button')) return
    const field = replyInputRef.current
    // Field hits: global prevent-scroll focus owns first open; allow caret when editing.
    if (field && (e.target === field || field.contains?.(e.target))) {
      if (document.activeElement === field) return
      e.preventDefault()
      e.stopPropagation()
      focusStoryReply()
      return
    }
    // Pad around the field — same path as swipe-up.
    e.preventDefault()
    e.stopPropagation()
    focusStoryReply()
  }

  const handleStoryPointerUp = (e) => {
    const swipe = swipeRef.current
    swipe.tracking = false
    if (swipe.active) {
      const direction = swipe.direction
      const distance = swipe.dy
      swipeRef.current = { tracking: false, active: false, dy: 0, direction: null }
      clearHoldTimer()
      setHolding(false)
      holdActiveRef.current = false

      const heldMs = Math.max(1, performance.now() - pointerRef.current.time)
      const velocity = distance / heldMs

      if (direction === 'up') {
        const committed = distance > SWIPE_UP_PX || velocity > SWIPE_UP_VELOCITY
        if (committed) {
          if (canReply) focusStoryReply()
          else if (isOwn) setShowWatchers(true)
        }
        return
      }

      if (distance > SWIPE_CLOSE_PX || velocity > SWIPE_CLOSE_VELOCITY) closeBySwipe()
      else animate(swipeY, 0, SWIPE_SNAP_BACK)
      return
    }

    if (performance.now() - openedAtRef.current < OPEN_TAP_GUARD_MS) return

    const zone = pointerRef.current.zone
    const wasHolding = holding || holdActiveRef.current
    clearHoldTimer()
    setHolding(false)
    holdActiveRef.current = false

    if (interactionBlocked || wasHolding) return

    const elapsed = performance.now() - pointerRef.current.time
    if (elapsed > 280) return

    if (zone === 'center' && !isOwn) {
      const now = performance.now()
      if (now - lastCenterTapRef.current < 300) {
        e.preventDefault()
        e.stopPropagation()
        lastCenterTapRef.current = 0
        handleStoryReaction('❤️')
        return
      }
      lastCenterTapRef.current = now
      return
    }

    if (zone === 'left') {
      e.preventDefault()
      e.stopPropagation()
      goPrevStory()
    } else if (zone === 'right') {
      e.preventDefault()
      e.stopPropagation()
      goNextStory()
    }
  }

  const handleStoryPointerCancel = () => {
    clearHoldTimer()
    setHolding(false)
    holdActiveRef.current = false
    const wasActive = swipeRef.current.active
    swipeRef.current = { tracking: false, active: false, dy: 0, direction: null }
    if (wasActive && !swipeClosing) animate(swipeY, 0, SWIPE_SNAP_BACK)
  }

  const handleDelete = async () => {
    if (!isOwn || !story || deleting) return
    setDeleting(true)
    try {
      await deleteStory(viewerId, story.id)
      toast.success('Story deleted')
      setSessionQueue((prev) =>
        prev.map((entry) => ({
          ...entry,
          stories: entry.stories.filter((s) => s.id !== story.id),
        }))
      )
      if (stories.length <= 1) {
        const q = queueRef.current
        const hasOtherUsers = findNextUserWithStories(q, userIndex) >= 0 || findPrevUserWithStories(q, userIndex) >= 0
        if (!hasOtherUsers) scheduleClose()
        else goNextStory()
      } else if (storyIndex >= stories.length - 1) {
        setNav(({ userIndex: ui, storyIndex: si }) => ({
          userIndex: ui,
          storyIndex: Math.max(0, si - 1),
        }))
      }
      setProgress(0)
      elapsedRef.current = 0
    } catch {
      toast.error('Failed to delete story')
    } finally {
      setDeleting(false)
    }
  }

  const handleShare = async () => {
    if (!story || !owner) return
    try {
      const result = await shareStory(story, { ...owner, id: owner.id || story.userId || ownerId })
      if (result?.copied) toast.success('Link copied!')
    } catch (err) {
      if (err?.name !== 'AbortError') toast.error('Could not share story')
    }
  }

  const openProfileOverlay = (userId) => {
    if (!userId) return
    setProfileUserId(userId)
  }

  const closeProfileOverlay = () => setProfileUserId(null)

  const handleConfirmJoinMeetup = async () => {
    if (!story?.meetupId || !viewerId || joiningMeetup) return
    setJoiningMeetup(true)
    try {
      const { chatId } = await joinMeetup(story.meetupId, viewerId)
      toast.success('Joined meetup!')
      setConfirmJoinMeetup(false)
      requestClose()
      navigate(`/chats/${chatId}`)
    } catch (err) {
      toast.error(err.message || 'Could not join meetup')
    } finally {
      setJoiningMeetup(false)
    }
  }

  const handleReply = async () => {
    const trimmed = replyText.trim()
    if (!trimmed || !canReply || !story || replyInFlightRef.current) return

    const sentText = trimmed
    replyInFlightRef.current = true
    setReplying(true)

    setReplyText('')
    setShowReplyEmoji(false)
    elapsedRef.current = progress * STORY_DURATION_MS
    setReplyFocused(false)
    setPaused(false)
    replyInputRef.current?.blur()
    setReplySentPulse(true)
    window.setTimeout(() => setReplySentPulse(false), 520)

    try {
      await replyToStory(viewerId, ownerId, story, sentText, viewerUsername, owner?.username)
    } catch (err) {
      setReplyText(sentText)
      toast.error(err.message || 'Could not send reply')
    } finally {
      replyInFlightRef.current = false
      setReplying(false)
    }
  }

  const closeScale = Math.min(openMotion.initialScale, 0.86)

  // While closing, keep a shell mounted even if the story became unavailable.
  if (!entry || !story) {
    if (isPresent) return null
    return createPortal(
      <motion.div
        data-story-viewer
        initial={{ scale: 1, opacity: 1 }}
        animate={{ scale: closeScale, opacity: 0 }}
        transition={STORY_CLOSE_TRANSITION}
        onAnimationComplete={handleShellAnimationComplete}
        style={{ transformOrigin: openMotion.transformOrigin }}
        className="fixed inset-0 z-[110] overflow-hidden will-change-transform bg-black"
      />,
      document.body
    )
  }

  const userSlideKey = `${userIndex}-${ownerId}`
  const slideCustom = { direction: slideDirectionRef.current }

  return createPortal(
    <motion.div
      data-story-viewer
      initial={{ scale: openMotion.initialScale, opacity: 1 }}
      animate={
        isPresent
          ? { scale: 1, opacity: 1 }
          : swipeClosing
            ? { scale: 1, opacity: 0 }
            : { scale: closeScale, opacity: 0 }
      }
      transition={isPresent ? storyShellTransition : STORY_CLOSE_TRANSITION}
      onAnimationComplete={handleShellAnimationComplete}
      style={{ transformOrigin: openMotion.transformOrigin }}
      className="fixed inset-0 z-[110] overflow-hidden will-change-transform bg-black"
    >
      {/* Swipe-to-dismiss layer: the story itself travels, the shell only fades. */}
      <motion.div
        className="absolute inset-0 overflow-hidden"
        style={{ y: swipeY, scale: swipeScale, borderRadius: swipeRadius }}
      >
      <AnimatePresence custom={slideCustom}>
        <motion.div
          key={userSlideKey}
          custom={slideCustom}
          variants={storySlideVariants}
          initial={slideGeneration > 0 ? 'enter' : false}
          animate="center"
          exit="exit"
          transition={storyUserSlideTransition}
          className={`absolute inset-0 flex flex-col ${getStoryColorClass(story.color)}`}
        >
        <div className="px-3 pt-[calc(var(--ios-safe-top)+8px)] flex gap-1.5">
          {stories.map((s, i) => (
            <div
              key={s.id}
              className={`flex-1 h-[3px] rounded-full overflow-hidden ${storyProgressTrackClass}`}
            >
              <div
                className={`h-full transition-none ${storyProgressFillClass}`}
                style={{
                  width: i < storyIndex ? '100%' : i === storyIndex ? `${progress * 100}%` : '0%',
                }}
              />
            </div>
          ))}
        </div>

        <div key={`story-header-${story.id}`} className="relative z-30 flex items-center justify-between gap-2 px-4 py-3">
          <button
            type="button"
            onClick={() => openProfileOverlay(ownerId)}
            className={storyAuthorBubbleClass}
            aria-label={`View ${owner?.username || 'user'}'s profile`}
          >
            <img
              src={owner?.photos?.[0] || sad}
              alt=""
              className="w-8 h-8 rounded-full object-cover shrink-0 ring-1 ring-white/20"
            />
            <div className="min-w-0 text-left">
              <p className="font-semibold text-sm truncate text-white inline-flex items-center gap-1">
                <UsernameLabel
                  username={owner?.username}
                  className="font-semibold text-sm truncate text-white"
                  badgeSize={14}
                />
              </p>
              <p className="text-[11px] text-white/65 leading-tight">
                {formatStoryTime(storyCreatedMs(story))}
              </p>
            </div>
          </button>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={handleShare}
              className={storyGlassButtonClass}
              aria-label="Share story"
            >
              <IconShare size={20} />
            </button>
            {isOwn && (
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                disabled={deleting}
                className={storyGlassButtonClass}
                aria-label="Delete story"
              >
                <IconTrash size={20} />
              </button>
            )}
            <button type="button" onClick={requestClose} className={storyGlassButtonClass} aria-label="Close">
              <IconX size={22} />
            </button>
          </div>
        </div>

        <div
          className="absolute inset-x-0 top-[72px] z-[6] touch-none select-none"
          style={{ bottom: footerReserve }}
          onPointerDown={handleStoryPointerDown}
          onPointerMove={handleStoryPointerMove}
          onPointerUp={handleStoryPointerUp}
          onPointerLeave={handleStoryPointerCancel}
          onPointerCancel={handleStoryPointerCancel}
          aria-hidden
        />

        {/*
          Content sits above the gesture layer with pointer-events-none so empty
          taps fall through (same path as text stories). Only CTAs/reactions
          opt back in with pointer-events-auto.
        */}
        <div className="flex-1 flex items-center justify-center px-8 select-none relative min-h-0 pointer-events-none z-[8]">
          {isMeetupAnnouncement ? (
            <MeetupStoryCard
              variant="story"
              story={story}
              meetupData={meetupData}
              meetupChatId={meetupChatId}
              meetupTimeLeft={meetupTimeLeft}
              mapCoords={mapCoords}
              mapCoordsPending={mapCoordsPending}
              meetupMaxMembers={meetupMaxMembers}
              meetupParticipants={meetupParticipants}
              participantProfiles={effectiveParticipantProfiles}
              isOwn={isOwn}
              showJoin={showMeetupJoin}
              isJoined={isJoinedMeetup}
              meetupStillActive={meetupStillActive}
              meetupIsFull={meetupIsFull}
              keyboardOpen={keyboardOpen}
              onJoinClick={() => setConfirmJoinMeetup(true)}
              onOpenChat={() => {
                if (!meetupChatId) return
                requestClose()
                navigate(`/chats/${meetupChatId}`)
              }}
            />
          ) : (
            <p className="text-2xl sm:text-3xl font-semibold leading-relaxed text-center text-white whitespace-pre-wrap break-words drop-shadow-[0_2px_12px_rgba(0,0,0,0.25)]">
              {story.text}
            </p>
          )}
          {Object.keys(effectiveReactions).length > 0 && (
            <MessageReactions
              reactions={effectiveReactions}
              isOwn={isOwn}
              currentUserId={viewerId}
              onEmojiClick={!isOwn ? handleStoryReaction : undefined}
              className="absolute bottom-4 left-4 right-4 justify-center pointer-events-auto"
            />
          )}
          <AnimatePresence>
            {reactionPulse && (
              <motion.span
                key={reactionPulse}
                initial={{ scale: 0.4, opacity: 0 }}
                animate={{ scale: 1.4, opacity: 1 }}
                exit={{ scale: 1.8, opacity: 0 }}
                transition={{ duration: 0.55, ease: [0.34, 1.4, 0.64, 1] }}
                className="absolute pointer-events-none"
              >
                <IosEmoji emoji={reactionPulse} size={56} />
              </motion.span>
            )}
          </AnimatePresence>
          {holding && (
            <div className={`absolute bottom-4 left-1/2 -translate-x-1/2 ${storyPausedBadgeClass}`}>
              Paused
            </div>
          )}
        </div>

        {canReply && (
          <div
            key={`story-reply-${story.id}`}
            className="relative z-30 px-4 pt-2"
            style={replyFooterStyle}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
          >
            <EmojiPickerPopover
              open={showReplyEmoji}
              onClose={() => setShowReplyEmoji(false)}
              onEmojiClick={(emoji) =>
                setReplyText((prev) => (prev + emoji).slice(0, MAX_STORY_REPLY_LENGTH))
              }
              className="absolute bottom-full left-4 mb-2 z-40"
            />
            <div
              className={`flex items-center gap-2 ${STORY_FOOTER_ROW_H}`}
              onPointerDown={handleReplyFieldPointerDown}
            >
              <div
                className={`flex-1 flex items-center gap-2 rounded-full px-3 min-w-0 h-full ${storyGlassInputClass}`}
              >
                <button
                  type="button"
                  onClick={() => setShowReplyEmoji((value) => !value)}
                  className="h-8 w-8 shrink-0 flex items-center justify-center text-white/60 hover:text-white rounded-full transition-colors"
                  aria-label="Add emoji"
                  aria-expanded={showReplyEmoji}
                >
                  <IconMoodSmile size={20} />
                </button>
                <div className="flex-1 min-w-0">
                  <IosEmojiField
                    data-story-reply-input
                    value={replyText}
                    maxLength={MAX_STORY_REPLY_LENGTH}
                    onChange={(e) => setReplyText(e.target.value.slice(0, MAX_STORY_REPLY_LENGTH))}
                    onKeyDown={(e) => {
                      e.stopPropagation()
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault()
                        handleReply()
                      }
                    }}
                    ref={replyInputRef}
                    onFocus={() => {
                      resetDocumentScroll()
                      elapsedRef.current = progress * STORY_DURATION_MS
                      setReplyFocused(true)
                      setPaused(true)
                    }}
                    onBlur={() => {
                      setReplyFocused(false)
                      setPaused(false)
                    }}
                    placeholder={`Reply to ${owner?.username || 'user'}…`}
                    className="ios-emoji-field w-full bg-transparent text-[15px] text-white outline-none min-w-0 empty:before:text-white/50"
                  />
                </div>
                {showDesktopSend ? (
                  <motion.button
                    type="button"
                    onClick={handleReply}
                    disabled={replying || !replyText.trim()}
                    whileTap={{ scale: 0.88 }}
                    animate={
                      replying
                        ? { scale: [1, 0.92, 1], rotate: [0, -12, 0] }
                        : replySentPulse
                          ? { scale: [1, 1.15, 1], opacity: [1, 0.7, 1] }
                          : { scale: 1 }
                    }
                    transition={{ duration: 0.35 }}
                    className={`${storyGlassButtonClass} !h-8 !w-8 !p-0 bg-[var(--ios-blue)] border-[var(--ios-blue)] disabled:opacity-40`}
                    aria-label="Send reply"
                  >
                    <IconSend size={18} />
                  </motion.button>
                ) : null}
              </div>

              <AnimatePresence initial={false} mode="popLayout">
                {replyComposing ? (
                  <motion.button
                    key="story-reply-send-slot"
                    type="button"
                    initial={{ opacity: 0, scale: 0.85 }}
                    animate={
                      replying
                        ? { opacity: 1, scale: [1, 0.92, 1], rotate: [0, -12, 0] }
                        : replySentPulse
                          ? { opacity: 1, scale: [1, 1.15, 1] }
                          : { opacity: 1, scale: 1 }
                    }
                    exit={{ opacity: 0, scale: 0.85 }}
                    transition={{ duration: 0.18 }}
                    whileTap={{ scale: 0.88 }}
                    onClick={handleReply}
                    disabled={replying || !replyText.trim()}
                    className={`${storyGlassButtonClass} h-full aspect-square !p-0 shrink-0 bg-[var(--ios-blue)] border-[var(--ios-blue)] disabled:opacity-40`}
                    aria-label="Send reply"
                  >
                    <IconSend size={18} />
                  </motion.button>
                ) : (
                  <motion.div
                    key="story-reply-reaction-slot"
                    initial={{ opacity: 0, scale: 0.85 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.85 }}
                    transition={{ duration: 0.18 }}
                    className="h-full shrink-0"
                  >
                    <StoryReactionButton
                      showReactionPicker={showReactionPicker}
                      onTogglePicker={() => setShowReactionPicker((v) => !v)}
                      storyReactions={effectiveReactions}
                      viewerId={viewerId}
                      onReact={(emoji) => {
                        handleStoryReaction(emoji)
                        setShowReactionPicker(false)
                      }}
                    />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        )}

        {isOwn && !canReply && (
          <div
            key={`story-views-${story.id}`}
            className="relative z-30 px-4 pb-[calc(var(--ios-safe-bottom)+12px)] pt-2 flex flex-col items-center gap-2"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setShowWatchers((v) => !v)}
              className={storyGlassPillClass}
              aria-label={`${viewCount} ${viewCount === 1 ? 'view' : 'views'}`}
            >
              <IconEye size={18} stroke={1.75} />
              <span className="text-sm font-semibold tabular-nums">{viewCount}</span>
            </button>
          </div>
        )}

        {!canReply && !isOwn && (
          <div
            key={`story-react-${story.id}`}
            className="relative z-30 px-4 pb-[calc(var(--ios-safe-bottom)+12px)] pt-2"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={`flex justify-center ${STORY_FOOTER_ROW_H}`}>
              <StoryReactionButton
                showReactionPicker={showReactionPicker}
                onTogglePicker={() => setShowReactionPicker((v) => !v)}
                storyReactions={effectiveReactions}
                viewerId={viewerId}
                iconSize={22}
                pickerAlign="center"
                onReact={(emoji) => {
                  handleStoryReaction(emoji)
                  setShowReactionPicker(false)
                }}
              />
            </div>
          </div>
        )}

        <AnimatePresence>
          {showWatchers && isOwn ? (
            <motion.div
              key="story-watchers"
              className="absolute inset-0 z-[40]"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18, ease: [0.32, 0.72, 0, 1] }}
            >
              <button
                type="button"
                className={storyWatchersScrimClass}
                onClick={() => setShowWatchers(false)}
                aria-label="Close views"
              />
              <motion.div
                initial={{ y: '100%' }}
                animate={{ y: 0 }}
                exit={{ y: '100%' }}
                transition={{ duration: 0.28, ease: [0.32, 0.72, 0, 1] }}
                className={storyWatchersSheetClass}
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="px-4 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-2 rounded-full px-4 py-2 bg-white/10 border border-white/10">
                    <IconEye size={16} stroke={1.75} />
                    <span className="font-semibold text-[15px] text-white tabular-nums">
                      {viewCount} {viewCount === 1 ? 'view' : 'views'}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowWatchers(false)}
                    className="h-10 w-10 flex items-center justify-center rounded-full bg-white/10 border border-white/10 text-white hover:bg-white/15 transition-colors"
                    aria-label="Close views"
                  >
                    <IconX size={20} />
                  </button>
                </div>
                <div className="overflow-y-auto max-h-[calc(50vh-52px)] px-4 py-2 border-t border-white/10">
                  {watchers.length === 0 ? (
                    <p className="text-center text-white/50 py-8 text-sm">No views yet</p>
                  ) : (
                    watchers.map((w) => {
                      const watcherId = w.viewerId || w.id
                      const isDeleted = watcherDeleted[watcherId]
                      const photo = isDeleted ? deletedAccountAvatarSrc : w.photoUrl || watcherPhotos[watcherId]
                      return (
                        <button
                          key={w.id}
                          type="button"
                          onClick={() => openProfileOverlay(watcherId)}
                          className="w-full flex items-center gap-3 py-3 px-1 text-left hover:bg-white/[0.04] active:bg-white/[0.08] transition-colors"
                        >
                          <img
                            src={photo || sad}
                            alt=""
                            className={`w-9 h-9 rounded-full object-cover shrink-0 ring-1 ring-white/10 ${
                              isDeleted ? deletedAccountAvatarClass : ''
                            }`}
                          />
                          <div className="min-w-0 flex-1">
                            <UsernameLabel
                              username={w.username}
                              className="font-medium text-sm truncate text-white"
                              badgeSize={12}
                            />
                            <p className="text-xs text-white/50 mt-0.5">
                              {formatStoryViewTime(w.viewedAt?.toMillis?.() ?? w.viewedAt)}
                            </p>
                          </div>
                          <span className="shrink-0 w-8 flex items-center justify-center" aria-hidden>
                            {storyReactions[watcherId] ? (
                              <IosEmoji emoji={storyReactions[watcherId]} size={20} />
                            ) : null}
                          </span>
                        </button>
                      )
                    })
                  )}
                </div>
              </motion.div>
            </motion.div>
          ) : null}
        </AnimatePresence>

        </motion.div>
      </AnimatePresence>
      </motion.div>

      <Modal
          isOpen={Boolean(profileUserId)}
          onClose={closeProfileOverlay}
          fullscreen
          overlayClassName="z-[120]"
        >
          {profileUserId && (
            <PublicProfileView
              userId={profileUserId}
              onClose={closeProfileOverlay}
              onDismissHost={() => {
                closeProfileOverlay()
                requestClose()
              }}
              suppressStoryViewer={profileUserId === ownerId}
            />
          )}
        </Modal>

        <ConfirmDialog
          isOpen={confirmJoinMeetup}
          onClose={() => !joiningMeetup && setConfirmJoinMeetup(false)}
          onConfirm={handleConfirmJoinMeetup}
          title="Join this meetup?"
          message={
            meetupData
              ? `Join "${meetupData.title}" at ${meetupData.placeName || 'the meetup spot'}? You'll be added to the group chat.`
              : 'Join this meetup and enter the group chat?'
          }
          confirmLabel="Join"
          loading={joiningMeetup}
          overlayClassName="z-[130]"
        />

        <ConfirmDialog
          isOpen={confirmDelete}
          onClose={() => !deleting && setConfirmDelete(false)}
          onConfirm={async () => {
            await handleDelete()
            setConfirmDelete(false)
          }}
          title="Delete story?"
          message="This story will be removed permanently. Views and replies will stay in chat history."
          confirmLabel="Delete"
          danger
          loading={deleting}
          overlayClassName="z-[130]"
        />
    </motion.div>,
    document.body
  )
}
