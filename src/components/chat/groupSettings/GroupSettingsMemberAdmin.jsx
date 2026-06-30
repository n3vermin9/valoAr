import { useState, useEffect } from 'react'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import { IconShield, IconShieldOff, IconCrown } from '@tabler/icons-react'
import {
  setGroupMemberRole,
  updateAdminPermissions,
  setAdminTag,
  transferGroupOwnership,
} from '../../../services/groupChatService'
import {
  DEFAULT_ADMIN_PERMISSIONS,
  getGroupMemberRole,
  hasFullAdminPermissions,
  isGroupOwner,
} from '../../../utils/groupChat'
import CachedAvatar from '../../ui/CachedAvatar'
import UsernameLabel from '../../ui/UsernameLabel'
import GroupRoleBadge from '../GroupRoleBadge'
import LoadingSpinner from '../../ui/LoadingSpinner'
import TextField from '../../ui/TextField'
import Button from '../../ui/Button'
import { sad } from '../../../assets'
import { useGroupSettingsChat } from './useGroupSettingsChat'
import GroupSettingsShell from './GroupSettingsShell'
import { PERMISSION_LABELS } from './constants'
import { SettingSwitch, SettingsNavRow, SettingsSection } from '../../ui/SettingsUI'
import { dangerLinkActionClass, linkActionClass, typoSubheadClass } from '../../../utils/designSystem'

const PENDING_ACTIONS = {
  promote: { label: 'Make admin', danger: false },
  demote: { label: 'Remove', danger: true },
  transfer: { label: 'Transfer', danger: true },
}

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

  const allPermissionsGranted = isOwner && hasFullAdminPermissions(permissions)
  const pendingMeta = pendingAction ? PENDING_ACTIONS[pendingAction] : null

  const confirmPromote = async () => {
    setApplying(true)
    try {
      await setGroupMemberRole(chatId, user.uid, memberId, 'admin')
      setPendingAction(null)
    } catch {
      setPendingAction(null)
    } finally {
      setApplying(false)
    }
  }

  const confirmDemote = async () => {
    setApplying(true)
    try {
      await setGroupMemberRole(chatId, user.uid, memberId, 'member')
      setPendingAction(null)
      navigate(adminsPath, { replace: true, state: location.state })
    } catch {
      setPendingAction(null)
    } finally {
      setApplying(false)
    }
  }

  const confirmTransfer = async () => {
    setApplying(true)
    try {
      await transferGroupOwnership(chatId, user.uid, memberId)
      setPendingAction(null)
      navigate(adminsPath, { replace: true, state: location.state })
    } catch {
      setPendingAction(null)
    } finally {
      setApplying(false)
    }
  }

  const runPendingAction = () => {
    if (pendingAction === 'promote') confirmPromote()
    else if (pendingAction === 'demote') confirmDemote()
    else if (pendingAction === 'transfer') confirmTransfer()
  }

  const handleHeaderBack = () => {
    if (pendingAction) {
      setPendingAction(null)
      return
    }
    navigate(adminsPath, { replace: true, state: location.state })
  }

  const handlePermissionChange = async (key, value) => {
    if (!isOwner || !permissions) return
    try {
      await updateAdminPermissions(chatId, user.uid, memberId, {
        ...permissions,
        [key]: value,
      })
    } catch {
      // UI reflects live data from subscription; avoid noisy toasts for toggles.
    }
  }

  const handleSaveTag = async () => {
    if (!isOwner || !isAdmin || savingTag) return
    const trimmed = tagDraft.trim()
    if (trimmed === (chat?.adminTags?.[memberId] || '')) return
    setSavingTag(true)
    try {
      await setAdminTag(chatId, user.uid, memberId, tagDraft)
    } catch {
      // Tag field keeps draft; subscription will restore on failure.
    } finally {
      setSavingTag(false)
    }
  }

  const storedTag = chat?.adminTags?.[memberId] || ''

  useEffect(() => {
    setTagDraft(storedTag)
  }, [storedTag])

  const headerTrailing = pendingMeta ? (
    <button
      type="button"
      onClick={runPendingAction}
      disabled={applying}
      className={pendingMeta.danger ? dangerLinkActionClass : linkActionClass}
    >
      {applying ? '…' : pendingMeta.label}
    </button>
  ) : null

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <LoadingSpinner />
      </div>
    )
  }

  if (!chat || !isMember || !canManageAdmins || !member) {
    return (
      <GroupSettingsShell title="Admin access" onBack={handleHeaderBack} trailing={headerTrailing}>
        <p className={`${typoSubheadClass} text-center mt-12 px-6`}>Member not found</p>
      </GroupSettingsShell>
    )
  }

  return (
    <GroupSettingsShell title="Admin access" onBack={handleHeaderBack} trailing={headerTrailing}>
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
              pendingAction === 'promote' ? null : (
              <div className="px-[var(--ios-page-x-lg)]">
                <Button fullWidth onClick={() => setPendingAction('promote')} disabled={applying}>
                  <span className="inline-flex items-center justify-center gap-2">
                    <IconShield size={18} stroke={1.75} />
                    Make admin
                  </span>
                </Button>
              </div>
              )
            ) : (
              <>
                {isOwner && (
                  <SettingsSection title="Display tag">
                    <div className="px-4 py-4">
                      <TextField
                        value={tagDraft}
                        onChange={(e) => setTagDraft(e.target.value)}
                        onBlur={handleSaveTag}
                        placeholder="Moderator, Co-founder…"
                        maxLength={32}
                      />
                    </div>
                  </SettingsSection>
                )}

                {isOwner && permissions && (
                  <SettingsSection title="Permissions">
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

                {allPermissionsGranted && (
                  <SettingsSection>
                    <SettingsNavRow
                      icon={IconCrown}
                      iconTone="amber"
                      label="Transfer ownership"
                      onClick={() => setPendingAction('transfer')}
                      trailing={null}
                    />
                  </SettingsSection>
                )}

                <SettingsSection title="Danger zone">
                  <SettingsNavRow
                    icon={IconShieldOff}
                    iconTone="red"
                    danger
                    label="Remove as admin"
                    onClick={() => setPendingAction('demote')}
                    disabled={applying}
                    trailing={null}
                  />
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
    </GroupSettingsShell>
  )
}
