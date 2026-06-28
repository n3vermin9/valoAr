import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { IconCopy, IconLink, IconShield, IconLogout } from '@tabler/icons-react'
import { useAuth } from '../../contexts/AuthContext'
import { subscribeChat } from '../../services/chatService'
import { fetchUsersMap } from '../../services/userService'
import {
  updateGroupInfo,
  updateGroupSettings,
  updateAdminPermissions,
  addGroupAdmin,
  removeGroupAdmin,
  leaveGroupChat,
  regenerateInviteCode,
} from '../../services/groupChatService'
import {
  canAdmin,
  getGroupInviteUrl,
  isGroupAdmin,
  isGroupMember,
  isGroupOwner,
  DEFAULT_ADMIN_PERMISSIONS,
} from '../../utils/groupChat'
import { listRowClass } from '../../utils/designSystem'
import TextField from '../ui/TextField'
import Button from '../ui/Button'
import LoadingSpinner from '../ui/LoadingSpinner'
import CachedAvatar from '../ui/CachedAvatar'
import { sad } from '../../assets'

const PERMISSION_LABELS = {
  editGroupInfo: 'Edit group info',
  addMembers: 'Add members',
  removeMembers: 'Remove members',
  manageAdmins: 'Manage admins',
  manageInviteSettings: 'Manage invite settings',
}

function SettingSwitch({ label, description, checked, onChange, disabled }) {
  return (
    <div className="px-4 py-4 border-b border-white/10">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="font-medium">{label}</p>
          {description && <p className="text-sm text-white/50 mt-1">{description}</p>}
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={checked}
          disabled={disabled}
          onClick={() => onChange(!checked)}
          className={`relative w-12 h-7 rounded-full transition-colors shrink-0 disabled:opacity-50 ${
            checked ? 'bg-blue-500' : 'bg-white/20'
          }`}
        >
          <span
            className={`absolute top-1 left-1 w-5 h-5 rounded-full bg-white transition-transform ${
              checked ? 'translate-x-5' : ''
            }`}
          />
        </button>
      </div>
    </div>
  )
}

