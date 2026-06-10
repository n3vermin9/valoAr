import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import { IconSearch } from '@tabler/icons-react'
import { useAuth } from '../../contexts/AuthContext'
import {
  getDiscoverProfiles,
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
import ChevronBack from '../ui/ChevronBack'

export default function Discover() {
  const { user, profile, setProfile } = useAuth()
  const [profiles, setProfiles] = useState([])
  const [loading, setLoading] = useState(true)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [showMessageModal, setShowMessageModal] = useState(false)
  const [viewProfile, setViewProfile] = useState(null)
  const [profileFromSearch, setProfileFromSearch] = useState(false)
  const [showSearchPage, setShowSearchPage] = useState(false)
  const [searchUsername, setSearchUsername] = useState('')
  const [searchResults, setSearchResults] = useState([])
  const [likedYouIds, setLikedYouIds] = useState(new Set())

  useEffect(() => {
    if (!profile?.id) return
    let cancelled = false
    ;(async () => {
      setLoading(true)
      const p = await getDiscoverProfiles(profile)
      if (cancelled) return
      setProfiles(p)
      setCurrentIndex(0)
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

  const currentProfile = profiles[currentIndex]
  const alreadyLikedYou = currentProfile && likedYouIds.has(currentProfile.id)
  const alreadyMatched = currentProfile && profile?.matches?.includes(currentProfile.id)

  const handleSwipe = (action, message = null) => {
    if (!currentProfile) return
    if (alreadyMatched) {
      toast.error('You are already friends with this user!')
      return
    }
    if (alreadyLikedYou && action === 'like') {
      toast.error('They already sent you a request! Check Friend Requests.')
      return
    }

    const targetId = currentProfile.id
    setCurrentIndex((i) => i + 1)
    setProfile((prev) => patchProfileAfterSwipe(prev, targetId, action))
    if (action === 'like') toast.success('Friend request sent!')

    recordSwipe(user.uid, targetId, action, message).catch((err) => {
      toast.error(err.message || 'Failed to save swipe')
    })
  }

  const handleLikeWithMessage = (message) => {
    handleSwipe('like', message || null)
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

  if (loading) {
    return (
      <>
        <div className="h-full flex items-center justify-center">
          <LoadingSpinner />
        </div>
        <Modal isOpen={!!viewProfile} onClose={handleCloseProfile}>
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
  }

  if (!currentProfile) {
    return (
      <div className="h-full flex flex-col pb-24">
        <div className="flex items-center justify-between px-6 pt-6">
          <h1 className="text-xl font-bold">Discover</h1>
          <button
            onClick={() => setShowSearchPage(true)}
            className="p-2 hover:bg-white/10 rounded-full transition-colors"
            aria-label="Search by username"
          >
            <IconSearch size={20} />
          </button>
        </div>
        <div className="flex-1 flex items-center justify-center min-h-0">
          <EmptyState message="No more profiles to show. Check back later!" />
        </div>
        <Modal isOpen={!!viewProfile} onClose={handleCloseProfile}>
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
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col pb-24">
      <div className="flex items-center justify-between px-6 pt-6 z-10">
        <h1 className="text-xl font-bold">Discover</h1>
        <button
          onClick={() => setShowSearchPage(true)}
          className="p-2 hover:bg-white/10 rounded-full transition-colors"
          aria-label="Search by username"
        >
          <IconSearch size={20} />
        </button>
      </div>
      <div className="relative flex-1 mt-4">
        <SwipeCard
          key={currentProfile.id}
          profile={currentProfile}
          onSwipe={handleSwipe}
          onLikeWithMessage={() => {
            if (alreadyLikedYou) {
              toast.error('They already sent you a request! Check Friend Requests.')
              return
            }
            setShowMessageModal(true)
          }}
          alreadyLikedYou={alreadyLikedYou}
          alreadyMatched={alreadyMatched}
          onViewProfile={handleViewProfile}
        />
      </div>

      <LikeMessageModal
        isOpen={showMessageModal}
        onClose={() => setShowMessageModal(false)}
        onSend={handleLikeWithMessage}
      />

      <Modal isOpen={!!viewProfile} onClose={handleCloseProfile}>
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
    </div>
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
