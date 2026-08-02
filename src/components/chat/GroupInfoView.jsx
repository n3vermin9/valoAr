import { useState, useEffect } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import toast from 'react-hot-toast'
import {
  IconSettings,
  IconMessage,
  IconBell,
  IconBellOff,
  IconLink,
} from '@tabler/icons-react'
import { useAuth } from '../../contexts/AuthContext'
import { subscribeChat } from '../../services/chatService'
import { fetchUsersMap } from '../../services/userService'
import { joinGroupViaButton } from '../../services/groupChatService'
import {
  getGroupDisplayName,
  getGroupJoinLink,
  getGroupPhotoUrl,
  isGroupAdmin,
  isGroupMember,
  canAdmin,
} from '../../utils/groupChat'
import { isChatMuteActive } from '../../utils/chatMute'
import { SettingsSection } from '../ui/SettingsUI'
import {
  profileActionBtnClass,
  typoTitle2Class,
  typoBodyClass,
  insetCardClass,
  fieldLabelClass,
} from '../../utils/designSystem'
import GroupAvatar from './GroupAvatar'
import MuteChatModal from './MuteChatModal'
import GroupMemberRow from './GroupMemberRow'
import { ProfileSkeleton } from '../ui/Skeleton'
import Modal from '../ui/Modal'
import { PublicProfileView } from '../profile/ProfileView'
import PhotoGallery from '../ui/PhotoGallery'
import PhotoHeroView, {
  PhotoHeroContentOverlap,
  PhotoHeroFixedBack,
  PhotoHeroPlaceholder,
} from '../ui/PhotoHeroView'
import { storyOpenOriginFromRect } from '../../utils/storyHelpers'

