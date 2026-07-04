import { useState, useRef } from 'react'
import { useParams, useLocation, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'
import { updateGroupInfo } from '../../../services/groupChatService'
import { normalizeUsername } from '../../../utils/helpers'
import { createSanitizedChangeHandler, handleInputFocusCursor } from '../../../utils/inputHelpers'
import { useGroupUsernameCheck } from '../../../hooks/useGroupUsernameCheck'
import LoadingSpinner from '../../ui/LoadingSpinner'
import EditSaveBar from '../../ui/EditSaveBar'
import PhotoUrlSection from '../../profile/PhotoUrlSection'
import PhotoGallery from '../../ui/PhotoGallery'
import ChevronBack from '../../ui/ChevronBack'
import { useGroupSettingsChat } from './useGroupSettingsChat'
import { SettingsSection } from '../../ui/SettingsUI'
import {
  compactInputClass,
  compactInputAffixClass,
  compactInputInnerClass,
  fieldLabelClass,
  chatFloatingButtonClass,
  typoSubheadClass,
} from '../../../utils/designSystem'

function EditFieldSection({ children }) {
  return (
    <SettingsSection>
      <div className="px-4 py-4">{children}</div>
    </SettingsSection>
  )
}

function GroupInfoEditor({ chat, chatId, user, locationState }) {
  const navigate = useNavigate()
  const [saving, setSaving] = useState(false)
  const [name, setName] = useState(chat.name || '')
  const [username, setUsername] = useState(chat.username || '')
  const [description, setDescription] = useState(chat.description || '')
  const [photos, setPhotos] = useState([chat.photoUrl || ''])
  const [galleryOpen, setGalleryOpen] = useState(false)
  const [galleryInitialIndex, setGalleryInitialIndex] = useState(0)
  const heroSectionRef = useRef(null)

  const isPublic = chat.settings?.visibility === 'public'
  const normalizedUsername = normalizeUsername(username)
  const usernameChanged = normalizedUsername !== normalizeUsername(chat.username || '')
  const { status: usernameStatus, error: usernameError } = useGroupUsernameCheck(
    username,
    chatId,
    isPublic || usernameChanged
  )

  const hasChanges =
    name !== (chat.name || '') ||
    normalizedUsername !== normalizeUsername(chat.username || '') ||
    description !== (chat.description || '') ||
    (photos[0] || '') !== (chat.photoUrl || '')

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

  const openGallery = (index = 0) => {
    setGalleryInitialIndex(index)
    setGalleryOpen(true)
  }

  const handleBack = () => {
    navigate(`/groups/${chatId}/settings`, { replace: true, state: locationState })
  }

  const handleSave = async (e) => {
    e.preventDefault()
    if (!hasChanges) return
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
      <form
        id="group-info-form"
        onSubmit={handleSave}
        className={`flex-1 overflow-y-auto ${
          hasChanges ? 'pb-[calc(5.5rem+var(--ios-safe-bottom))]' : 'pb-[max(1rem,var(--ios-safe-bottom))]'
        }`}
      >
        <div className="relative">
          <div className="absolute top-[max(0.75rem,var(--ios-safe-top))] left-[var(--ios-page-x-lg)] z-30">
            <ChevronBack
              onClick={handleBack}
              buttonClassName={`${chatFloatingButtonClass} text-white/80`}
              className="w-6 h-6"
            />
          </div>
          <PhotoUrlSection
            variant="hero"
            photos={photos}
            updatePhoto={updatePhoto}
            visiblePhotoSlots={1}
            maxSlots={1}
            heroRef={heroSectionRef}
            onOpenGallery={openGallery}
          />
        </div>

        <motion.div
          layout
          animate={{
            marginTop: '-3.5rem',
            paddingTop: '2rem',
          }}
          transition={{
            layout: { type: 'spring', stiffness: 420, damping: 36 },
            marginTop: { type: 'spring', stiffness: 420, damping: 36 },
            paddingTop: { type: 'spring', stiffness: 420, damping: 36 },
          }}
          className="relative z-10 bg-gradient-to-b from-transparent via-black/95 to-black"
        >
          <div className="space-y-4 pb-4">
            <EditFieldSection>
              <label className={fieldLabelClass}>Group name</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                onFocus={handleInputFocusCursor}
                placeholder="Group name"
                maxLength={64}
                className={compactInputClass}
              />
            </EditFieldSection>

            <EditFieldSection>
              <label className={fieldLabelClass}>
                Group username {isPublic ? '(required)' : '(required for public)'}
              </label>
              <div className={`${compactInputAffixClass} border ${usernameBorder}`}>
                <span className="pl-4 pr-1 text-[var(--ios-label-secondary)] text-[15px] leading-none">@</span>
                <input
                  value={username}
                  onChange={createSanitizedChangeHandler(setUsername, normalizeUsername)}
                  onFocus={handleInputFocusCursor}
                  placeholder="groupname"
                  maxLength={20}
                  className={compactInputInnerClass}
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

              <label className={`${fieldLabelClass} mt-4`}>Bio</label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                onFocus={handleInputFocusCursor}
                placeholder="What's this group about?"
                className={compactInputClass}
                maxLength={120}
              />
            </EditFieldSection>
          </div>
        </motion.div>
      </form>

      <EditSaveBar
        visible={hasChanges}
        formId="group-info-form"
        loading={saving}
        disabled={!canSubmit}
      />

      {galleryOpen && photos.some((url) => url.trim()) ? (
        <PhotoGallery
          photos={photos.filter(Boolean)}
          initialIndex={galleryInitialIndex}
          onClose={() => setGalleryOpen(false)}
        />
      ) : null}
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
        <div className="absolute top-[max(0.75rem,var(--ios-safe-top))] left-[var(--ios-page-x-lg)] z-30">
          <ChevronBack
            onClick={handleBack}
            buttonClassName={`${chatFloatingButtonClass} text-white/80`}
            className="w-6 h-6"
          />
        </div>
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
