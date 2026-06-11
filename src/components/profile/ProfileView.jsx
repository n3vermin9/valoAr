import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import toast from 'react-hot-toast'
import { IconShare, IconLogout, IconTrash, IconDotsVertical, IconBellOff, IconSettings, IconUserMinus, IconBan } from '@tabler/icons-react'
import { useAuth } from '../../contexts/AuthContext'
import { fetchUser, fetchDeletedUser, recordSwipe, removeMatch, removeMatchKeepChat, updateUserSettings, acceptLike, subscribeIncomingRequest, subscribeToUser, patchProfileAfterSwipe, patchProfileAfterMatch } from '../../services/userService'
import { subscribeChat } from '../../services/chatService'
import ConfirmDialog from '../ui/ConfirmDialog'
import { shareProfile, getMatchId } from '../../utils/helpers'
import { navGlassMenuClass, contextMenuMotion, dropdownMenuClass, dropdownMenuItemWithIconClass, dropdownMenuItemWithIconDangerClass } from '../../utils/designSystem'
import EditProfile from './EditProfile'
import BlockedList from './BlockedList'
import MatchHistory from './MatchHistory'
import ProfileLookingFor from './ProfileLookingFor'
import Modal from '../ui/Modal'
import PhotoGallery from '../ui/PhotoGallery'
import LoadingSpinner from '../ui/LoadingSpinner'
import CopyableUsername from '../ui/CopyableUsername'
import ChevronBack from '../ui/ChevronBack'
import SocialLinksDisplay from './SocialLinksDisplay'
import ProfileStoryAvatar from '../stories/ProfileStoryAvatar'
import StoryViewer from '../stories/StoryViewer'
import { sad } from '../../assets'

