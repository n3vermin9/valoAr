import { useState } from 'react'
import { useParams, useLocation, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { updateGroupInfo } from '../../../services/groupChatService'
import { normalizeUsername } from '../../../utils/helpers'
import { useGroupUsernameCheck } from '../../../hooks/useGroupUsernameCheck'
import LoadingSpinner from '../../ui/LoadingSpinner'
import PhotoUrlSection from '../../profile/PhotoUrlSection'
import { SubpageHeaderBar } from '../../layout/SubpageShell'
import { useGroupSettingsChat } from './useGroupSettingsChat'
import { SettingsSection } from '../../ui/SettingsUI'
import {
  btnFilledClass,
  compactInputClass,
  compactTextareaClass,
  fieldLabelClass,
  typoSubheadClass,
} from '../../../utils/designSystem'

function GroupInfoEditor({ chat, chatId, user, locationState }) {
  const navigate = useNavigate()
  const [saving, setSaving] = useState(false)
  const [name, setName] = useState(chat.name || '')
  const [username, setUsername] = useState(chat.username || '')
  const [description, setDescription] = useState(chat.description || '')
  const [photos, setPhotos] = useState([chat.photoUrl || ''])

  const isPublic = chat.settings?.visibility === 'public'
  const normalizedUsername = normalizeUsername(username)
  const usernameChanged = normalizedUsername !== normalizeUsername(chat.username || '')
  const { status: usernameStatus, error: usernameError } = useGroupUsernameCheck(
    username,
    chatId,
    isPublic || usernameChanged
  )

  const usernameBorder =
    !usernameChanged
      ? 'border-white/10'
      : usernameStatus === 'available'
        ? 'border-green-500'
        : usernameStatus === 'taken' || usernameStatus === 'invalid'
          ? 'border-red-500'
          : 'border-white/10'

  const updatePhoto = (index, url) => {
    setPhotos((prev) => {
      const next = [...prev]
      next[index] = url
      return next
    })
  }

  const handleBack = () => {
    navigate(`/groups/${chatId}/settings`, { replace: true, state: locationState })
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
      handleBack()
    } catch (err) {
      toast.error(err.message || 'Failed to update group')
    } finally {
      setSaving(false)
    }
  }

  const canSubmit =
    name.trim() &&
    !saving &&
    !(isPublic && (!normalizedUsername || (usernameChanged && usernameStatus !== 'available')))

  return (
    <div className="h-full bg-black flex flex-col">
      <SubpageHeaderBar title="Edit group" onBack={handleBack} />

      <form
        id="group-info-form"
        onSubmit={handleSave}
        className="flex-1 overflow-y-auto pb-[calc(5.5rem+var(--ios-safe-bottom))]"
      >
        <div className="px-[var(--ios-page-x-lg)] py-5">
          <PhotoUrlSection
            photos={photos}
            updatePhoto={updatePhoto}
            visiblePhotoSlots={1}
            maxSlots={1}
            label="Group photo"
          />
        </div>

        <div className="space-y-5 pb-4">
          <SettingsSection title="Basics">
            <div className="px-4 py-3 border-b border-white/10">
              <label className={fieldLabelClass}>Group name</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Group name"
                maxLength={64}
                className={compactInputClass}
              />
            </div>
            <div className="px-4 py-3">
              <label className={fieldLabelClass}>
                Group username {isPublic ? '(required)' : '(required for public)'}
              </label>
              <div className={`flex items-center rounded-full border ${usernameBorder} ${compactInputClass} !px-0`}>
                <span className="pl-4 pr-1 text-[var(--ios-label-secondary)] text-[15px]">@</span>
                <input
                  value={username}
                  onChange={(e) => setUsername(normalizeUsername(e.target.value))}
                  placeholder="groupname"
                  maxLength={20}
                  className="flex-1 min-w-0 py-2.5 pr-4 bg-transparent outline-none text-[15px]"
                />
              </div>
              {isPublic && usernameError && usernameChanged && (
                <p className="text-red-400 text-[13px] mt-1.5">{usernameError}</p>
              )}
              {isPublic && !usernameError && usernameChanged && usernameStatus === 'available' && normalizedUsername && (
                <p className="text-green-400 text-[13px] mt-1.5">Available</p>
              )}
              {usernameChanged && usernameStatus === 'checking' && (
                <p className={`${typoSubheadClass} mt-1.5`}>Checking…</p>
              )}
            </div>
          </SettingsSection>

          <SettingsSection title="About">
            <div className="px-4 py-3">
              <label className={fieldLabelClass}>Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What's this group about?"
                rows={2}
                maxLength={280}
                className={compactTextareaClass}
              />
            </div>
          </SettingsSection>
        </div>
      </form>

      <div className="shrink-0 px-[var(--ios-page-x-lg)] pt-3 pb-[max(1rem,var(--ios-safe-bottom))] border-t border-white/10 bg-black/95 backdrop-blur-md">
        <button
          type="submit"
          form="group-info-form"
          disabled={!canSubmit}
          className={`${btnFilledClass} w-full`}
        >
          {saving ? 'Saving…' : 'Save changes'}
        </button>
      </div>
    </div>
  )
}

export default function GroupSettingsInfo() {
  const { chatId } = useParams()
  const location = useLocation()
  const navigate = useNavigate()
  const { chat, loading, isMember, canEditInfo, user } = useGroupSettingsChat(chatId)

  const handleBack = () => {
    navigate(`/groups/${chatId}/settings`, { replace: true, state: location.state })
  }

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center bg-black">
        <LoadingSpinner />
      </div>
    )
  }

  if (!chat || !isMember || !canEditInfo) {
    return (
      <div className="h-full bg-black flex flex-col">
        <SubpageHeaderBar title="Edit group" onBack={handleBack} />
        <p className="text-center text-white/60 mt-12 px-6">You cannot edit group info</p>
      </div>
    )
  }

  return (
    <GroupInfoEditor
      key={`${chat.id}-${chat.name}-${chat.username}-${chat.photoUrl}`}
      chat={chat}
      chatId={chatId}
      user={user}
      locationState={location.state}
    />
  )
}
