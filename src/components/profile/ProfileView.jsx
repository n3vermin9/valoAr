import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import toast from 'react-hot-toast'
import { IconLogout, IconTrash, IconDotsVertical, IconBellOff, IconBell, IconSettings, IconUserMinus, IconBan, IconMessage, IconUserPlus, IconCheck, IconX, IconSearch, IconUsers, IconPalette } from '@tabler/icons-react'
import { useAuth } from '../../contexts/AuthContext'
import { fetchUser, fetchDeletedUser, recordSwipe, removeMatch, removeMatchKeepChat, updateUserSettings, acceptLike, cancelFriendRequest, subscribeIncomingRequest, subscribeOutgoingRequest, subscribeToUser, patchProfileAfterSwipe, patchProfileAfterMatch } from '../../services/userService'
import { subscribeChat } from '../../services/chatService'
import { isChatMuteActive } from '../../utils/chatMute'
import MuteChatModal from '../chat/MuteChatModal'
import ConfirmDialog from '../ui/ConfirmDialog'
import { getMatchId } from '../../utils/helpers'
import { navGlassMenuClass, contextMenuMotion, dropdownMenuClass, dropdownMenuItemWithIconClass, dropdownMenuItemWithIconDangerClass, profileActionBtnClass, typoTitle2Class, typoCaptionClass, typoBodyClass, typoSubheadClass, insetCardOuterClass, btnBorderedClass } from '../../utils/designSystem'
import { SettingsSection, SettingSwitch, SettingsNavRow } from '../ui/SettingsUI'
import EditProfile from './EditProfile'
import BlockedList from './BlockedList'
import MatchHistory from './MatchHistory'
import ProfileLookingFor from './ProfileLookingFor'
import Modal from '../ui/Modal'
import PhotoGallery from '../ui/PhotoGallery'
import LoadingSpinner from '../ui/LoadingSpinner'
import CopyableUsername from '../ui/CopyableUsername'
import ChevronBack from '../ui/ChevronBack'
import { SubpageHeaderBar } from '../layout/SubpageShell'
import ChatBackgroundSettings from './ChatBackgroundSettings'
import SocialLinksDisplay from './SocialLinksDisplay'
import ProfileMutualGroups from './ProfileMutualGroups'
import ProfileStoryAvatar from '../stories/ProfileStoryAvatar'
import StoryViewer from '../stories/StoryViewer'
import { deletedAccountAvatarClass, deletedAccountAvatarSrc } from '../../utils/deletedAccountAvatar'

