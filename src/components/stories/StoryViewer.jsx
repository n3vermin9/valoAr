import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion } from 'framer-motion'
import {
  IconX,
  IconTrash,
  IconShare,
  IconEye,
  IconSend,
} from '@tabler/icons-react'
import toast from 'react-hot-toast'
import {
  deleteStory,
  recordStoryView,
  replyToStory,
  subscribeStoryWatchers,
} from '../../services/storyService'
import {
  STORY_DURATION_MS,
  getStoryColorClass,
  storyCreatedMs,
  formatStoryTime,
  formatStoryViewTime,
  buildStoryShareText,
  MAX_STORY_REPLY_LENGTH,
  getStoryOpenMotion,
  storySlideVariants,
  storyUserSlideTransition,
} from '../../utils/storyHelpers'
import { fetchUser } from '../../services/userService'
import {
  storyGlassButtonClass,
  storyGlassPillClass,
  storyGlassInputClass,
  storyGlassSheetClass,
  storyAuthorBubbleClass,
  storyGlassRowClass,
  storyProgressTrackClass,
  storyProgressFillClass,
  storyPausedBadgeClass,
} from '../../utils/designSystem'
import ConfirmDialog from '../ui/ConfirmDialog'
import Modal from '../ui/Modal'
import { PublicProfileView } from '../profile/ProfileView'
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
}) {
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
  const [isPresent, setIsPresent] = useState(true)
  const [slideGeneration, setSlideGeneration] = useState(0)
  const slideDirectionRef = useRef(1)
  const rafRef = useRef(null)
  const startRef = useRef(0)
  const elapsedRef = useRef(0)
  const holdTimerRef = useRef(null)
  const holdActiveRef = useRef(false)
  const pointerRef = useRef({ time: 0, x: 0, zone: 'center' })
  const queueRef = useRef(sessionQueue)
  const navRef = useRef(nav)
  const openedAtRef = useRef(performance.now())
  const blockGhostClickRef = useRef(false)
  const closedRef = useRef(false)
  const recordedViewsRef = useRef(new Set())
  const replyInputRef = useRef(null)
  queueRef.current = sessionQueue
  navRef.current = nav

  const OPEN_TAP_GUARD_MS = 400

  const beginUserSlide = useCallback((direction) => {
    slideDirectionRef.current = direction
    setSlideGeneration((g) => g + 1)
  }, [])

  const requestClose = useCallback(() => {
    blockGhostClickRef.current = true
    setIsPresent(false)
  }, [])

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
  const { userIndex, storyIndex, entry, stories, story } = resolved
  const openMotion = useMemo(() => getStoryOpenMotion(openOrigin), [openOrigin])
  const ownerId = entry?.userId
  const owner = users[ownerId]
  const isOwn = viewerId === ownerId
  const isFriend = friendIds.includes(ownerId)
  const canReply = !isOwn && (isFriend || owner?.allowDirectMessages === true)
  const viewCount = watchers.length

  const interactionBlocked =
    replyFocused || showWatchers || replying || confirmDelete || Boolean(profileUserId)
  const isPaused = paused || holding || interactionBlocked

  const footerReserve = canReply
    ? 'calc(var(--ios-safe-bottom) + 88px)'
    : isOwn
      ? 'calc(var(--ios-safe-bottom) + 72px)'
      : 'calc(var(--ios-safe-bottom) + 16px)'

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
    recordStoryView(
      viewerId,
      ownerId,
      story.id,
      viewerUsername,
      viewerPhoto,
      storyCreatedMs(story)
    ).catch(() => {
      recordedViewsRef.current.delete(viewKey)
    })
  }, [story?.id, viewerId, ownerId, viewerUsername, viewerPhoto, isOwn])

  useEffect(() => {
    if (!isOwn || !story?.id) return
    return subscribeStoryWatchers(ownerId, story.id, setWatchers)
  }, [isOwn, ownerId, story?.id])

  useEffect(() => {
    if (!showWatchers || watchers.length === 0) return
    let cancelled = false

    ;(async () => {
      const photos = {}
      await Promise.all(
        watchers.map(async (w) => {
          const id = w.viewerId || w.id
          if (w.photoUrl) {
            photos[id] = w.photoUrl
            return
          }
          const user = await fetchUser(id)
          if (user?.photos?.[0]) photos[id] = user.photos[0]
        })
      )
      if (!cancelled) setWatcherPhotos(photos)
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

  const handleStoryPointerDown = (e) => {
    if (interactionBlocked) return

    const zone = getTapZone(e.clientX)
    pointerRef.current = { time: performance.now(), x: e.clientX, zone }
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

  const handleStoryPointerUp = (e) => {
    if (performance.now() - openedAtRef.current < OPEN_TAP_GUARD_MS) return

    const zone = pointerRef.current.zone
    const wasHolding = holding || holdActiveRef.current
    clearHoldTimer()
    setHolding(false)
    holdActiveRef.current = false

    if (interactionBlocked || wasHolding) return

    const elapsed = performance.now() - pointerRef.current.time
    if (elapsed > 280) return

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
    const text = buildStoryShareText(story, owner.username || 'User')
    try {
      if (navigator.share) {
        await navigator.share({ title: `${owner.username}'s story`, text })
      } else {
        await navigator.clipboard.writeText(text)
        toast.success('Story copied!')
      }
    } catch (err) {
      if (err?.name !== 'AbortError') toast.error('Could not share story')
    }
  }

  const openProfileOverlay = (userId) => {
    if (!userId) return
    setProfileUserId(userId)
  }

  const closeProfileOverlay = () => setProfileUserId(null)

  const handleReply = async () => {
    const trimmed = replyText.trim()
    if (!trimmed || !canReply || !story || replying) return
    setReplying(true)
    try {
      await replyToStory(viewerId, ownerId, story, trimmed, viewerUsername, owner?.username)
      toast.success('Reply sent!')
      setReplyText('')
      elapsedRef.current = progress * STORY_DURATION_MS
      setReplyFocused(false)
      setPaused(false)
      replyInputRef.current?.blur()
      setReplySentPulse(true)
      window.setTimeout(() => setReplySentPulse(false), 520)
    } catch (err) {
      toast.error(err.message || 'Could not send reply')
    } finally {
      setReplying(false)
    }
  }

  if (!entry || !story) return null

  const userSlideKey = `${userIndex}-${ownerId}`
  const slideCustom = { direction: slideDirectionRef.current }

  const shellTransition = { type: 'spring', stiffness: 430, damping: 38, mass: 0.85 }

  return createPortal(
    <motion.div
      data-story-viewer
      initial={{ scale: openMotion.initialScale, opacity: 0.8 }}
      animate={
        isPresent
          ? { scale: 1, opacity: 1 }
          : { scale: openMotion.initialScale, opacity: 0 }
      }
      transition={shellTransition}
      onAnimationComplete={handleShellAnimationComplete}
      style={{ transformOrigin: openMotion.transformOrigin }}
      className="fixed inset-0 z-[95] overflow-hidden will-change-transform"
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

        <div className="relative z-30 flex items-center justify-between gap-2 px-4 py-3">
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
              <p className="font-semibold text-sm truncate text-white">{owner?.username || 'User'}</p>
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
          className="absolute inset-x-0 top-[72px] z-[8] touch-none select-none"
          style={{ bottom: footerReserve }}
          onPointerDown={handleStoryPointerDown}
          onPointerUp={handleStoryPointerUp}
          onPointerLeave={handleStoryPointerCancel}
          onPointerCancel={handleStoryPointerCancel}
          aria-hidden
        />

        <div className="flex-1 flex items-center justify-center px-8 select-none relative min-h-0 pointer-events-none z-[6]">
          <p className="text-2xl sm:text-3xl font-semibold leading-relaxed text-center text-white whitespace-pre-wrap break-words drop-shadow-[0_2px_12px_rgba(0,0,0,0.25)]">
            {story.text}
          </p>
          {holding && (
            <div className={`absolute bottom-4 left-1/2 -translate-x-1/2 ${storyPausedBadgeClass}`}>
              Paused
            </div>
          )}
        </div>

        {canReply && (
          <div
            className="relative z-30 px-4 pb-[calc(var(--ios-safe-bottom)+12px)] pt-2"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
          >
            <motion.div
              layout
              initial={false}
              animate={{
                scale: replySentPulse ? [1, 0.97, 1.03, 1] : replyFocused ? 1.02 : 1,
                y: replyFocused ? -3 : 0,
              }}
              transition={{
                scale: replySentPulse
                  ? { duration: 0.45, ease: [0.34, 1.4, 0.64, 1] }
                  : { type: 'spring', stiffness: 420, damping: 32 },
                y: { type: 'spring', stiffness: 420, damping: 32 },
              }}
              className={`flex items-center gap-2 rounded-full px-3 py-2 ${storyGlassInputClass}`}
            >
              <motion.input
                type="text"
                data-story-reply-input
                value={replyText}
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
                  elapsedRef.current = progress * STORY_DURATION_MS
                  setReplyFocused(true)
                  setPaused(true)
                }}
                onBlur={() => {
                  setReplyFocused(false)
                  setPaused(false)
                }}
                placeholder={`Reply to ${owner?.username || 'user'}…`}
                animate={{ opacity: replyFocused ? 1 : 0.92 }}
                transition={{ duration: 0.2 }}
                className="flex-1 bg-transparent text-[15px] text-white placeholder:text-white/50 outline-none min-w-0"
              />
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
                className={`${storyGlassButtonClass} !p-2 bg-[var(--ios-blue)] border-[var(--ios-blue)] disabled:opacity-40`}
                aria-label="Send reply"
              >
                <IconSend size={18} />
              </motion.button>
            </motion.div>
          </div>
        )}

        {isOwn && !canReply && (
          <div
            className="relative z-30 px-4 pb-[calc(var(--ios-safe-bottom)+12px)] pt-2 flex justify-center"
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

        {!canReply && !isOwn && <div className="relative z-30 pb-[calc(var(--ios-safe-bottom)+12px)]" />}

        <AnimatePresence>
          {showWatchers && isOwn && (
            <>
              <motion.button
                type="button"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="absolute inset-0 z-[35] bg-black/25 backdrop-blur-[2px] cursor-default"
                onClick={() => setShowWatchers(false)}
                aria-label="Close views"
              />
              <motion.div
                initial={{ y: '100%' }}
                animate={{ y: 0 }}
                exit={{ y: '100%' }}
                transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                className={`absolute inset-x-0 bottom-0 z-40 max-h-[50vh] ${storyGlassSheetClass}`}
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => e.stopPropagation()}
              >
              <div className="px-4 py-3 flex items-center justify-between">
                <div className={`${storyGlassPillClass} !px-4 !py-2`}>
                  <IconEye size={16} stroke={1.75} />
                  <span className="font-semibold text-[15px] text-white tabular-nums">
                    {viewCount} {viewCount === 1 ? 'view' : 'views'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowWatchers(false)}
                  className={storyGlassButtonClass}
                  aria-label="Close views"
                >
                  <IconX size={20} />
                </button>
              </div>
              <div className="overflow-y-auto max-h-[calc(50vh-52px)] px-4 py-2">
                {watchers.length === 0 ? (
                  <p className="text-center text-white/50 py-8 text-sm">No views yet</p>
                ) : (
                  watchers.map((w) => {
                    const watcherId = w.viewerId || w.id
                    const photo = w.photoUrl || watcherPhotos[watcherId]
                    return (
                      <button
                        key={w.id}
                        type="button"
                        onClick={() => openProfileOverlay(watcherId)}
                        className={`w-full flex items-center justify-between py-3 px-2 mb-1 text-left ${storyGlassRowClass}`}
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <img
                            src={photo || sad}
                            alt=""
                            className="w-9 h-9 rounded-full object-cover shrink-0 ring-1 ring-white/10"
                          />
                          <span className="font-medium text-sm truncate text-white">
                            {w.username || 'User'}
                          </span>
                        </div>
                        <span className="text-xs text-white/50 shrink-0 ml-3">
                          {formatStoryViewTime(w.viewedAt?.toMillis?.() ?? w.viewedAt)}
                        </span>
                      </button>
                    )
                  })
                )}
              </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>

        </motion.div>
      </AnimatePresence>

      <Modal
          isOpen={Boolean(profileUserId)}
          onClose={closeProfileOverlay}
          fullscreen
          overlayClassName="z-[98]"
        >
          {profileUserId && (
            <PublicProfileView
              userId={profileUserId}
              onClose={closeProfileOverlay}
              suppressStoryViewer={profileUserId === ownerId}
            />
          )}
        </Modal>

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
          overlayClassName="z-[100]"
        />
    </motion.div>,
    document.body
  )
}
