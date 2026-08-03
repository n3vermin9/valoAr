import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import toast from 'react-hot-toast'
import { IconSearch } from '@tabler/icons-react'
import { useAuth } from '../../contexts/AuthContext'
import {
  getDiscoverFeed,
  recordSwipe,
  searchUsersByUsername,
  subscribeLikesReceived,
  patchProfileAfterSwipe,
  fetchUsersMap,
} from '../../services/userService'
import { searchPublicGroups } from '../../services/groupChatService'
import { getGroupDisplayName } from '../../utils/groupChat'
import GroupAvatar from '../chat/GroupAvatar'
import SwipeCard from './SwipeCard'
import DiscoverMap from './DiscoverMap'
import LikeMessageModal from './LikeMessageModal'
import EmptyState from '../ui/EmptyState'
import { CardSkeleton, PageSkeleton } from '../ui/Skeleton'
import Modal from '../ui/Modal'
import UsernameLabel from '../ui/UsernameLabel'
import { sad } from '../../assets'
import { PublicProfileView } from '../profile/ProfileView'
import StoriesHost from '../stories/StoriesHost'
import ChevronBack from '../ui/ChevronBack'
import { handleInputFocusCursor } from '../../utils/inputHelpers'
import { allowAutofocus } from '../../utils/iosInput'
import { useNavigate, useLocation } from 'react-router-dom'

import PageShell from '../layout/PageShell'
import {
  pageSwitchMotion,
  pageSwitchTransition,
  pageSwitchVariants,
  searchFieldInputClass,
  searchFieldShellClass,
  segmentedControlClass,
  segmentedItemClass,
  segmentedItemActiveClass,
} from '../../utils/designSystem'
import { setMapModeOverlayOpen } from '../../utils/mapModeOverlay'
import {
  getDiscoverCardsSnapshot,
  setDiscoverCardsSnapshot,
} from '../../services/discoverCardsCache'
import { hasActiveDiscoverFilters, loadDiscoverFilters } from '../../utils/discoverFilters'

