import { IconEdit, IconLink, IconShield, IconLogout, IconTrash } from '@tabler/icons-react'
import { useState } from 'react'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import toast from 'react-hot-toast'
import { leaveGroupChat, deleteGroupChat } from '../../../services/groupChatService'
import { getGroupDisplayName, getGroupMemberRole } from '../../../utils/groupChat'
import GroupAvatar from '../GroupAvatar'
import LoadingSpinner from '../../ui/LoadingSpinner'
import ConfirmDialog from '../../ui/ConfirmDialog'
import { useGroupSettingsChat } from './useGroupSettingsChat'
import GroupSettingsShell from './GroupSettingsShell'
import { SettingsNavRow, SettingsSection } from '../../ui/SettingsUI'
import {
  typoTitle2Class,
  typoSubheadClass,
  typoBodyClass,
  insetCardClass,
  linkActionClass,
} from '../../../utils/designSystem'

function GroupInfoPreview({ chat, canEdit, onEdit }) {
  const description = chat.description?.trim() || 'No description yet'
  const memberCount = chat.participants?.length || 0

  return (
    <section className="mx-4 mb-6">
      <div className={insetCardClass}>
        <div className="p-5">
          <div className="flex items-start gap-4">
            <GroupAvatar photoUrl={chat.photoUrl} size={80} className="border-2 border-white/10 shrink-0" />
            <div className="flex-1 min-w-0 pt-1">
              <h2 className={`${typoTitle2Class} break-words`}>{getGroupDisplayName(chat)}</h2>
              {chat.username ? (
                <p className={`${typoSubheadClass} mt-1 break-words`}>@{chat.username}</p>
              ) : (
                <p className={`${typoSubheadClass} mt-1 italic opacity-70`}>No username set</p>
              )}
              <p className={`${typoSubheadClass} mt-2 opacity-80`}>
                {memberCount} member{memberCount === 1 ? '' : 's'}
              </p>
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-white/10">
            <p className={`${typoBodyClass} text-white/75 whitespace-pre-wrap break-words`}>
              {description}
            </p>
          </div>
        </div>
        {canEdit ? (
          <button
            type="button"
            onClick={onEdit}
            className={`w-full flex items-center justify-center gap-2 py-3.5 border-t border-white/10 ${linkActionClass} hover:bg-white/[0.04] active:bg-white/[0.08]`}
          >
            <IconEdit size={18} stroke={1.75} />
            Edit group info
          </button>
        ) : null}
      </div>
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

  const handleLeave = async () => {
    setSaving(true)
    try {
      await leaveGroupChat(chatId, user.uid)
      navigate('/chats')
    } catch (err) {
      toast.error(err.message || 'Failed to leave group')
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
        <GroupInfoPreview
          chat={chat}
          canEdit={canEditInfo}
          onEdit={() => withState(`${base}/info`)}
        />

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

        <SettingsSection title="Danger zone">
          <SettingsNavRow
            icon={IconLogout}
            iconTone="red"
            danger
            label="Leave group"
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
        title="Leave group?"
        message="You will leave this group. You can rejoin later if you have an invite link."
        confirmLabel="Leave group"
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
