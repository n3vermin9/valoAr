import { useState, useEffect, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import toast from 'react-hot-toast'
import { IconAdjustmentsHorizontal, IconLogout, IconTrash, IconDotsVertical, IconBellOff, IconBell, IconSettings, IconUserMinus, IconBan, IconMessage, IconUserPlus, IconCheck, IconX, IconSearch, IconUsers, IconChartBar } from '@tabler/icons-react'
import { useAuth } from '../../contexts/AuthContext'
import { fetchUser, fetchDeletedUser, recordSwipe, removeMatch, removeMatchKeepChat, updateUserSettings, acceptLike, cancelFriendRequest, subscribeIncomingRequest, subscribeOutgoingRequest, subscribeToUser, patchProfileAfterSwipe, patchProfileAfterMatch } from '../../services/userService'
import { subscribeChat } from '../../services/chatService'
import { isChatMuteActive } from '../../utils/chatMute'
import MuteChatModal from '../chat/MuteChatModal'
import ConfirmDialog from '../ui/ConfirmDialog'
import { getMatchId } from '../../utils/helpers'
import { storyOpenOriginFromRect } from '../../utils/storyHelpers'
import { navGlassMenuClass, contextMenuMotion, dropdownMenuClass, dropdownMenuItemWithIconClass, dropdownMenuItemWithIconDangerClass, profileActionBtnClass, typoTitle3Class, typoFootnoteClass, typoSubheadClass, typoHeadlineClass, insetCardOuterClass, btnBorderedClass, photoOverlayButtonClass, photoHeroTitleClass, segmentedControlClass, segmentedItemClass, segmentedItemActiveClass } from '../../utils/designSystem'
import { canDirectMessage } from '../../utils/directMessages'
import { SettingsSection, SettingSwitch, SettingsNavRow } from '../ui/SettingsUI'
import EditProfile from './EditProfile'
import BlockedList from './BlockedList'
import MatchHistory from './MatchHistory'
import Modal from '../ui/Modal'
import PhotoGallery from '../ui/PhotoGallery'
import PhotoHeroView, {
  PhotoHeroContentOverlap,
  PhotoHeroFixedBack,
  PhotoHeroFixedTopRight,
  PhotoHeroPlaceholder,
} from '../ui/PhotoHeroView'
import { ProfileSkeleton } from '../ui/Skeleton'
import CopyableUsername from '../ui/CopyableUsername'
import ChevronBack from '../ui/ChevronBack'
import PushPage from '../layout/PushPage'
import ProfileMutualGroups from './ProfileMutualGroups'
import ProfileAboutBlock from './ProfileAboutBlock'
import ProfileInterestsCard from './ProfileInterestsCard'
import DiscoverFiltersPanel from '../discover/DiscoverFiltersPanel'
import ProfileStoryAvatar from '../stories/ProfileStoryAvatar'
import StoryViewer from '../stories/StoryViewer'
import AnalyticsDashboard from '../analytics/AnalyticsDashboard'
import { isDurovAdmin } from '../../utils/appAdmin'
import { deletedAccountAvatarClass, deletedAccountAvatarSrc } from '../../utils/deletedAccountAvatar'
import { getCityLabel } from '../../utils/profileOptions'
import { hasActiveDiscoverFilters, loadDiscoverFilters } from '../../utils/discoverFilters'
import {
  applyAppearance,
  getStoredAppearance,
  normalizeAppearance,
} from '../../utils/appearance'

function profileAgeCityLine(profile) {
  const age = profile?.age != null ? `${profile.age} years old` : null
  const city = getCityLabel(profile?.city)
  if (age && city) return `${age} · ${city}`
  return age || city || ''
}

export default function ProfileView() {
  const { user, profile, logout, removeAccount, refreshProfile, setProfile } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [editing, setEditing] = useState(false)
  const [showBlocked, setShowBlocked] = useState(false)
  const [showMatches, setShowMatches] = useState(false)
  const [friendProfileId, setFriendProfileId] = useState(null)
  const [showSettings, setShowSettings] = useState(false)
  const [showAnalytics, setShowAnalytics] = useState(false)
  const [showDiscoverFilters, setShowDiscoverFilters] = useState(false)
  const [discoverSettingsFilters, setDiscoverSettingsFilters] = useState(loadDiscoverFilters)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [galleryOpen, setGalleryOpen] = useState(false)
  const [galleryOrigin, setGalleryOrigin] = useState(null)
  const [savingSettings, setSavingSettings] = useState(false)
  const [allowDirectMessages, setAllowDirectMessages] = useState(false)
  const [showFriendCount, setShowFriendCount] = useState(true)
  const [useMilitaryTime, setUseMilitaryTime] = useState(true)
  const [appearance, setAppearance] = useState(() =>
    normalizeAppearance(profile?.appearance ?? getStoredAppearance())
  )

  useEffect(() => {
    setAllowDirectMessages(profile?.allowDirectMessages === true)
  }, [profile?.allowDirectMessages])

  useEffect(() => {
    setShowFriendCount(profile?.showFriendCount !== false)
  }, [profile?.showFriendCount])

  useEffect(() => {
    setUseMilitaryTime(profile?.useMilitaryTime !== false)
  }, [profile?.useMilitaryTime])

  useEffect(() => {
    setAppearance(normalizeAppearance(profile?.appearance ?? getStoredAppearance()))
  }, [profile?.appearance])

  useEffect(() => {
    if (!location.state?.openSettings) return
    setShowSettings(true)
    navigate('/profile', { replace: true, state: null })
  }, [location.state?.openSettings, navigate])

  if (!profile) return <ProfileSkeleton />

  if (editing) return <EditProfile onCancel={() => setEditing(false)} />

  const memberSince = profile.createdAt?.toDate?.()
    ? profile.createdAt.toDate().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    : 'Recently'
  const profilePhotos = (profile.photos || []).filter(Boolean)
  const discoverFiltersActive = hasActiveDiscoverFilters(discoverSettingsFilters)

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

  const handleMessageAudienceChange = async (audience) => {
    if (!user?.uid || savingSettings) return
    const nextOpen = audience === 'everybody'
    if (nextOpen === allowDirectMessages) return
    setAllowDirectMessages(nextOpen)
    setSavingSettings(true)
    try {
      await updateUserSettings(user.uid, { allowDirectMessages: nextOpen })
      setProfile((prev) => (prev ? { ...prev, allowDirectMessages: nextOpen } : prev))
      toast.success(nextOpen ? 'Anyone can message you' : 'Only friends can message you')
    } catch {
      setAllowDirectMessages(!nextOpen)
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

  const handleAppearanceChange = async (next) => {
    if (!user?.uid || savingSettings) return
    const value = normalizeAppearance(next)
    if (value === appearance) return
    const previous = appearance
    setAppearance(value)
    applyAppearance(value)
    setSavingSettings(true)
    try {
      await updateUserSettings(user.uid, { appearance: value })
      setProfile((prev) => (prev ? { ...prev, appearance: value } : prev))
    } catch {
      setAppearance(previous)
      applyAppearance(previous)
      toast.error('Failed to update appearance')
    } finally {
      setSavingSettings(false)
    }
  }

  return (
    <div className="h-full min-h-0 overflow-y-auto pb-[var(--ios-nav-clearance)] bg-[var(--ios-bg)]">
      <PhotoHeroFixedTopRight>
        <button
          type="button"
          onClick={() => setShowSettings(true)}
          className={photoOverlayButtonClass}
          aria-label="Settings"
        >
          <IconSettings size={22} stroke={2} />
        </button>
      </PhotoHeroFixedTopRight>

      <div className="relative">
        {profilePhotos.length > 0 ? (
          <PhotoHeroView
            photos={profilePhotos}
            onPhotoTap={(e) => {
              setGalleryOrigin(storyOpenOriginFromRect(e.currentTarget.getBoundingClientRect()))
              setGalleryOpen(true)
            }}
          />
        ) : (
          <PhotoHeroPlaceholder>
            <div className="absolute inset-0 flex items-center justify-center px-6">
              <ProfileStoryAvatar
                userId={user.uid}
                profile={profile}
                isOwn
                size={128}
                onOpenGallery={(origin) => {
                  setGalleryOrigin(origin || null)
                  setGalleryOpen(true)
                }}
              />
            </div>
          </PhotoHeroPlaceholder>
        )}

        {profilePhotos.length > 0 ? (
          <div className="absolute bottom-5 right-[var(--ios-page-x-lg)] z-20 pointer-events-auto">
            <ProfileStoryAvatar
              userId={user.uid}
              profile={profile}
              isOwn
              size={72}
              hideWhenNoStories
              onOpenGallery={(origin) => {
                setGalleryOrigin(origin || null)
                setGalleryOpen(true)
              }}
            />
          </div>
        ) : null}
      </div>

      <PhotoHeroContentOverlap>
        <div className="flex flex-col items-center px-6 w-full">
          <h2 className={photoHeroTitleClass}>
            <CopyableUsername username={profile.username} className={photoHeroTitleClass} />
          </h2>
          <p className={typoSubheadClass}>{profileAgeCityLine(profile)}</p>
        </div>

        <div className="mx-[var(--ios-page-x-lg)] mt-6">
          <button
            type="button"
            onClick={() => setEditing(true)}
            className={`${btnBorderedClass} w-full`}
          >
            Edit profile
          </button>
        </div>

        <div className={`${insetCardOuterClass} mt-6 min-w-0 mx-[var(--ios-page-x-lg)]`}>
          <ProfileAboutBlock profile={profile} socialsVisible />
        </div>
        <ProfileInterestsCard profile={profile} />
      </PhotoHeroContentOverlap>

      <div className="mt-4">
        <SettingsSection>
          <SettingsNavRow
            icon={IconUsers}
            iconTone="blue"
            label="Friends"
            value={String(profile.matches?.length || 0)}
            onClick={() => setShowMatches(true)}
          />
        </SettingsSection>
      </div>

      <MemberSinceLine value={memberSince} />

      <PushPage open={showSettings} title="Settings" onBack={() => setShowSettings(false)}>
        <div className="flex-1 overflow-y-auto pb-[var(--ios-nav-clearance)] space-y-6">
          <SettingsSection title="Privacy & Security">
            <div className="px-4 py-4 border-b border-[var(--ios-hairline)]">
              <p className={typoHeadlineClass}>Who can message you</p>
              <p className={`${typoSubheadClass} mt-1 mb-3`}>
                When you are not friends yet. Both people need to allow everyone to chat.
              </p>
              <div className={segmentedControlClass}>
                {[
                  { id: 'friends', label: 'Friends only' },
                  { id: 'everybody', label: 'Everybody' },
                ].map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    disabled={savingSettings}
                    onClick={() => handleMessageAudienceChange(option.id)}
                    className={
                      (allowDirectMessages ? 'everybody' : 'friends') === option.id
                        ? segmentedItemActiveClass
                        : segmentedItemClass
                    }
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
            <SettingSwitch
              label="Show friend count"
              description="Let other people see how many friends you have."
              checked={showFriendCount}
              disabled={savingSettings}
              onChange={handleToggleShowFriendCount}
            />
            <SettingsNavRow
              icon={IconBan}
              iconTone="red"
              label="Blocked Users"
              description="People who can't message or find you."
              value={String(profile.blocked?.length || 0)}
              onClick={() => setShowBlocked(true)}
            />
          </SettingsSection>

          <SettingsSection title="Appearance">
            <div className="px-4 py-4 border-b border-[var(--ios-hairline)]">
              <p className={typoHeadlineClass}>Theme</p>
              <p className={`${typoSubheadClass} mt-1 mb-3`}>
                Light, dark, or match your device settings.
              </p>
              <div className={segmentedControlClass}>
                {[
                  { id: 'light', label: 'Light' },
                  { id: 'dark', label: 'Dark' },
                  { id: 'system', label: 'System' },
                ].map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    disabled={savingSettings}
                    onClick={() => handleAppearanceChange(option.id)}
                    className={
                      appearance === option.id ? segmentedItemActiveClass : segmentedItemClass
                    }
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
            <SettingSwitch
              label="24-hour time"
              description="Show message times as 18:30 instead of 6:30 PM."
              checked={useMilitaryTime}
              disabled={savingSettings}
              onChange={handleToggleUseMilitaryTime}
            />
          </SettingsSection>

          <SettingsSection>
            <SettingsNavRow
              icon={IconAdjustmentsHorizontal}
              iconTone="blue"
              label="Discover filters"
              description="Optional city and interest filters for your Discover feed."
              value={discoverFiltersActive ? 'On' : 'Off'}
              onClick={() => setShowDiscoverFilters(true)}
            />
          </SettingsSection>

          {isDurovAdmin(profile) && (
            <SettingsSection>
              <SettingsNavRow
                icon={IconChartBar}
                iconTone="blue"
                label="App analytics"
                onClick={() => {
                  setShowSettings(false)
                  setShowAnalytics(true)
                }}
              />
            </SettingsSection>
          )}

          <SettingsSection>
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
      </PushPage>

      <PushPage
        open={showBlocked}
        title="Blocked Users"
        onBack={() => setShowBlocked(false)}
        zIndexClass="z-[85]"
      >
        <div className="flex-1 overflow-y-auto pb-[var(--ios-nav-clearance)]">
          <BlockedList showTitle={false} />
        </div>
      </PushPage>

      <PushPage
        open={showDiscoverFilters}
        title="Discover Filters"
        onBack={() => setShowDiscoverFilters(false)}
        zIndexClass="z-[90]"
      >
        <div className="flex-1 overflow-y-auto px-[var(--ios-page-x-lg)] pb-[var(--ios-nav-clearance)]">
          <p className={`${typoSubheadClass} mb-5`}>
            These filters are optional and only affect your Discover cards.
          </p>
          <DiscoverFiltersPanel
            filters={discoverSettingsFilters}
            onChange={setDiscoverSettingsFilters}
            userId={user?.uid}
          />
        </div>
      </PushPage>

      {showAnalytics && (
        <AnalyticsDashboard onBack={() => setShowAnalytics(false)} />
      )}

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
          <h3 className={`${typoTitle3Class} mb-2`}>Delete Account?</h3>
          <p className="text-[var(--ios-label-secondary)] mb-6">This action is permanent and cannot be undone.</p>
          <div className="flex gap-3">
            <button
              onClick={() => setShowDeleteConfirm(false)}
              className="flex-1 py-3 bg-[var(--ios-fill-tertiary)] rounded-full"
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
        <PhotoGallery
          photos={profilePhotos}
          openOrigin={galleryOrigin}
          onClose={() => {
            setGalleryOpen(false)
            setGalleryOrigin(null)
          }}
        />
      )}
    </div>
  )
}

/** Closes out a profile: no card, no separator — just a quiet line under everything. */
function MemberSinceLine({ value }) {
  return (
    <p className={`${typoFootnoteClass} text-center text-[var(--ios-label-tertiary)] mt-8 mb-2`}>
      Member since {value}
    </p>
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
  const [galleryOrigin, setGalleryOrigin] = useState(null)
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
      <div className="h-full min-h-0 flex flex-col">
        {onClose ? <PhotoHeroFixedBack onBack={onClose} /> : null}
        <ProfileSkeleton />
      </div>
    )
  }

  if (!profile && !deletedProfile) {
    return (
      <div className="h-full min-h-0 overflow-y-auto pb-24">
        {onClose ? <PhotoHeroFixedBack onBack={onClose} /> : null}
        <p className="px-6 mt-[calc(var(--ios-safe-top)+4rem)] text-center text-[var(--ios-label-secondary)]">User not found</p>
      </div>
    )
  }

  const isDeleted = !profile && !!deletedProfile

  if (isDeleted) {
    return (
      <div className="h-full min-h-0 overflow-y-auto pb-24">
        {onClose ? <PhotoHeroFixedBack onBack={onClose} /> : null}
        <PhotoHeroPlaceholder>
          <div className="absolute inset-0 flex flex-col items-center justify-center px-6">
            <img
              src={deletedAccountAvatarSrc}
              alt=""
              className={`w-28 h-28 rounded-full object-cover border-4 border-[var(--ios-hairline)] ${deletedAccountAvatarClass}`}
            />
          </div>
        </PhotoHeroPlaceholder>
        <PhotoHeroContentOverlap>
          <div className="flex flex-col items-center px-6">
            <div className="flex items-center gap-2">
              <h2 className={photoHeroTitleClass}>
                <CopyableUsername username={deletedProfile.username} className={photoHeroTitleClass} />
              </h2>
            </div>
            <p className="text-sm text-[var(--ios-label-tertiary)] mt-1">Account deleted</p>
          </div>
        </PhotoHeroContentOverlap>
      </div>
    )
  }

  const isSelf = user?.uid === userId
  const me = viewerProfile ?? currentProfile
  const isMatched =
    me?.matches?.includes(userId) ||
    me?.swipes?.[userId] === 'matched' ||
    profile?.matches?.includes(user?.uid)
  const showMessage =
    isMatched ||
    hasActiveChat ||
    canDirectMessage({ myProfile: me, otherProfile: profile, otherId: userId })
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
  const allPhotos = (profile.photos || []).filter(Boolean)
  const viewablePhotos = isSelf || isMatched ? allPhotos : allPhotos.slice(0, 1)
  const hasHeroPhoto = viewablePhotos.length > 0

  const handleSendFriendRequest = async () => {
    if (requesting) return
    const previousProfile = currentProfile
    setRequesting(true)
    setAuthProfile((prev) => patchProfileAfterSwipe(prev, userId, 'like'))
    try {
      await recordSwipe(user.uid, userId, 'like')
      toast.success('Friend request sent!')
    } catch (err) {
      setAuthProfile(previousProfile)
      toast.error(err.message || 'Failed to send request')
    } finally {
      setRequesting(false)
    }
  }

  const handleCancelFriendRequest = async () => {
    if (requesting) return
    const previousProfile = currentProfile
    setRequesting(true)
    setAuthProfile((prev) => {
      if (!prev?.swipes) return prev
      const swipes = { ...prev.swipes }
      delete swipes[userId]
      return { ...prev, swipes }
    })
    try {
      await cancelFriendRequest(user.uid, userId)
      toast.success('Request cancelled')
    } catch {
      setAuthProfile(previousProfile)
      toast.error('Failed to cancel request')
    } finally {
      setRequesting(false)
    }
  }

  const handleAcceptRequest = async () => {
    if (accepting) return
    const previousProfile = currentProfile
    setAccepting(true)
    setAuthProfile((prev) => patchProfileAfterMatch(prev, userId))
    try {
      await acceptLike(user.uid, userId)
      toast.success("You're now friends!")
      onClose?.()
    } catch {
      setAuthProfile(previousProfile)
      toast.error('Failed to accept request')
    } finally {
      setAccepting(false)
    }
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
      onDismissHost?.()
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
  const showMoreMenu = !isSelf && (isMatched || onBlock)

  const profileActionCount = [
    showAcceptRequest,
    !showAcceptRequest && showMessage,
    !showAcceptRequest && showSendRequest,
    showSearchButton,
    showMuteButton,
    showMoreMenu,
  ].filter(Boolean).length
  const actionBtnClass =
    profileActionCount === 1
      ? `${profileActionBtnClass} !rounded-full`
      : profileActionBtnClass

  const profileMenu =
    showMoreMenu ? (
      <div className="relative flex-1 min-w-0" ref={menuRef}>
        <button
          type="button"
          onClick={() => setShowMenu((open) => !open)}
          className={`${actionBtnClass} w-full`}
          aria-label="More options"
        >
          <IconDotsVertical size={20} className="text-[var(--ios-label-secondary)]" stroke={3} />
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
                  <IconUserMinus size={18} stroke={1.75} className="shrink-0 text-[var(--ios-label-secondary)]" />
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
      {onClose ? <PhotoHeroFixedBack onBack={onClose} /> : null}

      <div className="relative">
        {hasHeroPhoto ? (
          <PhotoHeroView
            photos={viewablePhotos}
            onPhotoTap={(e) => {
              setGalleryOrigin(storyOpenOriginFromRect(e.currentTarget.getBoundingClientRect()))
              setGalleryOpen(true)
            }}
          />
        ) : (
          <PhotoHeroPlaceholder>
            <div className="absolute inset-0 flex items-center justify-center px-6">
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
                onOpenGallery={(origin) => {
                  setGalleryOrigin(origin || null)
                  setGalleryOpen(true)
                }}
                onNavigateToProfile={(watcherId) => navigate(`/profile/${watcherId}`)}
                onOpenStories={suppressStoryViewer ? undefined : setStorySession}
              />
            </div>
          </PhotoHeroPlaceholder>
        )}

        {hasHeroPhoto && !suppressStoryViewer ? (
          <div className="absolute bottom-5 right-[var(--ios-page-x-lg)] z-20 pointer-events-auto">
            <ProfileStoryAvatar
              userId={userId}
              profile={profile}
              isOwn={isSelf}
              isFriend={isMatched}
              friendIds={me?.matches}
              viewerUsername={me?.username}
              viewerPhoto={me?.photos?.[0]}
              size={72}
              hideWhenNoStories
              onOpenGallery={(origin) => {
                setGalleryOrigin(origin || null)
                setGalleryOpen(true)
              }}
              onNavigateToProfile={(watcherId) => navigate(`/profile/${watcherId}`)}
              onOpenStories={setStorySession}
            />
          </div>
        ) : null}
      </div>

      <PhotoHeroContentOverlap>
        <div className="flex flex-col items-center px-6 w-full">
        <div className="flex items-center gap-2">
          <h2 className={photoHeroTitleClass}>
            <CopyableUsername username={profile.username} className={photoHeroTitleClass} />
          </h2>
          {isMuted && (
            <IconBellOff size={18} className="text-[var(--ios-label-tertiary)] shrink-0" aria-label="Muted" />
          )}
        </div>
        <p className="text-[var(--ios-label-secondary)]">{profileAgeCityLine(profile)}</p>

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
                  className={actionBtnClass}
                >
                  <IconCheck size={20} className="text-[var(--ios-label-secondary)]" stroke={3} />
                </button>
              )}
              {!showAcceptRequest && showMessage && (
                <button
                  type="button"
                  onClick={handleMessage}
                  aria-label="Message"
                  className={actionBtnClass}
                >
                  <IconMessage size={20} className="text-[var(--ios-label-secondary)]" stroke={3} />
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
                  className={`group ${actionBtnClass}`}
                >
                  {friendRequestPending ? (
                    <>
                      <IconCheck
                        size={20}
                        className="text-[var(--ios-label-secondary)] group-hover:hidden"
                        stroke={3}
                      />
                      <IconX
                        size={20}
                        className="hidden text-[var(--ios-label)] group-hover:block"
                        stroke={3}
                      />
                    </>
                  ) : (
                    <IconUserPlus size={20} className="text-[var(--ios-label-secondary)]" stroke={3} />
                  )}
                </button>
              )}
              {showSearchButton && (
                <button
                  type="button"
                  onClick={handleSearchChat}
                  aria-label="Search chat"
                  className={actionBtnClass}
                >
                  <IconSearch size={20} className="text-[var(--ios-label-secondary)]" stroke={3} />
                </button>
              )}
              {showMuteButton && (
                <button
                  type="button"
                  onClick={handleOpenMute}
                  aria-label="Notification settings"
                  className={actionBtnClass}
                >
                  {isMuted ? (
                    <IconBell size={20} className="text-[var(--ios-label-secondary)]" stroke={3} />
                  ) : (
                    <IconBellOff size={20} className="text-[var(--ios-label-secondary)]" stroke={3} />
                  )}
                </button>
              )}
              {profileMenu}
            </div>
          )}
      </div>

      <div className={`${insetCardOuterClass} mt-6 min-w-0 mx-[var(--ios-page-x-lg)]`}>
        <ProfileAboutBlock
          profile={profile}
          showFriendCount={!isSelf && profile.showFriendCount !== false}
          friendCount={friendCount}
          socialsVisible={isSelf || isMatched}
        />
      </div>
      <ProfileInterestsCard profile={profile} />

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

      <MemberSinceLine value={memberSince} />

      </PhotoHeroContentOverlap>

      {galleryOpen && (
        <PhotoGallery
          photos={viewablePhotos}
          openOrigin={galleryOrigin}
          onClose={() => {
            setGalleryOpen(false)
            setGalleryOrigin(null)
          }}
        />
      )}

      <Modal isOpen={confirmRemoveMatch} onClose={() => !removeMatchLoading && setConfirmRemoveMatch(false)} glass>
        <div className="p-6">
          <h3 className={`${typoTitle3Class} mb-2`}>Remove friend?</h3>
          <p className="text-[var(--ios-label-secondary)] mb-5">Choose what happens to your chat with this person.</p>
          <div className="flex flex-col gap-3">
            <button
              type="button"
              onClick={() => handleRemoveMatch('keep')}
              disabled={removeMatchLoading}
              className="w-full py-3 rounded-full bg-blue-500/90 border border-blue-400/25 hover:bg-blue-500 transition-colors disabled:opacity-50 font-medium"
            >
              {removeMatchLoading ? 'Please wait...' : 'Unfriend — keep chat'}
            </button>
            <p className="text-xs text-[var(--ios-label-tertiary)] -mt-1 px-1">
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
            <p className="text-xs text-[var(--ios-label-tertiary)] -mt-1 px-1">
              Deletes the conversation for both of you.
            </p>
            <button
              type="button"
              onClick={() => setConfirmRemoveMatch(false)}
              disabled={removeMatchLoading}
              className="w-full py-3 rounded-full border border-[var(--ios-hairline)] bg-[var(--ios-fill-tertiary)] hover:bg-[var(--ios-fill-secondary)] transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        </div>
      </Modal>

      {storySession ? (
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
      ) : null}

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