export default function ProfileView() {
  const { user, profile, logout, removeAccount, refreshProfile, setProfile } = useAuth()
  const navigate = useNavigate()
  const [editing, setEditing] = useState(false)
  const [showBlocked, setShowBlocked] = useState(false)
  const [showMatches, setShowMatches] = useState(false)
  const [friendProfileId, setFriendProfileId] = useState(null)
  const [showSettings, setShowSettings] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [galleryOpen, setGalleryOpen] = useState(false)
  const [savingSettings, setSavingSettings] = useState(false)
  const [allowDirectMessages, setAllowDirectMessages] = useState(false)
  const [showFriendCount, setShowFriendCount] = useState(true)
  const [useMilitaryTime, setUseMilitaryTime] = useState(true)

  useEffect(() => {
    setAllowDirectMessages(profile?.allowDirectMessages === true)
  }, [profile?.allowDirectMessages])

  useEffect(() => {
    setShowFriendCount(profile?.showFriendCount !== false)
  }, [profile?.showFriendCount])

  useEffect(() => {
    setUseMilitaryTime(profile?.useMilitaryTime !== false)
  }, [profile?.useMilitaryTime])

  if (!profile) return <LoadingSpinner />

  if (editing) return <EditProfile onCancel={() => setEditing(false)} />

  const memberSince = profile.createdAt?.toDate?.()
    ? profile.createdAt.toDate().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    : 'Recently'

  const handleShare = async () => {
    try {
      await shareProfile(user.uid, profile.username)
      toast.success('Profile link copied!')
    } catch {
      toast.error('Could not share profile')
    }
  }

  const handleDelete = async () => {
    setDeleting(true)
    try {
      await removeAccount()
    } catch (err) {
      toast.error(err.message || 'Failed to delete account')
      setDeleting(false)
      return
    }
    setShowDeleteConfirm(false)
    setShowSettings(false)
    window.location.href = '/login'
  }

  const handleToggleDirectMessages = async () => {
    if (!user?.uid || savingSettings) return
    const next = !allowDirectMessages
    setAllowDirectMessages(next)
    setSavingSettings(true)
    try {
      await updateUserSettings(user.uid, { allowDirectMessages: next })
      setProfile((prev) => (prev ? { ...prev, allowDirectMessages: next } : prev))
      toast.success(next ? 'Anyone can message you' : 'Messages require a friend request')
    } catch {
      setAllowDirectMessages(!next)
      toast.error('Failed to update setting')
    } finally {
      setSavingSettings(false)
    }
  }

  const handleToggleShowFriendCount = async () => {
    if (!user?.uid || savingSettings) return
    const next = !showFriendCount
    setShowFriendCount(next)
    setSavingSettings(true)
    try {
      await updateUserSettings(user.uid, { showFriendCount: next })
      setProfile((prev) => (prev ? { ...prev, showFriendCount: next } : prev))
      toast.success(next ? 'Friend count is visible on your profile' : 'Friend count hidden from your profile')
    } catch {
      setShowFriendCount(!next)
      toast.error('Failed to update setting')
    } finally {
      setSavingSettings(false)
    }
  }

  const handleToggleUseMilitaryTime = async () => {
    if (!user?.uid || savingSettings) return
    const next = !useMilitaryTime
    setUseMilitaryTime(next)
    setSavingSettings(true)
    try {
      await updateUserSettings(user.uid, { useMilitaryTime: next })
      setProfile((prev) => (prev ? { ...prev, useMilitaryTime: next } : prev))
      toast.success(next ? 'Using 24-hour time' : 'Using 12-hour time')
    } catch {
      setUseMilitaryTime(!next)
      toast.error('Failed to update setting')
    } finally {
      setSavingSettings(false)
    }
  }

  return (
    <div className="h-full overflow-y-auto pb-24">
      <div className="flex items-center justify-between px-6 pt-6">
        <button
          onClick={handleShare}
          className="p-2 hover:bg-white/10 rounded-full transition-colors"
          aria-label="Share profile"
        >
          <IconShare size={22} className="text-white/80" />
        </button>
        <button
          onClick={() => setShowSettings(true)}
          className="p-2 hover:bg-white/10 rounded-full transition-colors"
          aria-label="Settings"
        >
          <IconSettings size={22} className="text-white/80" />
        </button>
      </div>

      <div className="flex flex-col items-center px-6">
        <ProfileStoryAvatar
          userId={user.uid}
          profile={profile}
          isOwn
          size={128}
          onOpenGallery={() => setGalleryOpen(true)}
        />
        <button
          type="button"
          onClick={() => setGalleryOpen(true)}
          className="mt-2 text-xs text-[var(--ios-label-secondary)] hover:text-white transition-colors"
        >
          View photos
        </button>
        <h2 className="text-2xl font-bold mt-4">
          <CopyableUsername username={profile.username} className="text-2xl font-bold" />
        </h2>
        <p className="text-white/60">{profile.age} years old</p>
      </div>

      <div className="mx-6 mt-6 p-4 bg-white/5 rounded-2xl border border-white/10">
        <div className="pb-4 mb-4 border-b border-white/10">
          <p className="text-xs uppercase tracking-wider text-white/40 mb-2">Bio</p>
          <p className="text-base text-white/90 leading-relaxed">
            {profile.bio || 'No bio yet'}
          </p>
          <ProfileLookingFor gender={profile.gender} interestedIn={profile.interestedIn} />
          <SocialLinksDisplay socials={profile.socials} />
        </div>
        <InfoRow label="Member Since" value={memberSince} small />
      </div>

      <div className="mx-6 mt-4 flex flex-col gap-2">
        <button
          onClick={() => setShowMatches(true)}
          className="w-full flex items-center justify-between px-4 py-4 bg-white/5 hover:bg-white/10 rounded-2xl border border-white/10 transition-colors text-left"
        >
          <span className="font-medium">Friends</span>
          <span className="text-sm text-white/40">{profile.matches?.length || 0}</span>
        </button>
        <button
          onClick={() => setShowBlocked(true)}
          className="w-full flex items-center justify-between px-4 py-4 bg-white/5 hover:bg-white/10 rounded-2xl border border-white/10 transition-colors text-left"
        >
          <span className="font-medium">Blocked Users</span>
          <span className="text-sm text-white/40">{profile.blocked?.length || 0}</span>
        </button>
      </div>

      <div className="mx-6 mt-6">
        <button
          onClick={() => setEditing(true)}
          className="w-full flex items-center justify-center gap-2 py-3 bg-white/10 hover:bg-white/20 rounded-full transition-colors"
        >
          Edit
        </button>
      </div>

      {showSettings && (
        <div className="fixed inset-0 z-[80] bg-black flex flex-col">
          <div className="flex items-center gap-2 px-4 pt-4 pb-3 border-b border-white/10">
            <ChevronBack onClick={() => setShowSettings(false)} />
            <h1 className="text-lg font-semibold">Settings</h1>
          </div>

          <div className="flex-1 overflow-y-auto pb-8">
            <div className="px-4 py-4 border-b border-white/10">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="font-medium">Open to messages</p>
                  <p className="text-sm text-white/50 mt-1">
                    Let people message you without sending a friend request first
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={allowDirectMessages}
                  disabled={savingSettings}
                  onClick={handleToggleDirectMessages}
                  className={`relative w-12 h-7 rounded-full transition-colors shrink-0 disabled:opacity-50 ${
                    allowDirectMessages ? 'bg-blue-500' : 'bg-white/20'
                  }`}
                >
                  <span
                    className={`absolute top-1 left-1 w-5 h-5 rounded-full bg-white transition-transform ${
                      allowDirectMessages ? 'translate-x-5' : ''
                    }`}
                  />
                </button>
              </div>
            </div>

            <div className="px-4 py-4 border-b border-white/10">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="font-medium">Show friend count</p>
                  <p className="text-sm text-white/50 mt-1">
                    Display how many friends you have on your public profile
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={showFriendCount}
                  disabled={savingSettings}
                  onClick={handleToggleShowFriendCount}
                  className={`relative w-12 h-7 rounded-full transition-colors shrink-0 disabled:opacity-50 ${
                    showFriendCount ? 'bg-blue-500' : 'bg-white/20'
                  }`}
                >
                  <span
                    className={`absolute top-1 left-1 w-5 h-5 rounded-full bg-white transition-transform ${
                      showFriendCount ? 'translate-x-5' : ''
                    }`}
                  />
                </button>
              </div>
            </div>

            <div className="px-4 py-4 border-b border-white/10">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="font-medium">24-hour time</p>
                  <p className="text-sm text-white/50 mt-1">
                    Show chat times in military format (14:30 instead of 2:30 PM)
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={useMilitaryTime}
                  disabled={savingSettings}
                  onClick={handleToggleUseMilitaryTime}
                  className={`relative w-12 h-7 rounded-full transition-colors shrink-0 disabled:opacity-50 ${
                    useMilitaryTime ? 'bg-blue-500' : 'bg-white/20'
                  }`}
                >
                  <span
                    className={`absolute top-1 left-1 w-5 h-5 rounded-full bg-white transition-transform ${
                      useMilitaryTime ? 'translate-x-5' : ''
                    }`}
                  />
                </button>
              </div>
            </div>

            <button
              onClick={() => {
                setShowSettings(false)
                logout()
              }}
              className="w-full flex items-center gap-3 px-4 py-4 hover:bg-white/5 transition-colors text-left border-b border-white/10"
            >
              <IconLogout size={18} /> Log Out
            </button>
            <button
              onClick={() => {
                setShowSettings(false)
                setShowDeleteConfirm(true)
              }}
              className="w-full flex items-center gap-3 px-4 py-4 text-red-400 hover:bg-red-500/10 transition-colors text-left"
            >
              <IconTrash size={18} /> Delete Account
            </button>
          </div>
        </div>
      )}

      <Modal isOpen={showBlocked} onClose={() => setShowBlocked(false)} className="max-w-lg">
        <BlockedList />
      </Modal>

      <Modal isOpen={showMatches} onClose={() => setShowMatches(false)} className="max-w-lg">
        <MatchHistory onSelectFriend={setFriendProfileId} />
      </Modal>

      <Modal isOpen={!!friendProfileId} onClose={() => setFriendProfileId(null)}>
        {friendProfileId && (
          <PublicProfileView userId={friendProfileId} onClose={() => setFriendProfileId(null)} />
        )}
      </Modal>

      <Modal isOpen={showDeleteConfirm} onClose={() => setShowDeleteConfirm(false)}>
        <div className="p-6 text-center">
          <h3 className="text-lg font-semibold mb-2">Delete Account?</h3>
          <p className="text-white/60 mb-6">This action is permanent and cannot be undone.</p>
          <div className="flex gap-3">
            <button
              onClick={() => setShowDeleteConfirm(false)}
              className="flex-1 py-3 bg-white/10 rounded-full"
            >
              Cancel
            </button>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="flex-1 py-3 bg-red-500 rounded-full disabled:opacity-50"
            >
              {deleting ? 'Deleting...' : 'Delete'}
            </button>
          </div>
        </div>
      </Modal>

      {galleryOpen && (
        <PhotoGallery photos={profile.photos} onClose={() => setGalleryOpen(false)} />
      )}
    </div>
  )
}

