import { useState } from 'react'
import { useParams, useLocation, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { updateGroupInfo } from '../../../services/groupChatService'
import { normalizeUsername } from '../../../utils/helpers'
import { useGroupUsernameCheck } from '../../../hooks/useGroupUsernameCheck'
import TextField from '../../ui/TextField'
import LoadingSpinner from '../../ui/LoadingSpinner'
import PhotoUrlSection from '../../profile/PhotoUrlSection'
import { useGroupSettingsChat } from './useGroupSettingsChat'
import GroupSettingsShell from './GroupSettingsShell'
import { SettingsSection } from '../../ui/SettingsUI'
import { btnFilledClass, fieldLabelClass } from '../../../utils/designSystem'

function GroupInfoForm({ chat, chatId, user, locationState }) {
  const navigate = useNavigate()
  const [saving, setSaving] = useState(false)
  const [name, setName] = useState(chat.name || '')
  const [username, setUsername] = useState(chat.username || '')
  const [description, setDescription] = useState(chat.description || '')
  const [photos, setPhotos] = useState([chat.photoUrl || ''])
  const [visiblePhotoSlots, setVisiblePhotoSlots] = useState(1)

  const isPublic = chat.settings?.visibility === 'public'
  const normalizedUsername = normalizeUsername(username)
  const usernameChanged = normalizedUsername !== normalizeUsername(chat.username || '')
  const { status: usernameStatus, error: usernameError } = useGroupUsernameCheck(
    username,
    chatId,
    isPublic || usernameChanged
  )

  const updatePhoto = (index, url) => {
    setPhotos((prev) => {
      const next = [...prev]
      next[index] = url
      return next
    })
  }

  const handleSave = async (e) => {
    e.preventDefault()
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
      toast.success('Group updated')
      navigate(`/groups/${chatId}/settings`, { replace: true, state: locationState })
    } catch (err) {
      toast.error(err.message || 'Failed to update group')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <form id="group-info-form" onSubmit={handleSave} className="px-2 space-y-6 pb-8">
        <SettingsSection>
          <div className="px-4 py-4 border-b border-white/10">
            <PhotoUrlSection
              photos={photos}
              updatePhoto={updatePhoto}
              visiblePhotoSlots={visiblePhotoSlots}
              setVisiblePhotoSlots={setVisiblePhotoSlots}
            />
          </div>
          <div className="px-4 py-4 border-b border-white/10">
            <label className={fieldLabelClass}>Group name</label>
            <TextField
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Group name"
              maxLength={64}
            />
          </div>
          <div className="px-4 py-4 border-b border-white/10">
            <label className={fieldLabelClass}>
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
            {isPublic && usernameError && <p className="text-red-400 text-sm mt-1">{usernameError}</p>}
            {isPublic && !usernameError && usernameStatus === 'available' && normalizedUsername && (
              <p className="text-green-400 text-sm mt-1">This username is available</p>
            )}
          </div>
          <div className="px-4 py-4">
            <label className={fieldLabelClass}>Description</label>
            <TextField
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What's this group about?"
              maxLength={280}
            />
          </div>
        </SettingsSection>
      </form>
      <div className="shrink-0 px-6 pb-[max(1.5rem,var(--ios-safe-bottom))]">
        <button
          type="submit"
          form="group-info-form"
          disabled={
            saving ||
            !name.trim() ||
            (isPublic && (!normalizedUsername || (usernameChanged && usernameStatus !== 'available')))
          }
          className="w-full py-3 bg-blue-500 hover:bg-blue-600 disabled:opacity-50 rounded-full font-medium transition-colors"
        >
          {saving ? 'Saving…' : 'Save changes'}
        </button>
      </div>
    </>
  )
}

export default function GroupSettingsInfo() {
  const { chatId } = useParams()
  const location = useLocation()
  const { chat, loading, isMember, canEditInfo, user } = useGroupSettingsChat(chatId)

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <LoadingSpinner />
      </div>
    )
  }

  if (!chat || !isMember || !canEditInfo) {
    return (
      <GroupSettingsShell title="Group info" backTo={`/groups/${chatId}/settings`}>
        <p className="text-center text-white/60 mt-12 px-6">You cannot edit group info</p>
      </GroupSettingsShell>
    )
  }

  return (
    <GroupSettingsShell title="Group info" backTo={`/groups/${chatId}/settings`}>
      <GroupInfoForm
        key={`${chat.id}-${chat.name}-${chat.username}-${chat.photoUrl}`}
        chat={chat}
        chatId={chatId}
        user={user}
        locationState={location.state}
      />
    </GroupSettingsShell>
  )
}
