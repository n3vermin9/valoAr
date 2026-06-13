import { useState, useEffect, useRef } from 'react'
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
import SwipeCard from './SwipeCard'
import LikeMessageModal from './LikeMessageModal'
import EmptyState from '../ui/EmptyState'
import LoadingSpinner from '../ui/LoadingSpinner'
import Modal from '../ui/Modal'
import { sad } from '../../assets'
import { PublicProfileView } from '../profile/ProfileView'
import StoriesHost from '../stories/StoriesHost'
import ChevronBack from '../ui/ChevronBack'
import PageShell from '../layout/PageShell'

export default function Discover() {
  const { user, profile, setProfile } = useAuth()
  const [newProfiles, setNewProfiles] = useState([])
  const [recentProfiles, setRecentProfiles] = useState([])
  const [loading, setLoading] = useState(true)
  const [section, setSection] = useState('new')
  const [sectionDirection, setSectionDirection] = useState(0)
  const [newIndex, setNewIndex] = useState(0)
  const [recentIndex, setRecentIndex] = useState(0)
  const [showMessageModal, setShowMessageModal] = useState(false)
  const [viewProfile, setViewProfile] = useState(null)
  const [profileFromSearch, setProfileFromSearch] = useState(false)
  const [showSearchPage, setShowSearchPage] = useState(false)
  const [searchUsername, setSearchUsername] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [likedYouIds, setLikedYouIds] = useState(new Set())
  const [messageTarget, setMessageTarget] = useState(null)
  const feedRef = useRef(null)

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
    setSectionDirection(next === 'recent' ? 1 : -1)
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
      return
    }

    let cancelled = false
    const timer = setTimeout(async () => {
      try {
        const results = await searchUsersByUsername(normalized, profile)
        if (!cancelled) setSearchResults(results)
      } catch {
        if (!cancelled) setSearchResults([])
      }
    }, 250)

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [searchUsername])

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
        filteredProfiles={searchResults}
        onSearch={handleSearchByUsername}
        onSelectProfile={handleSelectFromSearch}
      />
    </>
  )

  const emptyMessage =
    section === 'new'
      ? 'No new profiles right now. Check back later!'
      : 'No recent profiles to show. Pass on someone in New to see them here.'

  const renderSectionFeed = (profiles) => {
    if (!profiles.length) {
      return (
        <div className="flex-1 flex items-center justify-center min-h-0">
          <EmptyState message={emptyMessage} />
        </div>
      )
    }

    return (
      <div
        ref={feedRef}
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
              onViewProfile={handleViewProfile}
            />
          </article>
        ))}
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
          <AnimatePresence mode="popLayout" initial={false} custom={sectionDirection}>
            <motion.div
              key={section}
              custom={sectionDirection}
              variants={discoverSectionSlideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={discoverSectionSlideTransition}
              className="absolute inset-0 flex flex-col min-h-0"
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

const discoverSectionSlideTransition = {
  type: 'tween',
  duration: 0.28,
  ease: [0.32, 0.72, 0, 1],
}

const discoverSectionSlideVariants = {
  enter: (direction) => ({
    x: direction >= 0 ? '100%' : '-100%',
    opacity: 0.65,
  }),
  center: {
    x: 0,
    opacity: 1,
  },
  exit: (direction) => ({
    x: direction >= 0 ? '-100%' : '100%',
    opacity: 0.65,
  }),
}

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
  filteredProfiles,
  onSearch,
  onSelectProfile,
}) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[70] bg-black">
      <div className="flex items-center gap-2 px-4 pt-4 pb-3 border-b border-white/10">
        <ChevronBack onClick={onClose} />
        <div className="flex-1 flex items-center bg-white/10 rounded-full border border-white/10 px-4">
          <IconSearch size={18} className="text-white/50 mr-2" />
          <input
            autoFocus
            value={searchUsername}
            onChange={(e) => setSearchUsername(e.target.value.toLowerCase())}
            onKeyDown={(e) => e.key === 'Enter' && onSearch()}
            placeholder="Search by username"
            className="w-full py-2.5 bg-transparent outline-none text-sm"
          />
        </div>
      </div>

      <div className="h-[calc(100%-64px)] overflow-y-auto pb-24">
        {!searchUsername.trim() && (
          <p className="px-4 pt-4 text-sm text-white/50">Type a username to find profiles</p>
        )}

        {searchUsername.trim() && filteredProfiles.length === 0 && (
          <p className="px-4 pt-4 text-sm text-white/50">No users found in Discover</p>
        )}

        {filteredProfiles.map((profile) => (
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
              <p className="font-medium">{profile.username}</p>
              <p className="text-sm text-white/50">{profile.age} years old</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