function InfoRow({ label, value, capitalize, small }) {
  return (
    <div className={`flex justify-between ${small ? 'text-xs text-white/40' : ''}`}>
      <span className={small ? '' : 'text-white/50'}>{label}</span>
      <span className={`${capitalize ? 'capitalize' : ''} ${small ? 'text-white/50' : ''}`}>{value}</span>
    </div>
  )
}

export function PublicProfileView({ userId, onClose, onBlock, fromChat = false, suppressStoryViewer = false }) {
  const { user, profile: currentProfile, refreshProfile, setProfile: setAuthProfile } = useAuth()
  const navigate = useNavigate()
  const [profile, setProfile] = useState(null)
  const [deletedProfile, setDeletedProfile] = useState(null)
  const [viewerProfile, setViewerProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [galleryOpen, setGalleryOpen] = useState(false)
  const [requesting, setRequesting] = useState(false)
  const [showMenu, setShowMenu] = useState(false)
  const [confirmRemoveMatch, setConfirmRemoveMatch] = useState(false)
  const [removeMatchLoading, setRemoveMatchLoading] = useState(false)
  const [hasActiveChat, setHasActiveChat] = useState(false)
  const [chatData, setChatData] = useState(null)
  const [chatResolved, setChatResolved] = useState(false)
  const [incomingRequest, setIncomingRequest] = useState(null)
  const [accepting, setAccepting] = useState(false)
  const [storySession, setStorySession] = useState(null)
  const menuRef = useRef(null)

  useEffect(() => {
    setLoading(true)
    setProfile(null)
    setDeletedProfile(null)
    const unsub = subscribeToUser(userId, async (p) => {
      if (p) {
        setProfile(p)
        setDeletedProfile(null)
        setLoading(false)
        return
      }
      const deleted = await fetchDeletedUser(userId)
      setProfile(null)
      setDeletedProfile(deleted)
      setLoading(false)
    })
    return unsub
  }, [userId])

  useEffect(() => {
    if (!user?.uid || user.uid === userId) {
      setViewerProfile(null)
      return
    }
    return subscribeToUser(user.uid, (p) => {
      setViewerProfile(p)
      if (p) setAuthProfile(p)
    })
  }, [user?.uid, userId, setAuthProfile])

  useEffect(() => {
    if (!user?.uid || user.uid === userId) {
      setHasActiveChat(false)
      setChatResolved(true)
      return
    }
    setChatResolved(false)
    setHasActiveChat(false)
    const matchId = getMatchId(user.uid, userId)
    return subscribeChat(matchId, (chat) => {
      setHasActiveChat(!!chat && !chat.hiddenFor?.includes(user.uid))
      setChatData(chat)
      setChatResolved(true)
    })
  }, [user?.uid, userId])

  useEffect(() => {
    if (!user?.uid || user.uid === userId) {
      setIncomingRequest(null)
      return
    }
    return subscribeIncomingRequest(user.uid, userId, setIncomingRequest)
  }, [user?.uid, userId])

  useEffect(() => {
    if (!showMenu) return
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setShowMenu(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showMenu])

  if (loading) return <LoadingSpinner />
  if (!profile && !deletedProfile) return <p className="p-6 text-center text-white/60">User not found</p>

  const isDeleted = !profile && !!deletedProfile

  if (isDeleted) {
    return (
      <div className="p-6 relative">
        <div className="flex flex-col items-center">
          <img
            src={sad}
            alt=""
            className="w-28 h-28 rounded-full object-cover border-4 border-white/10"
          />
          <div className="flex items-center gap-2 mt-3">
            <h2 className="text-xl font-bold">
              <CopyableUsername username={deletedProfile.username} className="text-xl font-bold" />
            </h2>
          </div>
          <p className="text-sm text-white/50 mt-1">Account deleted</p>
        </div>
        {onClose && (
          <button onClick={onClose} className="w-full mt-6 py-3 bg-white/10 hover:bg-white/15 rounded-full font-medium">
            Close
          </button>
        )}
      </div>
    )
  }

  const isSelf = user?.uid === userId
  const me = viewerProfile ?? currentProfile
  const isMatched =
    me?.matches?.includes(userId) ||
    me?.swipes?.[userId] === 'matched' ||
    profile?.matches?.includes(user?.uid)
  const allowsDirectMessages = profile?.allowDirectMessages === true
  const showMessage = isMatched || hasActiveChat || allowsDirectMessages
  const hasIncomingRequest = !!incomingRequest
  const showAcceptRequest = !isMatched && hasIncomingRequest
  const showSendRequest = !isMatched && !hasIncomingRequest && !allowsDirectMessages
  const isMuted = chatData?.mutedBy?.includes(user?.uid)
  const friendRequestPending = !isMatched && me?.swipes?.[userId] === 'like'
  const friendCount = profile.matches?.length || 0
  const memberSince = profile.createdAt?.toDate?.()
    ? profile.createdAt.toDate().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    : 'Recently'

  const handleSendFriendRequest = () => {
    if (requesting) return
    setRequesting(true)
    setAuthProfile((prev) => patchProfileAfterSwipe(prev, userId, 'like'))
    toast.success('Friend request sent!')
    setRequesting(false)

    recordSwipe(user.uid, userId, 'like').catch((err) => {
      toast.error(err.message || 'Failed to send request')
    })
  }

  const handleAcceptRequest = () => {
    if (accepting) return
    setAccepting(true)
    setAuthProfile((prev) => patchProfileAfterMatch(prev, userId))
    toast.success("You're now friends!")
    onClose?.()
    setAccepting(false)

    acceptLike(user.uid, userId).catch(() => {
      toast.error('Failed to accept request')
    })
  }

  const handleMessage = () => {
    const matchId = getMatchId(user.uid, userId)
    navigate(`/chats/${matchId}`, { state: hasActiveChat ? undefined : { draft: true } })
    onClose?.()
  }

  const handleRemoveMatch = async (mode) => {
    setRemoveMatchLoading(true)
    try {
      if (mode === 'keep') {
        await removeMatchKeepChat(user.uid, userId)
        toast.success('Friend removed — chat history kept')
      } else {
        await removeMatch(user.uid, userId)
        toast.success('Friend removed and chat deleted')
      }
      await refreshProfile()
      setConfirmRemoveMatch(false)
      onClose?.()
      if (fromChat && mode === 'remove') navigate('/chats')
    } catch {
      toast.error('Failed to remove friend')
    } finally {
      setRemoveMatchLoading(false)
    }
  }

  return (
    <div className="p-6 relative">
      {!isSelf && (isMatched || onBlock) && (
        <div className="absolute top-6 right-6 z-10" ref={menuRef}>
          <button
            onClick={() => setShowMenu((open) => !open)}
            className="p-2 hover:bg-white/10 rounded-full"
          >
            <IconDotsVertical size={20} />
          </button>

          <AnimatePresence>
            {showMenu && (
              <motion.div
                {...contextMenuMotion}
                className={`absolute right-0 top-full mt-2 z-50 ${dropdownMenuClass} ${navGlassMenuClass}`}
              >
                {isMatched && (
                  <button
                    onClick={() => {
                      setShowMenu(false)
                      setConfirmRemoveMatch(true)
                    }}
                    className={dropdownMenuItemWithIconClass}
                  >
                    <IconUserMinus size={18} stroke={1.75} className="shrink-0 text-white/55" />
                    Remove Friend
                  </button>
                )}
                {onBlock && (
                  <button
                    onClick={() => {
                      setShowMenu(false)
                      onBlock(userId)
                    }}
                    className={dropdownMenuItemWithIconDangerClass}
                  >
                    <IconBan size={18} stroke={1.75} className="shrink-0 text-red-400" />
                    Block
                  </button>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      <div className="flex flex-col items-center">
        <ProfileStoryAvatar
          userId={userId}
          profile={profile}
          isOwn={isSelf}
          isFriend={isMatched}
          friendIds={me?.matches}
          viewerUsername={me?.username}
          viewerPhoto={me?.photos?.[0]}
          size={112}
          suppressStoryViewer={suppressStoryViewer}
          onOpenGallery={() => setGalleryOpen(true)}
          onNavigateToProfile={(watcherId) => navigate(`/profile/${watcherId}`)}
          onOpenStories={suppressStoryViewer ? undefined : setStorySession}
        />
        {(isSelf || isMatched) && (
          <button
            type="button"
            onClick={() => setGalleryOpen(true)}
            className="mt-2 text-xs text-[var(--ios-label-secondary)] hover:text-white transition-colors"
          >
            View photos
          </button>
        )}
        <div className="flex items-center gap-2 mt-3">
          <h2 className="text-xl font-bold">
            <CopyableUsername username={profile.username} className="text-xl font-bold" />
          </h2>
          {isMuted && (
            <IconBellOff size={18} className="text-white/50 shrink-0" aria-label="Muted" />
          )}
        </div>
        <p className="text-white/60">{profile.age} years old</p>
      </div>

      <div className="mt-6 p-4 bg-white/5 rounded-2xl border border-white/10">
        <div className="pb-4 mb-4 border-b border-white/10">
          <p className="text-xs uppercase tracking-wider text-white/40 mb-2">Bio</p>
          <p className="text-base text-white/90 leading-relaxed">
            {profile.bio || 'No bio yet'}
          </p>
          <ProfileLookingFor gender={profile.gender} interestedIn={profile.interestedIn} />
          <SocialLinksDisplay socials={profile.socials} visible={isSelf || isMatched} />
          {!isSelf && profile.showFriendCount !== false && (
            <p className="text-sm text-white/50 mt-3">
              Has {friendCount} {friendCount === 1 ? 'friend' : 'friends'}
            </p>
          )}
        </div>
        <InfoRow label="Member Since" value={memberSince} small />
      </div>

      {!isSelf && chatResolved && (
        <div className="flex flex-col gap-3 mt-6">
          {showAcceptRequest && (
            <button
              onClick={handleAcceptRequest}
              disabled={accepting}
              className="w-full py-3 bg-green-500 hover:bg-green-600 rounded-full font-medium disabled:opacity-50"
            >
              {accepting ? 'Accepting...' : 'Accept Request'}
            </button>
          )}
          {!showAcceptRequest && showMessage && (
            <button
              onClick={handleMessage}
              className="w-full py-3 bg-blue-500 hover:bg-blue-600 rounded-full font-medium"
            >
              Message
            </button>
          )}
          {!showAcceptRequest && showSendRequest && (
            <button
              onClick={handleSendFriendRequest}
              disabled={requesting || friendRequestPending}
              className="w-full py-3 bg-blue-500 hover:bg-blue-600 rounded-full font-medium disabled:opacity-50"
            >
              {friendRequestPending ? 'Request Sent' : requesting ? 'Sending...' : 'Send Request'}
            </button>
          )}
          {onClose && (
            <button onClick={onClose} className="w-full py-3 bg-white/10 hover:bg-white/15 rounded-full font-medium">
              Close
            </button>
          )}
        </div>
      )}

      {isSelf && onClose && (
        <button onClick={onClose} className="w-full mt-6 py-3 bg-white/10 rounded-full">
          Close
        </button>
      )}

      {galleryOpen && (
        <PhotoGallery photos={profile.photos} onClose={() => setGalleryOpen(false)} />
      )}

      <Modal isOpen={confirmRemoveMatch} onClose={() => !removeMatchLoading && setConfirmRemoveMatch(false)} glass>
        <div className="p-6">
          <h3 className="text-lg font-semibold mb-2">Remove friend?</h3>
          <p className="text-white/60 mb-5">Choose what happens to your chat with this person.</p>
          <div className="flex flex-col gap-3">
            <button
              type="button"
              onClick={() => handleRemoveMatch('keep')}
              disabled={removeMatchLoading}
              className="w-full py-3 rounded-full bg-blue-500/90 border border-blue-400/25 hover:bg-blue-500 transition-colors disabled:opacity-50 font-medium"
            >
              {removeMatchLoading ? 'Please wait...' : 'Unfriend — keep chat'}
            </button>
            <p className="text-xs text-white/45 -mt-1 px-1">
              Chat stays visible but neither of you can send new messages.
            </p>
            <button
              type="button"
              onClick={() => handleRemoveMatch('remove')}
              disabled={removeMatchLoading}
              className="w-full py-3 rounded-full bg-red-500/90 border border-red-400/25 hover:bg-red-500 transition-colors disabled:opacity-50 font-medium"
            >
              {removeMatchLoading ? 'Please wait...' : 'Unfriend & remove chat'}
            </button>
            <p className="text-xs text-white/45 -mt-1 px-1">
              Deletes the conversation for both of you.
            </p>
            <button
              type="button"
              onClick={() => setConfirmRemoveMatch(false)}
              disabled={removeMatchLoading}
              className="w-full py-3 rounded-full border border-white/[0.1] bg-white/[0.08] hover:bg-white/[0.12] transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </div>
      </Modal>

      {storySession && storySession.queue[0]?.stories?.length > 0 && (
        <StoryViewer
          key={storySession.id}
          queue={storySession.queue}
          startIndex={0}
          initialStoryIndex={storySession.initialStoryIndex}
          openOrigin={storySession.origin}
          users={storySession.users}
          viewerId={storySession.viewerId}
          viewerUsername={storySession.viewerUsername}
          viewerPhoto={storySession.viewerPhoto}
          friendIds={storySession.friendIds}
          onClose={() => setStorySession(null)}
          onNavigateToProfile={(watcherId) => navigate(`/profile/${watcherId}`)}
        />
      )}
    </div>
  )
}