export default function ProfileView() {
  const { user, profile, logout, removeAccount, refreshProfile, setProfile } = useAuth()
  const navigate = useNavigate()
  const [editing, setEditing] = useState(false)
  const [showBlocked, setShowBlocked] = useState(false)
  const [showMatches, setShowMatches] = useState(false)
  const [friendProfileId, setFriendProfileId] = useState(null)
  const [showSettings, setShowSettings] = useState(false)
  const [showChatBackground, setShowChatBackground] = useState(false)
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
      <div className="flex items-center justify-end px-6 pt-6">
        <button
          type="button"
          onClick={() => setShowSettings(true)}
          className="p-2 hover:bg-white/10 rounded-full transition-colors"
          aria-label="Settings"
        >
          <IconSettings size={22} className="text-white/80" stroke={2} />
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
        <h2 className={`${typoTitle2Class} mt-4`}>
          <CopyableUsername username={profile.username} className={typoTitle2Class} />
        </h2>
        <p className={typoSubheadClass}>{profile.age} years old</p>
      </div>

      <div className={`${insetCardOuterClass} mt-6 min-w-0`}>
        <div className="p-4 min-w-0">
          <p className={`${typoBodyClass} text-white/90 break-words whitespace-pre-wrap`}>
            {profile.bio || 'No bio yet'}
          </p>
          <ProfileLookingFor gender={profile.gender} interestedIn={profile.interestedIn} />
          <SocialLinksDisplay socials={profile.socials} />
        </div>
        <InfoRow label="Member Since" value={memberSince} small />
      </div>

      <div className="mt-4">
        <SettingsSection>
          <SettingsNavRow
            icon={IconUsers}
            iconTone="blue"
            label="Friends"
            value={String(profile.matches?.length || 0)}
            onClick={() => setShowMatches(true)}
          />
          <SettingsNavRow
            icon={IconBan}
            iconTone="red"
            label="Blocked Users"
            value={String(profile.blocked?.length || 0)}
            onClick={() => setShowBlocked(true)}
          />
        </SettingsSection>
      </div>

      <div className="mx-[var(--ios-page-x-lg)] mt-6">
        <button
          onClick={() => setEditing(true)}
          className={`${btnBorderedClass} w-full`}
        >
          Edit profile
        </button>
      </div>

      {showSettings && (
        <div className="fixed inset-0 z-[80] bg-black flex flex-col">
          <SubpageHeaderBar title="Settings" onBack={() => setShowSettings(false)} />

          <div className="flex-1 overflow-y-auto pb-8 space-y-6">
            <SettingsSection title="Privacy">
              <SettingSwitch
                label="Open to messages"
                checked={allowDirectMessages}
                disabled={savingSettings}
                onChange={handleToggleDirectMessages}
              />
              <SettingSwitch
                label="Show friend count"
                checked={showFriendCount}
                disabled={savingSettings}
                onChange={handleToggleShowFriendCount}
              />
              <SettingSwitch
                label="24-hour time"
                checked={useMilitaryTime}
                disabled={savingSettings}
                onChange={handleToggleUseMilitaryTime}
              />
            </SettingsSection>

            <SettingsSection title="Appearance">
              <SettingsNavRow
                icon={IconPalette}
                iconTone="violet"
                label="Chat background"
                onClick={() => setShowChatBackground(true)}
              />
            </SettingsSection>

            <SettingsSection title="Danger zone">
              <SettingsNavRow
                icon={IconLogout}
                iconTone="red"
                danger
                label="Log out"
                onClick={() => {
                  setShowSettings(false)
                  logout()
                }}
                trailing={null}
              />
              <SettingsNavRow
                icon={IconTrash}
                iconTone="red"
                danger
                label="Delete account"
                onClick={() => {
                  setShowSettings(false)
                  setShowDeleteConfirm(true)
                }}
                trailing={null}
              />
            </SettingsSection>
          </div>
        </div>
      )}

      {showChatBackground && (
        <ChatBackgroundSettings onBack={() => setShowChatBackground(false)} />
      )}

      <Modal isOpen={showBlocked} onClose={() => setShowBlocked(false)} className="max-w-lg">
        <BlockedList />
      </Modal>

      <Modal isOpen={showMatches} onClose={() => setShowMatches(false)} className="max-w-lg">
        <MatchHistory onSelectFriend={setFriendProfileId} />
      </Modal>

      <Modal isOpen={!!friendProfileId} onClose={() => setFriendProfileId(null)} fullscreen>
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
    <div
      className={`flex justify-between px-4 pb-4 pt-3 border-t border-white/10 ${
        small ? 'text-xs text-white/40' : ''
      }`}
    >
      <span className={small ? '' : 'text-white/50'}>{label}</span>
      <span className={`${capitalize ? 'capitalize' : ''} ${small ? 'text-white/50' : ''}`}>{value}</span>
    </div>
  )
}

