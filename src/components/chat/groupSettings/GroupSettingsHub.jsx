import { IconEdit, IconLink, IconShield, IconLogout, IconTrash } from '@tabler/icons-react'
import { useState } from 'react'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import toast from 'react-hot-toast'
import { leaveGroupChat, deleteGroupChat } from '../../../services/groupChatService'
import { cancelMeetup } from '../../../services/meetupService'
import { getGroupDisplayName, getGroupMemberRole } from '../../../utils/groupChat'
import GroupAvatar from '../GroupAvatar'
import LoadingSpinner from '../../ui/LoadingSpinner'
import ConfirmDialog from '../../ui/ConfirmDialog'
import PhotoGallery from '../../ui/PhotoGallery'
import { useGroupSettingsChat } from './useGroupSettingsChat'
import GroupSettingsShell from './GroupSettingsShell'
import { SettingsNavRow, SettingsSection } from '../../ui/SettingsUI'
import {
  typoTitle2Class,
  typoBodyClass,
  typoSubheadClass,
  insetCardOuterClass,
  btnBorderedClass,
} from '../../../utils/designSystem'

function PreviewInfoRow({ label, value }) {
  return (
    <div className="flex justify-between px-4 pb-4 pt-3 border-t border-white/10 text-xs text-white/40">
      <span>{label}</span>
      <span className="text-white/50">{value}</span>
    </div>
  )
}

function GroupInfoPreview({ chat }) {
  const [galleryOpen, setGalleryOpen] = useState(false)
  const description = chat.description?.trim() || 'No description yet'
  const hasPhoto = Boolean(chat.photoUrl?.trim())
  const memberSince = chat.createdAt?.toDate?.()
    ? chat.createdAt.toDate().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    : 'Recently'

  return (
    <section>
      <div className="flex flex-col items-center px-6 pt-4">
        <button
          type="button"
          onClick={() => setGalleryOpen(true)}
          disabled={!hasPhoto}
          className="relative shrink-0 rounded-full border border-dashed border-white/35 p-[7px] disabled:cursor-default focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60"
          aria-label={hasPhoto ? 'View group photo' : 'No group photo'}
        >
          <GroupAvatar photoUrl={chat.photoUrl} size={128} />
        </button>
        {hasPhoto ? (
          <button
            type="button"
            onClick={() => setGalleryOpen(true)}
            className={`${typoSubheadClass} mt-2 hover:text-white transition-colors`}
          >
            View photos
          </button>
        ) : (
          <span className={`${typoSubheadClass} mt-2`}>No photos yet</span>
        )}
        <h2 className={`${typoTitle2Class} mt-4 text-center break-words`}>{getGroupDisplayName(chat)}</h2>
      </div>

      <div className={`${insetCardOuterClass} mt-6 min-w-0`}>
        <div className="p-4 min-w-0 space-y-3">
          <p className={`${typoSubheadClass} break-words`}>
            {chat.username ? `@${chat.username}` : 'No username set'}
          </p>
          <p className={`${typoBodyClass} text-white/90 break-words whitespace-pre-wrap`}>{description}</p>
        </div>
        <PreviewInfoRow label="Member Since" value={memberSince} />
      </div>

      {galleryOpen && hasPhoto ? (
        <PhotoGallery photos={[chat.photoUrl]} onClose={() => setGalleryOpen(false)} />
      ) : null}
    </section>
  )
}

