import { useState, useEffect } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import toast from 'react-hot-toast'
import {
  IconShare,
  IconSettings,
  IconMessage,
  IconUserPlus,
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
  getGroupInviteUrl,
  getGroupUsername,
  isGroupAdmin,
  isGroupMember,
  isGroupOwner,
} from '../../utils/groupChat'
import { isChatMuteActive } from '../../utils/chatMute'
import { profileActionBtnClass } from '../../utils/designSystem'
import GroupAvatar from './GroupAvatar'
import MuteChatModal from './MuteChatModal'
import CachedAvatar from '../ui/CachedAvatar'
import LoadingSpinner from '../ui/LoadingSpinner'
import ChevronBack from '../ui/ChevronBack'
import { sad } from '../../assets'

function InfoRow({ label, value }) {
  return (
    <div className="flex justify-between text-xs text-white/40">
      <span>{label}</span>
      <span className="text-white/50">{value}</span>
    </div>
  )
}

export default function GroupInfoView() {
  const { chatId } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const { user } = useAuth()
  const [chat, setChat] = useState(null)
  const [members, setMembers] = useState({})
  const [loading, setLoading] = useState(true)
  const [joining, setJoining] = useState(false)
  const [showMuteModal, setShowMuteModal] = useState(false)

  const fromChat = location.state?.fromChat === true

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

  const handleBack = () => {
    if (fromChat) {
      navigate(`/chats/${chatId}`)
      return
    }
    navigate(-1)
  }

  const handleCopyLink = async () => {
    if (!chat?.inviteCode) return
    try {
      await navigator.clipboard.writeText(getGroupInviteUrl(chat.inviteCode))
      toast.success('Invite link copied!')
    } catch {
      toast.error('Could not copy link')
    }
  }

  const handleShare = handleCopyLink

  const handleJoin = async () => {
    if (!user?.uid) return
    setJoining(true)
    try {
      await joinGroupViaButton(chatId, user.uid)
      toast.success('Joined group')
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
      <div className="h-full flex items-center justify-center">
        <LoadingSpinner />
      </div>
    )
  }

  if (!chat) {
    return (
      <div className="h-full overflow-y-auto pb-24">
        <div className="flex items-center px-6 pt-[max(1.5rem,var(--ios-safe-top))]">
          <ChevronBack onClick={handleBack} />
        </div>
        <p className="px-6 mt-8 text-center text-white/60">Group not found</p>
      </div>
    )
  }

  const isMember = isGroupMember(chat, user?.uid)
  const isAdmin = isGroupAdmin(chat, user?.uid)
  const isMuted = isChatMuteActive(chat, user?.uid)
  const memberCount = chat.participants?.length || 0
  const showJoin = !isMember && chat.settings?.joinViaButton
  const showMessage = isMember
  const showSettingsTop = isMember && isAdmin

  return (
    <>
    <div className="h-full overflow-y-auto pb-24">
      <div className="flex items-center justify-between px-6 pt-[max(1.5rem,var(--ios-safe-top))]">
        <ChevronBack onClick={handleBack} />
        {isMember && chat?.inviteCode ? (
          <button
            type="button"
            onClick={handleShare}
            className="p-2 hover:bg-white/10 rounded-full transition-colors"
            aria-label="Share invite link"
          >
            <IconShare size={22} className="text-white/80" />
          </button>
        ) : (
          <span className="w-10" aria-hidden />
        )}
      </div>

      <div className="flex flex-col items-center px-6">
        <GroupAvatar photoUrl={chat.photoUrl} size={128} className="border-4 border-white/10" iconClassName="scale-125" />
        <h2 className="text-2xl font-bold mt-4 text-center">{getGroupDisplayName(chat)}</h2>
        {getGroupUsername(chat) && (
          <p className="text-sm text-white/50 mt-0.5">@{getGroupUsername(chat)}</p>
        )}
        <div className="flex items-center gap-2 mt-1">
          <p className="text-white/60">
            {memberCount} member{memberCount === 1 ? '' : 's'}
          </p>
          {isMuted && (
            <IconBellOff size={16} className="text-white/50 shrink-0" aria-label="Muted" />
          )}
        </div>

        {(showMessage || showJoin || isMember) && (
          <div className="mt-4 w-full flex items-center justify-center gap-2">
            {showMessage && (
              <button
                type="button"
                onClick={handleMessage}
                aria-label="Message"
                className={profileActionBtnClass}
              >
                <IconMessage size={20} className="text-white/70" stroke={3} />
              </button>
            )}
            {isMember && (
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
            {showJoin && (
              <button
                type="button"
                onClick={handleJoin}
                disabled={joining}
                aria-label="Join group"
                className={profileActionBtnClass}
              >
                <IconUserPlus size={20} className="text-white/70" stroke={3} />
              </button>
            )}
          </div>
        )}
      </div>

      {isMember && chat?.inviteCode && (
        <button
          type="button"
          onClick={handleCopyLink}
          className="mx-6 mt-6 w-[calc(100%-3rem)] flex items-center gap-2 px-4 py-3 bg-white/5 hover:bg-white/10 rounded-2xl border border-white/10 transition-colors text-left min-w-0"
        >
          <IconLink size={18} className="text-blue-400 shrink-0" />
          <span className="text-sm text-blue-300/90 truncate">{getGroupInviteUrl(chat.inviteCode)}</span>
        </button>
      )}

      <div className="mx-6 mt-6 p-4 bg-white/5 rounded-2xl border border-white/10 min-w-0 overflow-hidden">
        <div className="pb-4 mb-4 border-b border-white/10 min-w-0">
          <p className="text-xs uppercase tracking-wider text-white/40 mb-2">About</p>
          <p className="text-base text-white/90 leading-relaxed break-words whitespace-pre-wrap">
            {chat.description?.trim() || 'No description yet'}
          </p>
        </div>
        <InfoRow
          label="Visibility"
          value={chat.settings?.visibility === 'public' ? 'Public' : 'Private'}
        />
      </div>

      <div className="mx-6 mt-4">
        <div className="w-full px-4 py-4 bg-white/5 rounded-2xl border border-white/10">
          <div className="flex items-center justify-between mb-3">
            <span className="font-medium">Members</span>
            <span className="text-sm text-white/40">{memberCount}</span>
          </div>
          <div className="space-y-2">
            {(chat.participants || []).map((memberId) => {
              const member = members[memberId]
              const admin = isGroupAdmin(chat, memberId)
              const owner = isGroupOwner(chat, memberId)
              return (
                <div key={memberId} className="flex items-center gap-3 py-1">
                  <CachedAvatar
                    src={member?.photos?.[0]}
                    fallback={sad}
                    size={36}
                    alt=""
                    className="w-9 h-9 rounded-full object-cover shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">
                      {member?.username || 'User'}
                      {memberId === user?.uid ? ' (you)' : ''}
                    </p>
                    <p className="text-xs text-white/45">
                      {owner ? 'Owner' : admin ? 'Admin' : 'Member'}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {!isMember && chat.settings?.joinViaButton && (
        <div className="mx-6 mt-6">
          <button
            type="button"
            onClick={handleJoin}
            disabled={joining}
            className="w-full flex items-center justify-center gap-2 py-3 bg-blue-500 hover:bg-blue-600 rounded-full transition-colors font-medium"
          >
            {joining ? 'Joining…' : 'Join group chat'}
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
    </>
  )
}
