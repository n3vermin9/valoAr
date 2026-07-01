import { useState, useEffect, useRef, useCallback } from 'react'
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
} from '../../services/userService'
import { searchPublicGroups } from '../../services/groupChatService'
import { getGroupDisplayName } from '../../utils/groupChat'
import GroupAvatar from '../chat/GroupAvatar'
import SwipeCard from './SwipeCard'
import LikeMessageModal from './LikeMessageModal'
import EmptyState from '../ui/EmptyState'
import LoadingSpinner from '../ui/LoadingSpinner'
import Modal from '../ui/Modal'
import UsernameLabel from '../ui/UsernameLabel'
import { sad } from '../../assets'
import { PublicProfileView } from '../profile/ProfileView'
import StoriesHost from '../stories/StoriesHost'
import ChevronBack from '../ui/ChevronBack'
import { useNavigate } from 'react-router-dom'

import PageShell from '../layout/PageShell'
import { pageSwitchMotion, pageSwitchTransition, pageSwitchVariants } from '../../utils/designSystem'

export default function Discover() {
  const navigate = useNavigate()
  const { user, profile, setProfile } = useAuth()
  const [newProfiles, setNewProfiles] = useState([])
  const [recentProfiles, setRecentProfiles] = useState([])
  const [loading, setLoading] = useState(true)
  const [section, setSection] = useState('new')
  const [newIndex, setNewIndex] = useState(0)
  const [recentIndex, setRecentIndex] = useState(0)
  const [showMessageModal, setShowMessageModal] = useState(false)
  const [viewProfile, setViewProfile] = useState(null)
  const [profileFromSearch, setProfileFromSearch] = useState(false)
  const [showSearchPage, setShowSearchPage] = useState(false)
  const [searchUsername, setSearchUsername] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [groupSearchResults, setGroupSearchResults] = useState([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [likedYouIds, setLikedYouIds] = useState(new Set())
  const [messageTarget, setMessageTarget] = useState(null)
  const [refreshing, setRefreshing] = useState(false)
  const [pullY, setPullY] = useState(0)
  const feedRef = useRef(null)
  const pullStartY = useRef(0)
  const pulling = useRef(false)
  const pullYRef = useRef(0)

  const PULL_THRESHOLD = 72

  const refreshDiscover = useCallback(async () => {
    if (!profile?.id || refreshing) return
    setRefreshing(true)
    try {
      const feed = await getDiscoverFeed(profile)
      setNewProfiles(feed.newProfiles)
      setRecentProfiles(feed.recentProfiles)
      toast.success('Discover updated')
    } catch {
      toast.error('Could not refresh')
    } finally {
      setRefreshing(false)
      setPullY(0)
    }
  }, [profile?.id, refreshing])

  useEffect(() => {
    pullYRef.current = pullY
  }, [pullY])

  const handleFeedTouchStart = (e) => {
    if ((feedRef.current?.scrollTop ?? 0) > 0) return
    pullStartY.current = e.touches[0].clientY
    pulling.current = true
  }

  const handleFeedTouchMove = (e) => {
    if (!pulling.current || refreshing) return
    const dy = e.touches[0].clientY - pullStartY.current
    if (dy > 0 && (feedRef.current?.scrollTop ?? 0) <= 0) {
      setPullY(Math.min(dy * 0.45, 96))
    }
  }

  const handleFeedTouchEnd = () => {
    if (!pulling.current) return
    pulling.current = false
    if (pullYRef.current >= PULL_THRESHOLD) {
      refreshDiscover()
    } else {
      setPullY(0)
    }
  }

  useEffect(() => {
    if (!profile?.id) return
    let cancelled = false
    ;(async () => {
      setLoading(true)
      const feed = await getDiscoverFeed(profile)
      if (cancelled) return
      setNewProfiles(feed.newProfiles)
      setRecentProfiles(feed.recentProfiles)
      setNewIndex(0)
      setRecentIndex(0)
      setSection(feed.newProfiles.length > 0 ? 'new' : 'recent')
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [profile?.id])

  useEffect(() => {
    if (!user?.uid) return
    return subscribeLikesReceived(user.uid, (likes) => {
      setLikedYouIds(new Set(likes.map((l) => l.fromUserId || l.id)))
    })
  }, [user?.uid])

  const remainingNew = newProfiles.slice(newIndex)
  const remainingRecent = recentProfiles.slice(recentIndex)
  const remainingProfiles = section === 'new' ? remainingNew : remainingRecent

  const handleSectionChange = (next) => {
    if (next === section) return
    setSection(next)
    feedRef.current?.scrollTo({ top: 0, behavior: 'instant' })
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
      toast.error('They already sent you a request! Check Friend Requests.')
      return
    }

    const targetId = targetProfile.id
    if (section === 'new') {
      setNewIndex((i) => i + 1)
    } else {
      setRecentIndex((i) => i + 1)
    }
    setProfile((prev) => patchProfileAfterSwipe(prev, targetId, action))
    if (action === 'like') toast.success('Friend request sent!')
    feedRef.current?.scrollTo({ top: 0, behavior: 'instant' })

    recordSwipe(user.uid, targetId, action, message).catch((err) => {
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
      toast.error('They already sent you a request! Check Friend Requests.')
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
    setProfileFromSearch(false)
    setViewProfile(profile)
  }

  const handleCloseProfile = () => {
    setViewProfile(null)
    if (profileFromSearch) {
      setShowSearchPage(true)
      setProfileFromSearch(false)
    }
  }

  const handleSearchByUsername = (usernameOverride) => {
    const normalized = (usernameOverride ?? searchUsername).trim().toLowerCase().replace(/^@/, '')
    if (!normalized) {
      toast.error('Enter a username to search')
      return
    }

    const result = searchResults.find((p) => p.username?.toLowerCase() === normalized)
    if (!result) {
      toast.error('User not found')
      return
    }

    handleSelectFromSearch(result.id)
  }

  useEffect(() => {
    const normalized = searchUsername.trim().toLowerCase().replace(/^@/, '')
    if (!normalized) {
      setSearchResults([])
      setGroupSearchResults([])
      setSearchLoading(false)
      return
    }

    let cancelled = false
    setSearchLoading(true)
    const timer = setTimeout(async () => {
      const [userResult, groupResult] = await Promise.allSettled([
        searchUsersByUsername(normalized, profile),
        searchPublicGroups(normalized, { userId: user?.uid }),
      ])

      if (cancelled) return

      setSearchResults(userResult.status === 'fulfilled' ? userResult.value : [])
      setGroupSearchResults(groupResult.status === 'fulfilled' ? groupResult.value : [])
      setSearchLoading(false)
    }, 120)

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [searchUsername, profile, user?.uid])

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
        searchUsername={searchUsername}
        setSearchUsername={setSearchUsername}
        userResults={searchResults}
        groupResults={groupSearchResults}
        searchLoading={searchLoading}
        onSearch={handleSearchByUsername}
        onSelectProfile={handleSelectFromSearch}
        onSelectGroup={handleSelectGroup}
      />
    </>
  )

  const emptyMessage =
    section === 'new'
      ? 'No new profiles right now. Check back later!'
      : 'No recent profiles to show. Pass on someone in New to see them here.'

  const renderSectionFeed = (profiles) => {
    const pullIndicator = (
      <div
        className="flex items-center justify-center overflow-hidden transition-[height] duration-150 shrink-0"
        style={{ height: pullY > 0 || refreshing ? Math.max(pullY, refreshing ? 40 : 0) : 0 }}
      >
        {(pullY > 0 || refreshing) && (
          <span className="text-xs text-white/50 py-2">
            {refreshing ? 'Refreshing…' : pullY >= PULL_THRESHOLD ? 'Release to refresh' : 'Pull to refresh'}
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
        >
          {pullIndicator}
          <div className="flex-1 flex items-center justify-center min-h-0">
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
      >
        {pullIndicator}
        <div
          ref={feedRef}
          className="flex-1 min-h-0 overflow-y-auto snap-y snap-mandatory overscroll-y-contain scroll-smooth"
          style={{ transform: pullY > 0 ? `translateY(${pullY}px)` : undefined }}
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
              onViewProfile={handleViewProfile}
            />
          </article>
        ))}
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <>
        <PageShell
          title="Discover"
          trailing={discoverSearchButton}
          contentClassName="flex flex-col min-h-0"
        >
          <StoriesHost profile={profile} friendIds={profile?.matches} />
          <DiscoverSectionTabs section={section} onSectionChange={handleSectionChange} />
          <div className="flex-1 flex items-center justify-center min-h-0">
            <LoadingSpinner />
          </div>
        </PageShell>
        {discoverOverlays}
      </>
    )
  }

  return (
    <>
      <PageShell
        title="Discover"
        trailing={discoverSearchButton}
        contentClassName="flex flex-col min-h-0"
      >
        <StoriesHost profile={profile} friendIds={profile?.matches} />
        <DiscoverSectionTabs section={section} onSectionChange={handleSectionChange} />
        <div className="flex-1 min-h-0 relative overflow-hidden">
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.div
              key={section}
              variants={discoverSectionVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={discoverSectionTransition}
              className="absolute inset-0 flex flex-col min-h-0 origin-center"
            >
              {renderSectionFeed(remainingProfiles)}
            </motion.div>
          </AnimatePresence>
        </div>
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

function DiscoverSectionTabs({ section, onSectionChange }) {
  return (
    <>
      <div className="mx-[var(--ios-page-x-lg)] border-t border-white/10" aria-hidden />
      <div className="flex px-[var(--ios-page-x-lg)] pt-3 pb-2 z-10">
        {[
          { id: 'new', label: 'New' },
          { id: 'recent', label: 'Recent' },
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

function DiscoverSearchPage({
  isOpen,
  onClose,
  searchUsername,
  setSearchUsername,
  userResults,
  groupResults,
  searchLoading,
  onSearch,
  onSelectProfile,
  onSelectGroup,
}) {
  const hasQuery = searchUsername.trim().length > 0
  const hasResults = userResults.length > 0 || groupResults.length > 0

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          {...pageSwitchMotion}
          className="fixed inset-0 z-[70] bg-black origin-center"
        >
          <div className="flex items-center gap-2 px-4 pt-4 pb-3 border-b border-white/10">
            <ChevronBack onClick={onClose} />
            <div className="flex-1 flex items-center bg-white/10 rounded-full border border-white/10 px-4">
              <IconSearch size={18} className="text-white/50 mr-2" />
              <input
                autoFocus
                value={searchUsername}
                onChange={(e) => setSearchUsername(e.target.value.toLowerCase())}
                onKeyDown={(e) => e.key === 'Enter' && onSearch()}
                placeholder="Search users and groups"
                className="w-full py-2.5 bg-transparent outline-none text-sm"
              />
            </div>
          </div>

          <div className="h-[calc(100%-64px)] overflow-y-auto pb-24">
        {!hasQuery && (
          <p className="px-4 pt-4 text-sm text-white/50">Search by username or public group name</p>
        )}

        {hasQuery && searchLoading && (
          <p className="px-4 pt-4 text-sm text-white/50">Searching…</p>
        )}

        {hasQuery && !searchLoading && !hasResults && (
          <p className="px-4 pt-4 text-sm text-white/50">No users or groups found</p>
        )}

        {userResults.map((profile) => (
          <button
            key={profile.id}
            onClick={() => onSelectProfile(profile.id)}
            className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors"
          >
            <img
              src={profile.photos?.[0] || sad}
              alt=""
              className="w-12 h-12 rounded-full object-cover"
            />
            <div className="text-left">
              <UsernameLabel username={profile.username} className="font-medium" badgeSize={14} />
              <p className="text-sm text-white/50">{profile.age} years old</p>
            </div>
          </button>
        ))}

        {groupResults.length > 0 && userResults.length > 0 && (
          <div className="mx-4 my-2 border-t border-white/10" aria-hidden />
        )}

        {groupResults.map((group) => (
          <button
            key={group.id}
            onClick={() => onSelectGroup(group.id)}
            className="w-full flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition-colors"
          >
            <GroupAvatar photoUrl={group.photoUrl} size={48} />
            <div className="text-left min-w-0">
              <p className="font-medium truncate">{getGroupDisplayName(group)}</p>
              <p className="text-sm text-white/50">
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