export default function EditGroupSettings() {
  const { chatId } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [chat, setChat] = useState(null)
  const [members, setMembers] = useState({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [selectedAdminId, setSelectedAdminId] = useState(null)

  useEffect(() => {
    if (!chatId) return
    return subscribeChat(chatId, (data) => {
      if (data?.type !== 'group') {
        setChat(null)
        setLoading(false)
        return
      }
      setChat(data)
      setName(data?.name || '')
      setDescription(data?.description || '')
      setLoading(false)
    })
  }, [chatId])

  useEffect(() => {
    if (!chat?.participants?.length) return
    fetchUsersMap(chat.participants).then(setMembers)
  }, [chat?.participants?.join(',')])

  const isMember = isGroupMember(chat, user?.uid)
  const canEditInfo = canAdmin(chat, user?.uid, 'editGroupInfo')
  const canManageSettings = canAdmin(chat, user?.uid, 'manageInviteSettings')
  const canManageAdmins = canAdmin(chat, user?.uid, 'manageAdmins')

  const handleCancel = () => {
    navigate(`/groups/${chatId}`)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!canEditInfo) return
    setSaving(true)
    try {
      await updateGroupInfo(chatId, user.uid, { name, description })
      toast.success('Group updated!')
      navigate(`/groups/${chatId}`)
    } catch (err) {
      toast.error(err.message || 'Failed to update group')
    } finally {
      setSaving(false)
    }
  }

  const handleSettingChange = async (key, value) => {
    try {
      await updateGroupSettings(chatId, user.uid, { [key]: value })
      toast.success('Settings updated')
    } catch (err) {
      toast.error(err.message || 'Failed to update settings')
    }
  }

  const handleCopyLink = async () => {
    if (!chat?.inviteCode) return
    try {
      await navigator.clipboard.writeText(getGroupInviteUrl(chat.inviteCode))
      toast.success('Invite link copied')
    } catch {
      toast.error('Failed to copy link')
    }
  }

  const handleRegenerateLink = async () => {
    try {
      await regenerateInviteCode(chatId, user.uid)
      toast.success('New invite link generated')
    } catch (err) {
      toast.error(err.message || 'Failed to regenerate link')
    }
  }

  const handleLeave = async () => {
    setSaving(true)
    try {
      await leaveGroupChat(chatId, user.uid)
      toast.success('Left group')
      navigate('/chats')
    } catch (err) {
      toast.error(err.message || 'Failed to leave group')
    } finally {
      setSaving(false)
    }
  }

  const handleToggleAdmin = async (memberId) => {
    try {
      if (chat.admins?.includes(memberId)) {
        await removeGroupAdmin(chatId, user.uid, memberId)
        toast.success('Admin removed')
      } else {
        await addGroupAdmin(chatId, user.uid, memberId)
        toast.success('Admin added')
      }
    } catch (err) {
      toast.error(err.message || 'Failed to update admin')
    }
  }

  const handlePermissionChange = async (targetId, key, value) => {
    const current = chat.adminSettings?.[targetId] || { ...DEFAULT_ADMIN_PERMISSIONS }
    try {
      await updateAdminPermissions(chatId, user.uid, targetId, {
        ...current,
        [key]: value,
      })
      toast.success('Admin permissions updated')
    } catch (err) {
      toast.error(err.message || 'Failed to update permissions')
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
      <div className="h-full overflow-y-auto pb-24 px-6 pt-6">
        <p className="text-center text-white/60 mt-12">You cannot edit this group</p>
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="mt-4 w-full py-3 bg-white/10 rounded-full"
        >
          Go back
        </button>
      </div>
    )
  }

  const selectedAdminPerms = selectedAdminId
    ? { ...DEFAULT_ADMIN_PERMISSIONS, ...(chat.adminSettings?.[selectedAdminId] || {}) }
    : null

  return (
    <div className="h-full overflow-y-auto pb-24">
      <div className="flex items-center justify-between px-6 pt-6 pb-4">
        <h1 className="text-xl font-bold">Edit Group</h1>
        <button
          type="button"
          onClick={handleCancel}
          className="text-blue-500 hover:text-blue-400 text-sm font-medium transition-colors"
        >
          Cancel
        </button>
      </div>

      <form onSubmit={handleSubmit} className="px-6 space-y-6 pb-4">
        {canEditInfo && (
          <>
            <div>
              <label className="text-sm text-white/60 mb-2 block">Group name</label>
              <TextField
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Group name"
                maxLength={64}
              />
            </div>
            <div>
              <label className="text-sm text-white/60 mb-2 block">Description</label>
              <TextField
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What's this group about?"
                maxLength={280}
              />
            </div>
          </>
        )}

        {canManageSettings && (
          <div className="rounded-2xl border border-white/10 overflow-hidden bg-white/[0.03]">
            <p className="px-4 pt-4 pb-2 text-xs uppercase tracking-wider text-white/40">Join settings</p>
            <SettingSwitch
              label="Allow join via link"
              description="Anyone with the invite link can join"
              checked={chat.settings?.joinViaLink !== false}
              onChange={(value) => handleSettingChange('joinViaLink', value)}
            />
            <SettingSwitch
              label="Allow join via button"
              description="Show a join button on the group info page"
              checked={chat.settings?.joinViaButton !== false}
              onChange={(value) => handleSettingChange('joinViaButton', value)}
            />
            <SettingSwitch
              label="Public group"
              description="Discoverable in search (private groups are hidden)"
              checked={chat.settings?.visibility === 'public'}
              onChange={(value) => handleSettingChange('visibility', value ? 'public' : 'private')}
            />
            <div className="px-4 py-4 border-b border-white/10">
              <div className="flex items-center gap-2 text-white/70 text-sm mb-2">
                <IconLink size={16} />
                Invite link
              </div>
              <p className="text-xs text-white/45 break-all mb-3">{getGroupInviteUrl(chat.inviteCode)}</p>
              <div className="flex gap-2">
                <Button type="button" variant="bordered" className="flex-1" onClick={handleCopyLink}>
                  <IconCopy size={16} className="inline mr-1.5 -mt-0.5" />
                  Copy
                </Button>
                <Button type="button" variant="bordered" className="flex-1" onClick={handleRegenerateLink}>
                  Regenerate
                </Button>
              </div>
            </div>
          </div>
        )}

        {canManageAdmins && (
          <div>
            <label className="text-sm text-white/60 mb-2 block">Admins</label>
            <div className="space-y-2">
              {(chat.participants || []).map((memberId) => {
                const member = members[memberId]
                const admin = isGroupAdmin(chat, memberId)
                const owner = isGroupOwner(chat, memberId)
                if (owner) return null
                return (
                  <div key={memberId} className={`${listRowClass} gap-3`}>
                    <CachedAvatar
                      src={member?.photos?.[0]}
                      fallback={sad}
                      size={36}
                      alt=""
                      className="w-9 h-9 rounded-full object-cover shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{member?.username || 'User'}</p>
                      <p className="text-xs text-white/50">{admin ? 'Admin' : 'Member'}</p>
                    </div>
                    {memberId !== user.uid && (
                      <>
                        <button
                          type="button"
                          onClick={() => handleToggleAdmin(memberId)}
                          className="text-xs text-blue-400 shrink-0"
                        >
                          {admin ? 'Remove admin' : 'Make admin'}
                        </button>
                        {admin && isGroupOwner(chat, user?.uid) && (
                          <button
                            type="button"
                            onClick={() =>
                              setSelectedAdminId(selectedAdminId === memberId ? null : memberId)
                            }
                            className="text-xs text-white/50 shrink-0"
                          >
                            Permissions
                          </button>
                        )}
                      </>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {selectedAdminId && selectedAdminPerms && isGroupOwner(chat, user?.uid) && (
          <div className="rounded-2xl border border-white/10 overflow-hidden bg-white/[0.03]">
            <p className="px-4 pt-4 pb-2 text-sm font-medium flex items-center gap-2">
              <IconShield size={16} />
              {members[selectedAdminId]?.username || 'User'} permissions
            </p>
            {Object.entries(PERMISSION_LABELS).map(([key, label]) => (
              <SettingSwitch
                key={key}
                label={label}
                checked={selectedAdminPerms[key] === true}
                onChange={(value) => handlePermissionChange(selectedAdminId, key, value)}
              />
            ))}
          </div>
        )}

        {canEditInfo && (
          <button
            type="submit"
            disabled={saving || !name.trim()}
            className="w-full py-3 bg-blue-500 hover:bg-blue-600 disabled:opacity-50 rounded-full font-medium transition-colors"
          >
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        )}

        <button
          type="button"
          onClick={handleLeave}
          disabled={saving}
          className="w-full flex items-center justify-center gap-2 py-3 text-red-400 hover:bg-red-500/10 rounded-full transition-colors"
        >
          <IconLogout size={18} />
          Leave group
        </button>
      </form>
    </div>
  )
}