export default function GroupInfoView() {
  const { chatId } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const { user, profile } = useAuth()
  const [chat, setChat] = useState(null)
  const [members, setMembers] = useState({})
  const [memberSearch, setMemberSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [joining, setJoining] = useState(false)
  const [showMuteModal, setShowMuteModal] = useState(false)
  const [galleryOpen, setGalleryOpen] = useState(false)
  const [galleryOrigin, setGalleryOrigin] = useState(null)
  const [profileUserId, setProfileUserId] = useState(null)

  const fromChat = location.state?.fromChat === true
  const fromChatPreview = location.state?.fromChatPreview === true
  const returnTo = location.state?.returnTo || null
  const previewJoinSlug = location.state?.joinSlug || null
  const previewReturnTo = location.state?.previewReturnTo || '/discover'

  useEffect(() => {
    if (!chatId) return
    return subscribeChat(chatId, (data) => {
      if (data?.type !== 'group') {
        setChat(null)
        setLoading(false)
        return
      }
      setChat(data)
      setLoading(false)
    })
  }, [chatId])

  useEffect(() => {
    if (!chat?.participants?.length) return
    fetchUsersMap(chat.participants).then(setMembers)
  }, [chat?.participants?.join(',')])

  useEffect(() => {
    if (!chat || loading || fromChat || fromChatPreview) return
    const member = isGroupMember(chat, user?.uid)
    const isPublic = chat.settings?.visibility === 'public'
    if (!member && isPublic) {
      navigate(`/chats/${chatId}`, { replace: true, state: { groupPreview: true } })
    }
  }, [chat, loading, fromChat, fromChatPreview, chatId, navigate, user?.uid])

  const handleBack = () => {
    if (returnTo) {
      navigate(returnTo, fromChatPreview ? {
        state: {
          groupPreview: true,
          joinSlug: previewJoinSlug || undefined,
          previewReturnTo,
        },
      } : undefined)
      return
    }
    if (fromChatPreview) {
      navigate(`/chats/${chatId}`, {
        state: {
          groupPreview: true,
          joinSlug: previewJoinSlug || undefined,
          previewReturnTo,
        },
      })
      return
    }
    if (fromChat) {
      navigate(`/chats/${chatId}`)
      return
    }
    if (chat && isGroupMember(chat, user?.uid)) {
      navigate(`/chats/${chatId}`)
      return
    }
    navigate(previewReturnTo)
  }

  const handleCopyLink = async () => {
    const link = getGroupJoinLink(chat)
    if (!link) return
    try {
      await navigator.clipboard.writeText(link)
      toast.success('Group link copied!')
    } catch {
      toast.error('Could not copy link')
    }
  }

  const handleJoin = async () => {
    if (!user?.uid) return
    setJoining(true)
    try {
      const result = await joinGroupViaButton(chatId, user.uid, profile?.username)
      if (result.status === 'pending') {
        toast.success('Join request sent')
        return
      }
      toast.success('Joined group')
      navigate(`/chats/${chatId}`, { replace: true, state: {} })
    } catch (err) {
      toast.error(err.message || 'Failed to join group')
    } finally {
      setJoining(false)
    }
  }

  const handleMessage = () => {
    navigate(`/chats/${chatId}`)
  }

  const handleOpenSettings = () => {
    navigate(`/groups/${chatId}/settings`, { state: location.state })
  }

  const handleOpenMute = () => {
    setShowMuteModal(true)
  }

  if (loading) {
    return (
      <div className="h-full flex flex-col">
        <PhotoHeroFixedBack onBack={handleBack} />
        <ProfileSkeleton />
      </div>
    )
  }

  if (!chat) {
    return (
      <div className="h-full overflow-y-auto pb-24">
        <PhotoHeroFixedBack onBack={handleBack} />
        <p className="px-6 mt-[calc(var(--ios-safe-top)+4rem)] text-center text-white/60">Group not found</p>
      </div>
    )
  }

  const isMember = isGroupMember(chat, user?.uid)
  const isAdmin = isGroupAdmin(chat, user?.uid)
  const isMuted = isChatMuteActive(chat, user?.uid)
  const isPublic = chat.settings?.visibility === 'public'
  const memberCount = chat.participants?.length || 0
  const showJoin = !isMember && isPublic
  const showSettingsTop = isMember && isAdmin
  const showFullPreview = isMember || isPublic
  const showPrivatePreview = !isMember && !isPublic
  const showMembers = isMember || isPublic
  const canManageMembers =
    isMember && (canAdmin(chat, user?.uid, 'removeMembers') || canAdmin(chat, user?.uid, 'manageAdmins'))
  const joinLink = isMember ? getGroupJoinLink(chat) : null
  const description = chat.description?.trim() || 'No description yet'
  const showAboutCard = Boolean((joinLink && isMember) || showFullPreview)
  const groupPhoto = getGroupPhotoUrl(chat)
  const groupPhotos = groupPhoto ? [groupPhoto] : []
  const memberSearchTerm = memberSearch.trim().toLowerCase()
  const filteredMemberIds = (chat.participants || []).filter((memberId) => {
    if (!memberSearchTerm) return true
    const member = members[memberId]
    const username = member?.username?.toLowerCase() || ''
    return username.includes(memberSearchTerm) || memberId.includes(memberSearchTerm)
  })

  return (
    <>
    <div className={`h-full overflow-y-auto ${showJoin ? 'pb-28' : 'pb-24'}`}>
      <PhotoHeroFixedBack onBack={handleBack} />

      <div className="relative">
        {groupPhotos.length > 0 ? (
          <PhotoHeroView
            photos={groupPhotos}
            onPhotoTap={(e) => {
              setGalleryOrigin(storyOpenOriginFromRect(e.currentTarget.getBoundingClientRect()))
              setGalleryOpen(true)
            }}
          />
        ) : (
          <PhotoHeroPlaceholder>
            <div className="absolute inset-0 flex items-center justify-center">
              <GroupAvatar photoUrl={chat.photoUrl} size={128} className="border-4 border-white/10" />
            </div>
          </PhotoHeroPlaceholder>
        )}
      </div>

      <PhotoHeroContentOverlap>
        <div className="flex flex-col items-center px-6">
        <h2 className={`${typoTitle2Class} text-center`}>{getGroupDisplayName(chat)}</h2>
        {!showPrivatePreview && (
          <div className="flex items-center gap-2 mt-1">
            <p className="text-white/60">
              {memberCount} member{memberCount === 1 ? '' : 's'}
            </p>
            {isMuted && (
              <IconBellOff size={16} className="text-white/50 shrink-0" aria-label="Muted" />
            )}
          </div>
        )}

        {isMember && (
          <div className="mt-4 w-full flex items-center justify-center gap-2">
            <button
              type="button"
              onClick={handleMessage}
              aria-label="Message"
              className={profileActionBtnClass}
            >
              <IconMessage size={20} className="text-white/70" stroke={3} />
            </button>
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
            {showSettingsTop && (
              <button
                type="button"
                onClick={handleOpenSettings}
                aria-label="Group settings"
                className={profileActionBtnClass}
              >
                <IconSettings size={20} className="text-white/70" stroke={3} />
              </button>
            )}
          </div>
        )}
      </div>

      {showAboutCard && (
        <div className="mx-[var(--ios-page-x-lg)] mt-6">
          <div className={`${insetCardClass} p-4 min-w-0`}>
            {joinLink && (
              <div>
                <p className={fieldLabelClass}>Link</p>
                <button
                  type="button"
                  onClick={handleCopyLink}
                  className="w-full flex items-center gap-2 py-1 transition-opacity text-left min-w-0 hover:opacity-80"
                >
                  <IconLink size={18} className="text-blue-400 shrink-0" />
                  <span className="text-[15px] text-blue-300/90 truncate">{joinLink}</span>
                </button>
              </div>
            )}
            {showFullPreview && (
              <div className={joinLink ? 'mt-4 pt-4 border-t border-white/10' : ''}>
                <p className={fieldLabelClass}>Bio</p>
                <p className={`${typoBodyClass} text-white/90 whitespace-pre-wrap break-words`}>
                  {description}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {showMembers && (
        <div className="mt-6">
          <SettingsSection title={`Members · ${memberCount}`}>
            {memberCount > 8 && (
              <div className="px-4 py-3 border-b border-white/10">
                <input
                  type="search"
                  value={memberSearch}
                  onChange={(e) => setMemberSearch(e.target.value)}
                  placeholder="Search members"
                  className="w-full min-h-[40px] px-4 rounded-full bg-[var(--ios-fill-tertiary)] border border-white/10 text-[15px] text-white placeholder:text-white/40 outline-none"
                />
              </div>
            )}
            {filteredMemberIds.length === 0 ? (
              <p className="px-4 py-4 text-sm text-white/50">No members match your search</p>
            ) : (
              filteredMemberIds.map((memberId) => (
                <GroupMemberRow
                  key={memberId}
                  chat={chat}
                  chatId={chatId}
                  memberId={memberId}
                  member={members[memberId]}
                  currentUserId={user?.uid}
                  variant={canManageMembers ? 'info' : 'readonly'}
                  onSelect={setProfileUserId}
                  className="border-b border-white/10 last:border-b-0"
                />
              ))
            )}
          </SettingsSection>
        </div>
      )}

      </PhotoHeroContentOverlap>

      {showJoin && (
        <div className="fixed bottom-0 left-0 right-0 z-20 px-6 pb-[max(1.5rem,var(--ios-safe-bottom))] pt-4 bg-gradient-to-t from-black via-black/95 to-transparent">
          <button
            type="button"
            onClick={handleJoin}
            disabled={joining}
            className="w-full flex items-center justify-center gap-2 py-3 bg-blue-500 hover:bg-blue-600 disabled:opacity-50 rounded-full transition-colors font-medium"
          >
            {joining ? 'Joining…' : 'Join chat'}
          </button>
        </div>
      )}
    </div>

      <MuteChatModal
        isOpen={showMuteModal}
        onClose={() => setShowMuteModal(false)}
        chatId={chatId}
        chat={chat}
        userId={user?.uid}
        title="Group notifications"
      />

      {galleryOpen && groupPhotos.length > 0 && (
        <PhotoGallery
          photos={groupPhotos}
          openOrigin={galleryOrigin}
          onClose={() => {
            setGalleryOpen(false)
            setGalleryOrigin(null)
          }}
        />
      )}

      <Modal isOpen={Boolean(profileUserId)} onClose={() => setProfileUserId(null)} fullscreen>
        {profileUserId && (
          <PublicProfileView
            userId={profileUserId}
            onClose={() => setProfileUserId(null)}
          />
        )}
      </Modal>
    </>
  )
}
