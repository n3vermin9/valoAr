import { useState, useEffect } from 'react'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import toast from 'react-hot-toast'
import {
  setGroupMemberRole,
  updateAdminPermissions,
  setAdminTag,
} from '../../../services/groupChatService'
import {
  DEFAULT_ADMIN_PERMISSIONS,
  getGroupMemberRole,
  isGroupOwner,
} from '../../../utils/groupChat'
import CachedAvatar from '../../ui/CachedAvatar'
import UsernameLabel from '../../ui/UsernameLabel'
import GroupRoleBadge from '../GroupRoleBadge'
import ConfirmDialog from '../../ui/ConfirmDialog'
import LoadingSpinner from '../../ui/LoadingSpinner'
import TextField from '../../ui/TextField'
import { sad } from '../../../assets'
import { useGroupSettingsChat } from './useGroupSettingsChat'
import GroupSettingsShell from './GroupSettingsShell'
import { PERMISSION_LABELS } from './constants'
import { SettingSwitch, SettingsSection } from '../../ui/SettingsUI'
import { typoSubheadClass } from '../../../utils/designSystem'

export default function GroupSettingsMemberAdmin() {
  const { chatId, memberId } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const { chat, members, loading, isMember, canManageAdmins, isOwner, user } = useGroupSettingsChat(chatId)
  const [applying, setApplying] = useState(false)
  const [pendingAction, setPendingAction] = useState(null)
  const [tagDraft, setTagDraft] = useState('')
  const [savingTag, setSavingTag] = useState(false)

  const member = members[memberId]
  const currentRole = chat ? getGroupMemberRole(chat, memberId) : 'member'
  const isAdmin = currentRole === 'admin'
  const editable = canManageAdmins && !isGroupOwner(chat, memberId) && memberId !== user?.uid
  const adminsPath = `/groups/${chatId}/settings/admins`

  const permissions =
    isAdmin && chat
      ? {
          ...DEFAULT_ADMIN_PERMISSIONS,
          ...(chat.adminSettings?.[memberId] || {}),
        }
      : null

  const confirmPromote = async () => {
    setApplying(true)
    try {
      await setGroupMemberRole(chatId, user.uid, memberId, 'admin')
      toast.success('Member is now an admin')
      setPendingAction(null)
    } catch (err) {
      toast.error(err.message || 'Failed to promote member')
    } finally {
      setApplying(false)
    }
  }

  const confirmDemote = async () => {
    setApplying(true)
    try {
      await setGroupMemberRole(chatId, user.uid, memberId, 'member')
      toast.success('Admin access removed')
      setPendingAction(null)
      navigate(adminsPath, { replace: true, state: location.state })
    } catch (err) {
      toast.error(err.message || 'Failed to remove admin')
    } finally {
      setApplying(false)
    }
  }

  const handlePermissionChange = async (key, value) => {
    if (!isOwner || !permissions) return
    try {
      await updateAdminPermissions(chatId, user.uid, memberId, {
        ...permissions,
        [key]: value,
      })
      toast.success('Permissions updated')
    } catch (err) {
      toast.error(err.message || 'Failed to update permissions')
    }
  }

  const handleSaveTag = async () => {
    if (!isOwner || !isAdmin) return
    setSavingTag(true)
    try {
      await setAdminTag(chatId, user.uid, memberId, tagDraft)
      toast.success('Admin tag updated')
    } catch (err) {
      toast.error(err.message || 'Failed to update tag')
    } finally {
      setSavingTag(false)
    }
  }

  const storedTag = chat?.adminTags?.[memberId] || ''

  useEffect(() => {
    setTagDraft(storedTag)
  }, [storedTag])

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <LoadingSpinner />
      </div>
    )
  }

  if (!chat || !isMember || !canManageAdmins || !member) {
    return (
      <GroupSettingsShell title="Admin access" backTo={adminsPath}>
        <p className={`${typoSubheadClass} text-center mt-12 px-6`}>Member not found</p>
      </GroupSettingsShell>
    )
  }

  return (
    <GroupSettingsShell title="Admin access" backTo={adminsPath}>
      <div className="space-y-5 pb-24">
        <div className="px-[var(--ios-page-x-lg)] pt-2">
          <div className="flex items-center gap-4">
            <CachedAvatar
              src={member?.photos?.[0]}
              fallback={sad}
              size={56}
              alt=""
              className="w-14 h-14 rounded-full object-cover shrink-0"
            />
            <div className="min-w-0 flex-1">
              <UsernameLabel username={member?.username} badgeSize={14} truncate={false} />
              <div className="mt-1.5">
                <GroupRoleBadge chat={chat} userId={memberId} role={currentRole} />
              </div>
            </div>
          </div>
        </div>

        {editable ? (
          <>
            {!isAdmin ? (
              <SettingsSection>
                <button
                  type="button"
                  disabled={applying}
                  onClick={() => setPendingAction('promote')}
                  className="w-full px-4 py-4 text-left text-[17px] font-semibold text-[var(--ios-blue)] border-b border-white/10 last:border-b-0 disabled:opacity-50"
                >
                  Make admin
                </button>
              </SettingsSection>
            ) : (
              <>
                {isOwner && (
                  <SettingsSection title="Display tag">
                    <div className="px-4 py-4 space-y-3">
                      <TextField
                        value={tagDraft}
                        onChange={(e) => setTagDraft(e.target.value)}
                        placeholder="e.g. Moderator, Co-founder"
                        maxLength={32}
                      />
                      <button
                        type="button"
                        onClick={handleSaveTag}
                        disabled={savingTag}
                        className="text-[15px] font-medium text-[var(--ios-blue)] disabled:opacity-50"
                      >
                        {savingTag ? 'Saving…' : 'Save tag'}
                      </button>
                      <p className={`${typoSubheadClass} leading-snug`}>
                        Shown instead of &quot;Admin&quot; on messages and member lists. Leave empty for the default.
                      </p>
                    </div>
                  </SettingsSection>
                )}

                {isOwner && permissions && (
                  <SettingsSection title="What they can do">
                    {Object.entries(PERMISSION_LABELS).map(([key, label]) => (
                      <SettingSwitch
                        key={key}
                        label={label}
                        checked={permissions[key] === true}
                        onChange={(value) => handlePermissionChange(key, value)}
                      />
                    ))}
                  </SettingsSection>
                )}

                <SettingsSection title="Danger zone">
                  <button
                    type="button"
                    disabled={applying}
                    onClick={() => setPendingAction('demote')}
                    className="w-full px-4 py-4 text-left text-[17px] font-semibold text-red-400 border-b border-white/10 last:border-b-0 disabled:opacity-50"
                  >
                    Remove admin access
                  </button>
                </SettingsSection>
              </>
            )}
          </>
        ) : (
          <p className={`${typoSubheadClass} text-center px-6`}>
            {isGroupOwner(chat, memberId)
              ? 'The owner role cannot be changed.'
              : 'You cannot change your own admin access.'}
          </p>
        )}
      </div>

      <ConfirmDialog
        isOpen={pendingAction === 'promote'}
        onClose={() => !applying && setPendingAction(null)}
        onConfirm={confirmPromote}
        title="Make admin?"
        message={`${member?.username || 'This member'} will get admin access with default permissions you can customize.`}
        confirmLabel="Make admin"
        loading={applying}
      />

      <ConfirmDialog
        isOpen={pendingAction === 'demote'}
        onClose={() => !applying && setPendingAction(null)}
        onConfirm={confirmDemote}
        title="Remove admin access?"
        message={`${member?.username || 'This member'} will become a regular member.`}
        confirmLabel="Remove admin"
        danger
        loading={applying}
      />
    </GroupSettingsShell>
  )
}
