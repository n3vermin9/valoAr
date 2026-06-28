import { useState, useEffect } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
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
import { normalizeUsername } from '../../utils/helpers'
import { useGroupUsernameCheck } from '../../hooks/useGroupUsernameCheck'
import TextField from '../ui/TextField'
import Button from '../ui/Button'
import LoadingSpinner from '../ui/LoadingSpinner'
import CachedAvatar from '../ui/CachedAvatar'
import PhotoUrlSection from '../profile/PhotoUrlSection'
import { sad } from '../../assets'

const PERMISSION_LABELS = {
  editGroupInfo: 'Edit group info',
  addMembers: 'Add members',
  removeMembers: 'Remove members',
  manageAdmins: 'Manage admins',
  manageInviteSettings: 'Manage invite settings',
}

function SettingsSection({ title, children, className = '' }) {
  return (
    <section className={className}>
      <p className="text-xs uppercase tracking-wider text-white/40 mb-2 px-1">{title}</p>
      <div className="rounded-2xl border border-white/10 overflow-hidden bg-white/[0.03]">
        {children}
      </div>
    </section>
  )
}

function SettingSwitch({ label, description, checked, onChange, disabled }) {
  return (
    <div className="px-4 py-4 border-b border-white/10 last:border-b-0">
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
  const location = useLocation()
  const { user } = useAuth()
  const [chat, setChat] = useState(null)
  const [members, setMembers] = useState({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [name, setName] = useState('')
  const [username, setUsername] = useState('')
  const [description, setDescription] = useState('')
  const [photos, setPhotos] = useState([''])
  const [visiblePhotoSlots, setVisiblePhotoSlots] = useState(1)
  const [selectedAdminId, setSelectedAdminId] = useState(null)

  const isPublic = chat?.settings?.visibility === 'public'
  const normalizedUsername = normalizeUsername(username)
  const usernameChanged = normalizedUsername !== normalizeUsername(chat?.username || '')
  const { status: usernameStatus, error: usernameError } = useGroupUsernameCheck(
    username,
    chatId,
    isPublic || usernameChanged
  )

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
      setUsername(data?.username || '')
      setDescription(data?.description || '')
      setPhotos([data?.photoUrl || ''])
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

  const updatePhoto = (index, url) => {
    setPhotos((prev) => {
      const next = [...prev]
      next[index] = url
      return next
    })
  }

  const handleCancel = () => {
    navigate(`/groups/${chatId}`, { state: location.state })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!canEditInfo) return
    if (isPublic && (!normalizedUsername || usernameStatus !== 'available')) {
      toast.error('Set a valid group username for public groups')
      return
    }
    setSaving(true)
    try {
      await updateGroupInfo(chatId, user.uid, {
        name,
        description,
        photoUrl: photos[0] || '',
        username: normalizedUsername,
      })
      toast.success('Group updated!')
      navigate(`/groups/${chatId}`, { state: location.state })
    } catch (err) {
      toast.error(err.message || 'Failed to update group')
    } finally {
      setSaving(false)
    }
  }

  const handleVisibilityChange = async (makePublic) => {
    if (makePublic) {
      if (!normalizedUsername) {
        toast.error('Set a group username before making the group public')
        return
      }
      if (usernameStatus !== 'available' && usernameChanged) {
        toast.error(usernameError || 'Choose a valid available username')
        return
      }
      if (usernameChanged) {
        try {
          await updateGroupInfo(chatId, user.uid, { username: normalizedUsername })
        } catch (err) {
          toast.error(err.message || 'Failed to save username')
          return
        }
      }
    }

    try {
      await updateGroupSettings(chatId, user.uid, { visibility: makePublic ? 'public' : 'private' })
      toast.success(makePublic ? 'Group is now public' : 'Group is now private')
    } catch (err) {
      toast.error(err.message || 'Failed to update settings')
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
          <SettingsSection title="Group info">
            <div className="px-4 py-4 border-b border-white/10">
              <PhotoUrlSection
                photos={photos}
                updatePhoto={updatePhoto}
                visiblePhotoSlots={visiblePhotoSlots}
                setVisiblePhotoSlots={setVisiblePhotoSlots}
              />
            </div>
            <div className="px-4 py-4 border-b border-white/10">
              <label className="text-sm text-white/60 mb-2 block">Group name</label>
              <TextField
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Group name"
                maxLength={64}
              />
            </div>
            <div className="px-4 py-4 border-b border-white/10">
              <label className="text-sm text-white/60 mb-2 block">
                Group username {isPublic ? '(required)' : '(required for public)'}
              </label>
              <div className="flex items-center bg-white/10 rounded-full border border-white/10 focus-within:border-blue-500">
                <span className="pl-4 pr-1 text-white/60">@</span>
                <input
                  value={username}
                  onChange={(e) => setUsername(normalizeUsername(e.target.value))}
                  placeholder="groupname"
                  maxLength={20}
                  className="flex-1 px-1 py-3 bg-transparent outline-none"
                />
              </div>
              {isPublic && usernameError && (
                <p className="text-red-400 text-sm mt-1">{usernameError}</p>
              )}
              {isPublic && !usernameError && usernameStatus === 'available' && normalizedUsername && (
                <p className="text-green-400 text-sm mt-1">This username is available</p>
              )}
            </div>
            <div className="px-4 py-4">
              <label className="text-sm text-white/60 mb-2 block">Description</label>
              <TextField
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What's this group about?"
                maxLength={280}
              />
            </div>
          </SettingsSection>
        )}

        {canManageSettings && (
          <SettingsSection title="Join settings">
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
              checked={isPublic}
              onChange={(value) => handleVisibilityChange(value)}
            />
            <div className="px-4 py-4">
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
          </SettingsSection>
        )}

        {canManageAdmins && (
          <SettingsSection title="Admins">
            <div className="px-4 py-4 space-y-2">
              {(chat.participants || []).map((memberId) => {
                const member = members[memberId]
                const admin = isGroupAdmin(chat, memberId)
                const owner = isGroupOwner(chat, memberId)
                if (owner) return null
                return (
                  <div key={memberId} className={`${listRowClass} gap-3 bg-transparent border-0 px-0`}>
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
          </SettingsSection>
        )}

        {selectedAdminId && selectedAdminPerms && isGroupOwner(chat, user?.uid) && (
          <SettingsSection title="Admin permissions">
            <p className="px-4 pt-4 pb-2 text-sm font-medium flex items-center gap-2 border-b border-white/10">
              <IconShield size={16} />
              {members[selectedAdminId]?.username || 'User'}
            </p>
            {Object.entries(PERMISSION_LABELS).map(([key, label]) => (
              <SettingSwitch
                key={key}
                label={label}
                checked={selectedAdminPerms[key] === true}
                onChange={(value) => handlePermissionChange(selectedAdminId, key, value)}
              />
            ))}
          </SettingsSection>
        )}

        {canEditInfo && (
          <button
            type="submit"
            disabled={saving || !name.trim() || (isPublic && (!normalizedUsername || (usernameChanged && usernameStatus !== 'available')))}
            className="w-full py-3 bg-blue-500 hover:bg-blue-600 disabled:opacity-50 rounded-full font-medium transition-colors"
          >
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        )}

        <SettingsSection title="Danger zone">
          <button
            type="button"
            onClick={handleLeave}
            disabled={saving}
            className="w-full flex items-center justify-center gap-2 py-4 text-red-400 hover:bg-red-500/10 transition-colors"
          >
            <IconLogout size={18} />
            Leave group
          </button>
        </SettingsSection>
      </form>
    </div>
  )
}