export default function Discover() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, profile, setProfile } = useAuth()
  const [discoverFilters, setDiscoverFilters] = useState(loadDiscoverFilters)
  const filtersActive = hasActiveDiscoverFilters(discoverFilters)
  const cacheUserId = profile?.id || user?.uid
  const cardsSnapshot =
    cacheUserId && !filtersActive ? getDiscoverCardsSnapshot(cacheUserId) : null
  const [newProfiles, setNewProfiles] = useState(() => cardsSnapshot?.newProfiles || [])
  const [recentProfiles, setRecentProfiles] = useState(() => cardsSnapshot?.recentProfiles || [])
  const [loading, setLoading] = useState(() => !cardsSnapshot)
  const [loadError, setLoadError] = useState(null)
  const [section, setSection] = useState('new')
  const [view, setView] = useState('cards')
  const [mapFocusPlaceId, setMapFocusPlaceId] = useState(null)
  const [mapFocusCoords, setMapFocusCoords] = useState(null)
  const [newIndex, setNewIndex] = useState(0)
  const [recentIndex, setRecentIndex] = useState(0)
  const [showMessageModal, setShowMessageModal] = useState(false)
  const [viewProfile, setViewProfile] = useState(null)
  const [profileFromSearch, setProfileFromSearch] = useState(false)
  const [, setProfileFromMap] = useState(false)
  const [showSearchPage, setShowSearchPage] = useState(false)
  const [likedYouIds, setLikedYouIds] = useState(new Set())
  const [mapFriendProfiles, setMapFriendProfiles] = useState([])
  const [messageTarget, setMessageTarget] = useState(null)
  const [refreshing, setRefreshing] = useState(false)
  const [pullY, setPullY] = useState(0)
  const [pullMode, setPullMode] = useState(null)
  // Hidden by default when Discover has cards; pull down to reveal.
  const [storiesCollapsed, setStoriesCollapsed] = useState(true)
  const [storiesOverlayOpen, setStoriesOverlayOpen] = useState(false)
  const [hasUnseenStories, setHasUnseenStories] = useState(false)
  const [contentReadyForMotion, setContentReadyForMotion] = useState(false)
  const feedRef = useRef(null)
  const pullStartY = useRef(0)
  const pulling = useRef(false)
  const pullYRef = useRef(0)
  const pullModeRef = useRef(null)
  const lastFeedScrollTop = useRef(0)
  const wheelPullY = useRef(0)
  const wheelPullTimer = useRef(null)
  const storiesRevealedByPullRef = useRef(false)

  const PULL_THRESHOLD = 40
  const PULL_REFRESH_MAX = 44
  const PULL_REVEAL_MAX = 32

  const refreshDiscover = useCallback(async () => {
    if (!profile?.id || refreshing) return
    setRefreshing(true)
    try {
      const feed = await getDiscoverFeed(profile, discoverFilters)
      const changed =
        feed.newProfiles.length !== newProfiles.length ||
        feed.recentProfiles.length !== recentProfiles.length ||
        feed.newProfiles.some((p, i) => p.id !== newProfiles[i]?.id) ||
        feed.recentProfiles.some((p, i) => p.id !== recentProfiles[i]?.id)
      setNewProfiles(feed.newProfiles)
      setRecentProfiles(feed.recentProfiles)
      if (!filtersActive) setDiscoverCardsSnapshot(profile.id, feed)
      setLoadError(null)
      if (changed) toast.success('Discover updated')
    } catch {
      toast.error('Could not refresh')
    } finally {
      setRefreshing(false)
      setPullY(0)
      setPullMode(null)
      pullModeRef.current = null
    }
  }, [profile, profile?.id, refreshing, newProfiles, recentProfiles, discoverFilters, filtersActive])

  const reloadSectionFeed = useCallback(
    async (targetSection) => {
      if (!profile?.id) return
      try {
        const feed = await getDiscoverFeed(profile, discoverFilters)
        setNewProfiles(feed.newProfiles)
        setRecentProfiles(feed.recentProfiles)
        if (!filtersActive) setDiscoverCardsSnapshot(profile.id, feed)
        setLoadError(null)
        if (targetSection === 'new') setNewIndex(0)
        else setRecentIndex(0)
      } catch {
        toast.error('Could not refresh profiles')
      }
    },
    [profile, discoverFilters, filtersActive]
  )

  useEffect(() => {
    pullYRef.current = pullY
  }, [pullY])

  useEffect(() => {
    pullModeRef.current = pullMode
  }, [pullMode])

  const discoverCardsEmpty =
    !loading &&
    newProfiles.slice(newIndex).length === 0 &&
    recentProfiles.slice(recentIndex).length === 0

  const collapseStoriesBar = useCallback(() => {
    storiesRevealedByPullRef.current = false
    setStoriesCollapsed(true)
  }, [])

  const revealStoriesBar = useCallback(() => {
    storiesRevealedByPullRef.current = true
    setStoriesCollapsed(false)
  }, [])

  useEffect(() => {
    if (view !== 'cards') return undefined
    lastFeedScrollTop.current = 0
    storiesRevealedByPullRef.current = false
    return () => {
      window.clearTimeout(wheelPullTimer.current)
    }
  }, [view, profile?.id])

  // With cards: hide until pull-down. Empty feed: show stories.
  useEffect(() => {
    if (view !== 'cards' || loading) return
    if (discoverCardsEmpty) {
      setStoriesCollapsed(false)
      return
    }
    if (!storiesRevealedByPullRef.current) {
      setStoriesCollapsed(true)
    }
  }, [view, profile?.id, loading, discoverCardsEmpty])

  useEffect(() => {
    if (view !== 'cards' || storiesCollapsed || storiesOverlayOpen) return undefined
    // Auto-hide after reveal; longer when the feed is empty.
    const hideAfterMs = discoverCardsEmpty ? 10000 : 5000
    const collapseTimer = window.setTimeout(collapseStoriesBar, hideAfterMs)
    return () => window.clearTimeout(collapseTimer)
  }, [view, profile?.id, storiesCollapsed, storiesOverlayOpen, discoverCardsEmpty, collapseStoriesBar])

  const handleStoriesOverlayChange = useCallback((open) => {
    setStoriesOverlayOpen(open)
    // Keep current bar visibility; only prevent further auto-hide while open.
  }, [])

  const handleUnseenStoriesChange = useCallback((hasUnseen) => {
    setHasUnseenStories(hasUnseen)
  }, [])

  const handleFeedTouchStart = (e) => {
    if ((feedRef.current?.scrollTop ?? 0) > 0) return
    pullStartY.current = e.touches[0].clientY
    pulling.current = true
    const mode = storiesCollapsed ? 'reveal' : 'refresh'
    pullModeRef.current = mode
    setPullMode(mode)
  }

  const handleFeedTouchMove = (e) => {
    if (!pulling.current || refreshing) return
    const dy = e.touches[0].clientY - pullStartY.current
    if (dy > 0 && (feedRef.current?.scrollTop ?? 0) <= 0) {
      if (pullModeRef.current === 'reveal') {
        setPullY(Math.min(dy * 0.3, PULL_REVEAL_MAX))
        if (dy > 14) revealStoriesBar()
      } else {
        setPullY(Math.min(dy * 0.35, PULL_REFRESH_MAX))
      }
    }
  }

  const handleFeedTouchEnd = () => {
    if (!pulling.current) return
    pulling.current = false
    const mode = pullModeRef.current
    pullModeRef.current = null
    setPullMode(null)

    if (mode === 'refresh' && pullYRef.current >= PULL_THRESHOLD) {
      refreshDiscover()
    } else {
      setPullY(0)
    }
  }

  const handleFeedWheel = (e) => {
    const feedTop = feedRef.current?.scrollTop ?? 0

    if (e.deltaY > 0) {
      if (!storiesOverlayOpen) collapseStoriesBar()
      return
    }

    if (refreshing || feedTop > 0 || e.deltaY >= 0) return

    const mode = pullModeRef.current ?? (storiesCollapsed ? 'reveal' : 'refresh')
    pullModeRef.current = mode
    setPullMode(mode)

    wheelPullY.current = Math.min(wheelPullY.current + Math.abs(e.deltaY), 120)
    if (mode === 'reveal') {
      revealStoriesBar()
      setPullY(Math.min(wheelPullY.current * 0.3, PULL_REVEAL_MAX))
    } else {
      setPullY(Math.min(wheelPullY.current * 0.45, PULL_REFRESH_MAX))
    }

    window.clearTimeout(wheelPullTimer.current)
    wheelPullTimer.current = window.setTimeout(() => {
      const completedMode = pullModeRef.current
      const completedPull = wheelPullY.current
      wheelPullY.current = 0
      pullModeRef.current = null
      setPullMode(null)

      if (completedMode === 'refresh' && completedPull >= PULL_THRESHOLD) {
        refreshDiscover()
      } else {
        setPullY(0)
      }
    }, 160)
  }

  useEffect(() => {
    if (!profile?.id) return
    let cancelled = false
    setContentReadyForMotion(false)

    const cached = filtersActive ? null : getDiscoverCardsSnapshot(profile.id)
    if (cached) {
      // Paint name/bio/looking-for instantly from localStorage; refresh in background.
      setNewProfiles(cached.newProfiles)
      setRecentProfiles(cached.recentProfiles)
      setLoading(false)
      setLoadError(null)
      if (cached.newProfiles.length === 0 && cached.recentProfiles.length > 0) {
        setSection('recent')
      }
    } else {
      setLoading(true)
      setLoadError(null)
    }

    ;(async () => {
      try {
        const feed = await getDiscoverFeed(profile, discoverFilters)
        if (cancelled) return
        setNewProfiles(feed.newProfiles)
        setRecentProfiles(feed.recentProfiles)
        if (!filtersActive) setDiscoverCardsSnapshot(profile.id, feed)
        setNewIndex(0)
        setRecentIndex(0)
        setSection(feed.newProfiles.length > 0 ? 'new' : 'recent')
        setLoadError(null)
      } catch (err) {
        if (!cancelled) {
          if (!cached) {
            setLoadError(err?.message || 'Could not load Discover')
            toast.error('Could not load Discover')
          }
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [profile?.id, discoverFilters, filtersActive])

  useEffect(() => {
    if (loading || loadError) {
      setContentReadyForMotion(false)
      return undefined
    }

    const frame = requestAnimationFrame(() => setContentReadyForMotion(true))
    return () => cancelAnimationFrame(frame)
  }, [loading, loadError])

  useEffect(() => {
    if (!user?.uid) return
    return subscribeLikesReceived(user.uid, (likes) => {
      setLikedYouIds(new Set(likes.map((l) => l.fromUserId || l.id)))
    })
  }, [user?.uid])

  // Load full profiles for all current matches so they are always visible on the map.
  useEffect(() => {
    const friendIds = profile?.matches || []
    if (!friendIds.length) {
      setMapFriendProfiles([])
      return
    }
    fetchUsersMap(friendIds)
      .then((userMap) => {
        setMapFriendProfiles(Object.values(userMap || {}))
      })
      .catch(() => {
        // Non-fatal for discover; map will still show feed users.
        setMapFriendProfiles([])
      })
  }, [profile?.matches])

  const remainingNew = newProfiles.slice(newIndex)
  const remainingRecent = recentProfiles.slice(recentIndex)
  const remainingProfiles = section === 'new' ? remainingNew : remainingRecent

  const mapProfiles = useMemo(() => {
    const seen = new Set()
    const combined = [...mapFriendProfiles, ...newProfiles, ...recentProfiles]
    return combined.filter((p) => {
      if (!p?.id || seen.has(p.id)) return false
      seen.add(p.id)
      return true
    })
  }, [mapFriendProfiles, newProfiles, recentProfiles])

  const handleSectionChange = (next) => {
    if (next === section) return

    const targetList = next === 'new' ? newProfiles : recentProfiles
    const targetIndex = next === 'new' ? newIndex : recentIndex
    const isEmpty = targetList.slice(targetIndex).length === 0

    setSection(next)
    feedRef.current?.scrollTo({ top: 0, behavior: 'instant' })

    if (isEmpty) {
      void reloadSectionFeed(next)
    }
  }

  const handleSwipe = (targetProfile, action, message = null) => {
    if (!targetProfile) return
    const matched = profile?.matches?.includes(targetProfile.id)
    const likedYou = likedYouIds.has(targetProfile.id)
    if (matched) {
      toast.error('You are already friends with this user!')
      return
    }
    if (likedYou && action === 'like') {
      toast.error('They already sent you a request! Check Inbox.')
      return
    }

    const targetId = targetProfile.id
    const previousProfile = profile
    const previousSection = section
    if (section === 'new') {
      setNewIndex((i) => i + 1)
    } else {
      setRecentIndex((i) => i + 1)
    }
    setProfile((prev) => patchProfileAfterSwipe(prev, targetId, action))
    if (profile?.id) {
      const nextNew =
        section === 'new'
          ? newProfiles.filter((p) => p.id !== targetId)
          : newProfiles
      const nextRecent =
        section === 'recent'
          ? recentProfiles.filter((p) => p.id !== targetId)
          : recentProfiles
      setDiscoverCardsSnapshot(profile.id, {
        newProfiles: nextNew,
        recentProfiles: nextRecent,
      })
    }
    if (action === 'like') toast.success('Friend request sent!')
    feedRef.current?.scrollTo({ top: 0, behavior: 'instant' })

    recordSwipe(user.uid, targetId, action, message).catch((err) => {
      if (previousSection === 'new') {
        setNewIndex((i) => Math.max(0, i - 1))
      } else {
        setRecentIndex((i) => Math.max(0, i - 1))
      }
      setProfile(previousProfile)
      if (profile?.id) {
        setDiscoverCardsSnapshot(profile.id, {
          newProfiles,
          recentProfiles,
        })
      }
      toast.error(err.message || 'Failed to save swipe')
    })
  }

  const handleLikeWithMessage = (message) => {
    if (!messageTarget) return
    handleSwipe(messageTarget, 'like', message || null)
    setMessageTarget(null)
  }

  const openLikeMessageModal = (targetProfile) => {
    if (profile?.matches?.includes(targetProfile.id)) return
    if (likedYouIds.has(targetProfile.id)) {
      toast.error('They already sent you a request! Check Inbox.')
      return
    }
    setMessageTarget(targetProfile)
    setShowMessageModal(true)
  }

  const handleSelectFromSearch = (userId) => {
    setProfileFromSearch(true)
    setViewProfile({ id: userId })
    setShowSearchPage(false)
  }

  const handleSelectGroup = (groupId) => {
    setShowSearchPage(false)
    navigate(`/chats/${groupId}`, {
      state: { groupPreview: true, previewReturnTo: '/discover' },
    })
  }

  const handleViewProfile = (profile) => {
    setProfileFromMap(false)
    setProfileFromSearch(false)
    setViewProfile(profile)
  }

  const handleViewProfileFromMap = (profile) => {
    setProfileFromMap(true)
    setProfileFromSearch(false)
    setViewProfile(profile)
  }

  const handleCloseProfile = () => {
    setViewProfile(null)
    if (profileFromSearch) {
      setShowSearchPage(true)
      setProfileFromSearch(false)
    }
    setProfileFromMap(false)
  }

  const discoverSearchButton = (
    <button
      onClick={() => setShowSearchPage(true)}
      className="p-2 hover:bg-white/10 rounded-full transition-colors"
      aria-label="Search by username"
    >
      <IconSearch size={20} stroke={2} />
    </button>
  )

  const discoverOverlays = (
    <>
      <Modal isOpen={!!viewProfile} onClose={handleCloseProfile} fullscreen>
        {viewProfile && (
          <PublicProfileView userId={viewProfile.id} onClose={handleCloseProfile} />
        )}
      </Modal>
      <DiscoverSearchPage
        isOpen={showSearchPage}
        onClose={() => setShowSearchPage(false)}
        profile={profile}
        userId={user?.uid}
        onSelectProfile={handleSelectFromSearch}
        onSelectGroup={handleSelectGroup}
      />
    </>
  )

  const emptyMessage =
    section === 'new'
      ? filtersActive
        ? 'No profiles match these filters yet.'
        : 'No new profiles right now. Check back later!'
      : filtersActive
        ? 'No recent profiles match these filters.'
        : 'No recent profiles yet. Pass on someone in New to see them here.'

  const renderSectionFeed = (profiles) => {
    const handleFeedScroll = (e) => {
      const top = e.currentTarget.scrollTop
      const previousTop = lastFeedScrollTop.current

      if (!storiesOverlayOpen) {
        // With cards, only pull-down reveals stories — scrolling up must not.
        if (discoverCardsEmpty && (top < previousTop - 10 || top <= 2)) {
          setStoriesCollapsed(false)
        } else if (top > previousTop + 10 || top > 40) {
          collapseStoriesBar()
        }
      }

      lastFeedScrollTop.current = top
    }

    const pullIndicator = (
      <div
        className="flex items-center justify-center overflow-hidden transition-[height] duration-150 shrink-0"
        style={{ height: pullY > 0 || refreshing ? Math.max(pullY, refreshing ? 28 : 0) : 0 }}
      >
        {(pullY > 0 || refreshing) && (
          <span className="text-xs text-white/50 py-1">
            {refreshing
              ? 'Refreshing…'
              : pullMode === 'reveal'
                ? 'Release to show stories'
                : pullY >= PULL_THRESHOLD
                  ? 'Release to refresh'
                  : 'Pull to refresh'}
          </span>
        )}
      </div>
    )

    if (!profiles.length) {
      return (
        <div
          className="flex-1 flex flex-col min-h-0"
          onTouchStart={handleFeedTouchStart}
          onTouchMove={handleFeedTouchMove}
          onTouchEnd={handleFeedTouchEnd}
          onWheel={handleFeedWheel}
        >
          {pullIndicator}
          <div className="flex-1 flex items-center justify-center min-h-0 min-w-0 px-2">
            <EmptyState message={emptyMessage} />
          </div>
        </div>
      )
    }

    return (
      <div
        className="flex-1 min-h-0 flex flex-col"
        onTouchStart={handleFeedTouchStart}
        onTouchMove={handleFeedTouchMove}
        onTouchEnd={handleFeedTouchEnd}
        onWheel={handleFeedWheel}
      >
        {pullIndicator}
        <div
          ref={feedRef}
          onScroll={handleFeedScroll}
          className="flex-1 min-h-0 overflow-y-auto snap-y snap-mandatory overscroll-y-contain scroll-smooth"
        >
        {profiles.map((p) => (
          <article
            key={p.id}
            className="snap-start snap-always h-full min-h-0 w-full shrink-0 flex items-center justify-center px-4 pb-4"
          >
            <SwipeCard
              profile={p}
              onSwipe={(action) => handleSwipe(p, action)}
              onLikeWithMessage={() => openLikeMessageModal(p)}
              alreadyLikedYou={likedYouIds.has(p.id)}
              alreadyMatched={profile?.matches?.includes(p.id)}
              currentUserHobbies={profile?.hobbies}
              onViewProfile={handleViewProfile}
            />
          </article>
        ))}
        </div>
      </div>
    )
  }

  const handleViewChange = (next) => {
    if (next === view) return
    setView(next)
    feedRef.current?.scrollTo({ top: 0, behavior: 'instant' })
  }

  useEffect(() => {
    setMapModeOverlayOpen(view === 'map')
    return () => setMapModeOverlayOpen(false)
  }, [view])

  useEffect(() => {
    const state = location.state
    if (!state?.openMap) return
    setView('map')
    if (state.focusPlaceId) setMapFocusPlaceId(state.focusPlaceId)
    if (typeof state.focusLat === 'number' && typeof state.focusLng === 'number') {
      setMapFocusCoords({ lat: state.focusLat, lng: state.focusLng })
    }
    navigate(location.pathname, { replace: true, state: {} })
  }, [location.state, location.pathname, navigate])

  const discoverTrailing = view === 'cards' ? discoverSearchButton : null

  const discoverMapProps = {
    profiles: mapProfiles,
    friendIds: profile?.matches,
    profile,
    userId: user?.uid,
    onViewProfile: handleViewProfileFromMap,
    onOpenChat: (chatId) => navigate(`/chats/${chatId}`),
    onExitMap: () => setView('cards'),
    chromeHidden: !!viewProfile,
    focusPlaceId: mapFocusPlaceId,
    focusCoords: mapFocusCoords,
    onFocusPlaceConsumed: () => {
      setMapFocusPlaceId(null)
      setMapFocusCoords(null)
    },
  }

  const discoverMainContent =
    view === 'map' ? (
      <DiscoverMap {...discoverMapProps} />
    ) : (
      <>
        <DiscoverSectionTabs section={section} onSectionChange={handleSectionChange} />
        <div className="flex-1 min-h-0 relative overflow-hidden">
          <AnimatePresence mode="sync" initial={false}>
            <motion.div
              key={section}
              variants={discoverSectionVariants}
              initial={contentReadyForMotion ? 'enter' : false}
              animate="center"
              exit="exit"
              transition={discoverSectionTransition}
              className="absolute inset-0 flex flex-col min-h-0 origin-center"
            >
              {renderSectionFeed(remainingProfiles)}
            </motion.div>
          </AnimatePresence>
        </div>
      </>
    )

  const discoverBody = loading ? (
    view === 'cards' ? (
      <>
        <DiscoverSectionTabs section={section} onSectionChange={handleSectionChange} />
        <div className="flex-1 flex items-center justify-center min-h-0 px-4">
          <CardSkeleton />
        </div>
      </>
    ) : (
      <div className="flex-1 min-h-0">
        <PageSkeleton className="!px-0" />
      </div>
    )
  ) : loadError ? (
    view === 'cards' ? (
      <>
        <DiscoverSectionTabs section={section} onSectionChange={handleSectionChange} />
        <div className="flex-1 flex flex-col items-center justify-center min-h-0 px-6 text-center">
          <EmptyState message={loadError} />
          <button
            type="button"
            onClick={refreshDiscover}
            className="mt-4 px-5 py-2.5 rounded-full bg-white/10 border border-white/10 text-sm font-medium"
          >
            Try again
          </button>
        </div>
      </>
    ) : (
      <DiscoverMap {...discoverMapProps} />
    )
  ) : (
    <div className="flex-1 min-h-0 flex flex-col">
      {discoverMainContent}
    </div>
  )

  return (
    <>
      <PageShell
        title={view === 'cards' ? 'Discover' : null}
        trailing={discoverTrailing}
        contentClassName="flex flex-col min-h-0"
        withNavClearance={view !== 'map'}
      >
        {view === 'cards' && (
          <>
            <StoriesHost
              profile={profile}
              friendIds={profile?.matches}
              showBar
              onOverlayChange={handleStoriesOverlayChange}
              onUnseenStoriesChange={handleUnseenStoriesChange}
              renderBar={(bar) => (
                <motion.div
                  className="shrink-0 overflow-hidden"
                  initial={false}
                  animate={{
                    maxHeight: storiesCollapsed ? 0 : 116,
                    opacity: storiesCollapsed ? 0 : 1,
                    y: storiesCollapsed ? -24 : 0,
                  }}
                  transition={{
                    maxHeight: { duration: 0.44, ease: [0.22, 1, 0.36, 1] },
                    opacity: { duration: 0.26 },
                    y: { duration: 0.44, ease: [0.22, 1, 0.36, 1] },
                  }}
                  style={{ pointerEvents: storiesCollapsed ? 'none' : 'auto' }}
                >
                  {bar}
                </motion.div>
              )}
            />
            {storiesCollapsed && !discoverCardsEmpty && hasUnseenStories ? (
              <div className="h-10 shrink-0 flex items-center px-[var(--ios-page-x-lg)]">
                <div className="w-16 flex justify-center">
                  <span
                    className="w-1.5 h-1.5 rounded-full bg-[var(--ios-green)]"
                    aria-label="New stories available"
                  />
                </div>
              </div>
            ) : null}
            <DiscoverViewToggle view={view} onViewChange={handleViewChange} />
          </>
        )}
        {discoverBody}
      </PageShell>

      <LikeMessageModal
        isOpen={showMessageModal}
        onClose={() => {
          setShowMessageModal(false)
          setMessageTarget(null)
        }}
        onSend={handleLikeWithMessage}
      />

      {discoverOverlays}
    </>
  )
}

const discoverSectionTransition = pageSwitchTransition

const discoverSectionVariants = pageSwitchVariants

function DiscoverViewToggle({ view, onViewChange }) {
  return (
    <div className="px-[var(--ios-page-x-lg)] pt-1 pb-1 z-10">
      <div className={segmentedControlClass}>
        {[
          { id: 'cards', label: 'Cards' },
          { id: 'map', label: 'Map' },
        ].map(({ id, label }) => (
          <button
            key={id}
            type="button"
            onClick={() => onViewChange(id)}
            className={view === id ? segmentedItemActiveClass : segmentedItemClass}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  )
}

/** Temporarily hidden — New/Recent divider will return later. */
function DiscoverSectionTabs() {
  return null
}

function DiscoverSearchPage({
  isOpen,
  onClose,
  profile,
  userId,
  onSelectProfile,
  onSelectGroup,
}) {
  const [query, setQuery] = useState('')
  const [userResults, setUserResults] = useState([])
  const [groupResults, setGroupResults] = useState([])
  const [searchLoading, setSearchLoading] = useState(false)
  const profileRef = useRef(profile)
  useEffect(() => {
    profileRef.current = profile
  }, [profile])

  const normalized = query.trim().toLowerCase().replace(/^@/, '')
  const hasQuery = normalized.length > 0
  const canSearch = normalized.length >= 2
  const hasResults = userResults.length > 0 || groupResults.length > 0

  useEffect(() => {
    if (!isOpen) {
      setQuery('')
      setUserResults([])
      setGroupResults([])
      setSearchLoading(false)
    }
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return undefined

    if (!canSearch) {
      setUserResults([])
      setGroupResults([])
      setSearchLoading(false)
      return undefined
    }

    let cancelled = false
    const timer = setTimeout(async () => {
      setSearchLoading(true)
      const [userResult, groupResult] = await Promise.allSettled([
        searchUsersByUsername(normalized, profileRef.current),
        searchPublicGroups(normalized, { userId, handlesOnly: true }),
      ])

      if (cancelled) return

      setUserResults(userResult.status === 'fulfilled' ? userResult.value : [])
      setGroupResults(groupResult.status === 'fulfilled' ? groupResult.value : [])
      if (userResult.status === 'rejected' || groupResult.status === 'rejected') {
        toast.error('Some search results could not load')
      }
      setSearchLoading(false)
    }, 280)

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [isOpen, normalized, canSearch, userId])

  const handleEnter = () => {
    if (!normalized) {
      toast.error('Enter a username to search')
      return
    }
    const exact = userResults.find((p) => p.username?.toLowerCase() === normalized)
    if (exact) {
      onSelectProfile(exact.id)
      return
    }
    if (groupResults.length === 1) {
      onSelectGroup(groupResults[0].id)
      return
    }
    if (!canSearch) {
      toast.error('Type at least 2 characters')
      return
    }
    toast.error('User not found')
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          {...pageSwitchMotion}
          className="fixed inset-0 z-[70] bg-black origin-center flex flex-col"
        >
          <div className="flex items-center gap-2 px-4 pt-[max(0.5rem,var(--ios-safe-top))] pb-2 border-b border-white/10 shrink-0">
            <ChevronBack onClick={onClose} />
            <div className={`flex-1 min-w-0 ${searchFieldShellClass}`}>
              <IconSearch size={16} stroke={2} className="text-white/50 shrink-0" />
              <input
                type="search"
                autoFocus={allowAutofocus()}
                value={query}
                onChange={(e) => setQuery(e.target.value.toLowerCase())}
                onFocus={handleInputFocusCursor}
                onKeyDown={(e) => e.key === 'Enter' && handleEnter()}
                placeholder="Search users and groups"
                className={searchFieldInputClass}
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                enterKeyHint="search"
              />
            </div>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto pb-[max(1.5rem,var(--ios-safe-bottom))]">
            {!hasQuery && (
              <p className="px-4 pt-4 text-sm text-white/50">Search by username or public group</p>
            )}

            {hasQuery && !canSearch && (
              <p className="px-4 pt-4 text-sm text-white/50">Keep typing…</p>
            )}

            {canSearch && searchLoading && (
              <p className="px-4 pt-4 text-sm text-white/50">Searching…</p>
            )}

            {canSearch && !searchLoading && !hasResults && (
              <p className="px-4 pt-4 text-sm text-white/50">No users or groups found</p>
            )}

            {userResults.map((result) => (
              <button
                key={result.id}
                type="button"
                onClick={() => onSelectProfile(result.id)}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors"
              >
                <img
                  src={result.photos?.[0] || sad}
                  alt=""
                  className="w-12 h-12 rounded-full object-cover"
                />
                <div className="text-left min-w-0">
                  <UsernameLabel username={result.username} className="font-medium" badgeSize={14} />
                  <p className="text-sm text-white/50">{result.age} years old</p>
                </div>
              </button>
            ))}

            {groupResults.length > 0 && userResults.length > 0 && (
              <div className="mx-4 my-2 border-t border-white/10" aria-hidden />
            )}

            {groupResults.map((group) => (
              <button
                key={group.id}
                type="button"
                onClick={() => onSelectGroup(group.id)}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors"
              >
                <GroupAvatar photoUrl={group.photoUrl} size={48} />
                <div className="text-left min-w-0">
                  <p className="font-medium truncate">{getGroupDisplayName(group)}</p>
                  <p className="text-sm text-white/50 truncate">
                    {group.username ? `@${group.username} · ` : ''}
                    {group.participants?.length || 0} members · Public
                  </p>
                </div>
              </button>
            ))}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