export function PublicProfileView({
  userId,
  onClose,
  onBlock,
  fromChat = false,
  suppressStoryViewer = false,
  onDismissHost,
}) {
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
  const [outgoingRequestActive, setOutgoingRequestActive] = useState(false)
  const [accepting, setAccepting] = useState(false)
  const [showMuteModal, setShowMuteModal] = useState(false)
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
    if (!user?.uid || user.uid === userId) {
      setOutgoingRequestActive(false)
      return
    }
    return subscribeOutgoingRequest(user.uid, userId, setOutgoingRequestActive)
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

  if (loading) {
    return (
      <div className="h-full min-h-0 flex items-center justify-center">
        <LoadingSpinner />
      </div>
    )
  }

  if (!profile && !deletedProfile) {
    return (
      <div className="h-full min-h-0 overflow-y-auto pb-24">
        <div className="flex items-center px-6 pt-[max(1.5rem,var(--ios-safe-top))]">
          {onClose && <ChevronBack onClick={onClose} />}
        </div>
        <p className="px-6 mt-8 text-center text-white/60">User not found</p>
      </div>
    )
  }

  const isDeleted = !profile && !!deletedProfile

  if (isDeleted) {
    return (
      <div className="h-full min-h-0 overflow-y-auto pb-24">
        <div className="flex items-center px-6 pt-[max(1.5rem,var(--ios-safe-top))]">
          {onClose && <ChevronBack onClick={onClose} />}
        </div>
        <div className="flex flex-col items-center px-6 mt-4">
          <img
            src={deletedAccountAvatarSrc}
            alt=""
            className={`w-28 h-28 rounded-full object-cover border-4 border-white/10 ${deletedAccountAvatarClass}`}
          />
          <div className="flex items-center gap-2 mt-3">
            <h2 className={typoTitle2Class}>
              <CopyableUsername username={deletedProfile.username} className={typoTitle2Class} />
            </h2>
          </div>
          <p className="text-sm text-white/50 mt-1">Account deleted</p>
        </div>
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
  const showSendRequest = !isMatched && !hasIncomingRequest
  const isMuted = isChatMuteActive(chatData, user?.uid)
  const friendRequestPending =
    !isMatched && me?.swipes?.[userId] === 'like' && outgoingRequestActive
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

  const handleCancelFriendRequest = () => {
    if (requesting) return
    setRequesting(true)
    setAuthProfile((prev) => {
      if (!prev?.swipes) return prev
      const swipes = { ...prev.swipes }
      delete swipes[userId]
      return { ...prev, swipes }
    })
    toast.success('Request cancelled')
    setRequesting(false)

    cancelFriendRequest(user.uid, userId).catch(() => {
      toast.error('Failed to cancel request')
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
    onDismissHost?.()
    onClose?.()
    navigate(`/chats/${matchId}`, { state: hasActiveChat ? undefined : { draft: true } })
  }

  const handleSearchChat = () => {
    const matchId = getMatchId(user.uid, userId)
    onDismissHost?.()
    onClose?.()
    navigate(`/chats/${matchId}`, {
      state: {
        ...(hasActiveChat ? {} : { draft: true }),
        openSearch: true,
      },
    })
  }

  const handleOpenMute = () => {
    if (!hasActiveChat) return
    setShowMuteModal(true)
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

  const showProfileActions = !isSelf && chatResolved
  const showChatTools = showMessage
  const showMuteButton = showChatTools && hasActiveChat
  const showSearchButton = showChatTools

  const profileMenu =
    !isSelf && (isMatched || onBlock) ? (
      <div className="relative flex-1 min-w-0" ref={menuRef}>
        <button
          type="button"
          onClick={() => setShowMenu((open) => !open)}
          className={`${profileActionBtnClass} w-full`}
          aria-label="More options"
        >
          <IconDotsVertical size={20} className="text-white/70" stroke={3} />
        </button>

        <AnimatePresence>
          {showMenu && (
            <motion.div
              {...contextMenuMotion}
              className={`absolute right-0 top-full mt-2 z-50 ${dropdownMenuClass} ${navGlassMenuClass}`}
            >
              {isMatched && (
                <button
                  type="button"
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
                  type="button"
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
    ) : null

  return (
    <div className="h-full min-h-0 overflow-y-auto pb-24">
      <div className="flex items-center px-6 pt-[max(1.5rem,var(--ios-safe-top))]">
        {onClose ? <ChevronBack onClick={onClose} /> : <span className="w-10" aria-hidden />}
      </div>

      <div className="flex flex-col items-center px-6 w-full">
        <ProfileStoryAvatar
          userId={userId}
          profile={profile}
          isOwn={isSelf}
          isFriend={isMatched}
          friendIds={me?.matches}
          viewerUsername={me?.username}
          viewerPhoto={me?.photos?.[0]}
          size={128}
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
        <div className="flex items-center gap-2 mt-4">
          <h2 className={typoTitle2Class}>
            <CopyableUsername username={profile.username} className={typoTitle2Class} />
          </h2>
          {isMuted && (
            <IconBellOff size={18} className="text-white/50 shrink-0" aria-label="Muted" />
          )}
        </div>
        <p className="text-white/60">{profile.age} years old</p>

        {showProfileActions &&
          (showAcceptRequest ||
            showMessage ||
            showSendRequest ||
            showMuteButton ||
            showSearchButton ||
            profileMenu) && (
            <div className="mt-4 w-full flex items-center gap-2">
              {showAcceptRequest && (
                <button
                  type="button"
                  onClick={handleAcceptRequest}
                  disabled={accepting}
                  aria-label="Accept friend request"
                  className={profileActionBtnClass}
                >
                  <IconCheck size={20} className="text-white/70" stroke={3} />
                </button>
              )}
              {!showAcceptRequest && showMessage && (
                <button
                  type="button"
                  onClick={handleMessage}
                  aria-label="Message"
                  className={profileActionBtnClass}
                >
                  <IconMessage size={20} className="text-white/70" stroke={3} />
                </button>
              )}
              {!showAcceptRequest && showSendRequest && (
                <button
                  type="button"
                  onClick={
                    friendRequestPending ? handleCancelFriendRequest : handleSendFriendRequest
                  }
                  disabled={requesting}
                  aria-label={
                    friendRequestPending
                      ? 'Undo friend request'
                      : requesting
                        ? 'Sending friend request'
                        : 'Send friend request'
                  }
                  className={`group ${profileActionBtnClass}`}
                >
                  {friendRequestPending ? (
                    <>
                      <IconCheck
                        size={20}
                        className="text-white/60 group-hover:hidden"
                        stroke={3}
                      />
                      <IconX
                        size={20}
                        className="hidden text-white/90 group-hover:block"
                        stroke={3}
                      />
                    </>
                  ) : (
                    <IconUserPlus size={20} className="text-white/70" stroke={3} />
                  )}
                </button>
              )}
              {showSearchButton && (
                <button
                  type="button"
                  onClick={handleSearchChat}
                  aria-label="Search chat"
                  className={profileActionBtnClass}
                >
                  <IconSearch size={20} className="text-white/70" stroke={3} />
                </button>
              )}
              {showMuteButton && (
                <button
                  type="button"
                  onClick={handleOpenMute}
                  aria-label="Notification settings"
                  className={profileActionBtnClass}
                >
                  {isMuted ? (
                    <IconBell size={20} className="text-white/70" stroke={3} />
                  ) : (
                    <IconBellOff size={20} className="text-white/70" stroke={3} />
                  )}
                </button>
              )}
              {profileMenu}
            </div>
          )}
      </div>

      <div className={`${insetCardOuterClass} mt-6 min-w-0`}>
        <div className="p-4 min-w-0">
          <p className={`${typoBodyClass} text-white/90 break-words whitespace-pre-wrap`}>
            {profile.bio || 'No bio yet'}
          </p>
          <ProfileLookingFor gender={profile.gender} interestedIn={profile.interestedIn} />
          {!isSelf && profile.showFriendCount !== false && (
            <p className="text-sm text-white/50 mt-1">
              Has {friendCount} {friendCount === 1 ? 'friend' : 'friends'}
            </p>
          )}
          <SocialLinksDisplay socials={profile.socials} visible={isSelf || isMatched} />
        </div>
        <InfoRow label="Member Since" value={memberSince} small />
      </div>

      {!isSelf && user?.uid && (
        <ProfileMutualGroups
          viewerId={user.uid}
          profileUserId={userId}
          onOpenGroup={(groupId) => {
            onDismissHost?.()
            onClose?.()
            navigate(`/chats/${groupId}`)
          }}
        />
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

      <MuteChatModal
        isOpen={showMuteModal}
        onClose={() => setShowMuteModal(false)}
        chatId={user?.uid && userId ? getMatchId(user.uid, userId) : null}
        chat={chatData}
        userId={user?.uid}
        title="Chat notifications"
      />
    </div>
  )
}