export default function GroupSettingsHub() {
  const { chatId } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const { chat, loading, isMember, canEditInfo, canManageSettings, canManageAdmins, isOwner, user } =
    useGroupSettingsChat(chatId)
  const [saving, setSaving] = useState(false)
  const [confirmDeleteGroup, setConfirmDeleteGroup] = useState(false)
  const [confirmLeaveGroup, setConfirmLeaveGroup] = useState(false)

  const base = `/groups/${chatId}/settings`
  const withState = (path) => navigate(path, { state: location.state })

  const adminCount =
    chat?.participants?.filter((id) => {
      const role = getGroupMemberRole(chat, id)
      return role === 'admin' || role === 'owner'
    }).length || 0

  const isMeetupChat = Boolean(chat?.isMeetup || chat?.meetupId)
  const isMeetupHost = isMeetupChat && chat?.createdBy === user?.uid

  const handleLeave = async () => {
    setSaving(true)
    try {
      if (isMeetupChat && chat?.meetupId) {
        await cancelMeetup(chat.meetupId, user.uid)
        toast.success(isMeetupHost ? 'Meetup cancelled' : 'Left meetup')
      } else {
        await leaveGroupChat(chatId, user.uid)
      }
      navigate('/chats')
    } catch (err) {
      toast.error(err.message || (isMeetupChat ? 'Failed to cancel meetup' : 'Failed to leave group'))
    } finally {
      setSaving(false)
      setConfirmLeaveGroup(false)
    }
  }

  const handleDeleteGroup = async () => {
    setSaving(true)
    try {
      await deleteGroupChat(chatId, user.uid)
      toast.success('Group deleted')
      navigate('/chats')
    } catch (err) {
      toast.error(err.message || 'Failed to delete group')
    } finally {
      setSaving(false)
      setConfirmDeleteGroup(false)
    }
  }

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <LoadingSpinner />
      </div>
    )
  }

  if (!chat || !isMember) {
    return (
      <GroupSettingsShell title="Group settings" backTo={`/groups/${chatId}`}>
        <p className="text-center text-white/60 mt-12 px-6">You cannot edit this group</p>
      </GroupSettingsShell>
    )
  }

  const hasSettingsRows = canManageSettings || canManageAdmins

  return (
    <GroupSettingsShell title="Group settings" backTo={`/groups/${chatId}`}>
      <div className="space-y-6 pb-24">
        <GroupInfoPreview chat={chat} />

        {canEditInfo ? (
          <div className="px-[var(--ios-page-x-lg)]">
            <button
              type="button"
              onClick={() => withState(`${base}/info`)}
              className={`${btnBorderedClass} w-full gap-2`}
            >
              <IconEdit size={18} stroke={1.75} />
              Edit group info
            </button>
          </div>
        ) : null}

        {hasSettingsRows ? (
          <SettingsSection>
            {canManageSettings && (
              <SettingsNavRow
                icon={IconLink}
                iconTone="green"
                label="Join & invite"
                onClick={() => withState(`${base}/join`)}
              />
            )}
            {canManageAdmins && (
              <SettingsNavRow
                icon={IconShield}
                iconTone="violet"
                label="Admins"
                value={String(adminCount)}
                onClick={() => withState(`${base}/admins`)}
              />
            )}
          </SettingsSection>
        ) : null}

        <SettingsSection>
          <SettingsNavRow
            icon={IconLogout}
            iconTone="red"
            danger
            label={isMeetupChat ? (isMeetupHost ? 'Cancel meetup' : 'Leave meetup') : 'Leave group'}
            onClick={() => setConfirmLeaveGroup(true)}
            disabled={saving}
            trailing={null}
          />
          {isOwner && (
            <SettingsNavRow
              icon={IconTrash}
              iconTone="red"
              danger
              label="Delete group"
              onClick={() => setConfirmDeleteGroup(true)}
              disabled={saving}
              trailing={null}
            />
          )}
        </SettingsSection>
      </div>

      <ConfirmDialog
        isOpen={confirmLeaveGroup}
        onClose={() => !saving && setConfirmLeaveGroup(false)}
        onConfirm={handleLeave}
        title={isMeetupChat ? (isMeetupHost ? 'Cancel meetup?' : 'Leave meetup?') : 'Leave group?'}
        message={
          isMeetupChat
            ? isMeetupHost
              ? 'This will end the meetup for everyone and delete the group chat.'
              : 'You will leave this meetup and its group chat.'
            : 'You will leave this group. You can rejoin later if you have an invite link.'
        }
        confirmLabel={isMeetupChat ? (isMeetupHost ? 'Cancel meetup' : 'Leave meetup') : 'Leave group'}
        danger
        loading={saving}
      />

      <ConfirmDialog
        isOpen={confirmDeleteGroup}
        onClose={() => setConfirmDeleteGroup(false)}
        onConfirm={handleDeleteGroup}
        title="Delete group?"
        message="This permanently deletes the group and all messages for everyone. This cannot be undone."
        confirmLabel="Delete group"
        danger
        loading={saving}
      />
    </GroupSettingsShell>
  )
}
