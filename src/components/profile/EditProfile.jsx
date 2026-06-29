import { useState } from 'react'
import toast from 'react-hot-toast'
import { IconInfoCircle } from '@tabler/icons-react'
import { useAuth } from '../../contexts/AuthContext'
import { updateUserProfile } from '../../services/userService'
import { useUsernameCheck } from '../../hooks/useUsernameCheck'
import { normalizeUsername, formatGenderLabel } from '../../utils/helpers'
import { normalizeSocials } from '../../utils/socialLinks'
import AgeSlider from './AgeSlider'
import PhotoUrlSection from './PhotoUrlSection'
import SocialLinksEditor from './SocialLinksEditor'
import Modal from '../ui/Modal'
import { SubpageHeaderBar } from '../layout/SubpageShell'
import { SettingsSection, RoleOptionButton } from '../ui/SettingsUI'
import {
  btnFilledClass,
  fieldLabelClass,
  textFieldClass,
  typoTitle3Class,
} from '../../utils/designSystem'

export default function EditProfile({ onCancel }) {
  const { user, profile, refreshProfile } = useAuth()
  const initialPhotos = profile?.photos?.concat(['', '', '']).slice(0, 3) || ['', '', '']
  const [username, setUsername] = useState(profile?.username || '')
  const [age, setAge] = useState(profile?.age || 25)
  const [interestedIn, setInterestedIn] = useState(profile?.interestedIn || '')
  const [bio, setBio] = useState(profile?.bio || '')
  const [socials, setSocials] = useState(() => normalizeSocials(profile?.socials))
  const [photos, setPhotos] = useState(initialPhotos)
  const [visiblePhotoSlots, setVisiblePhotoSlots] = useState(
    Math.max(1, initialPhotos.filter(Boolean).length)
  )
  const [showBothInfo, setShowBothInfo] = useState(false)
  const [loading, setLoading] = useState(false)

  const usernameChanged = username !== profile?.username
  const { status, error: usernameError } = useUsernameCheck(username, user?.uid, usernameChanged)

  const canSubmit =
    photos[0].trim() !== '' &&
    interestedIn !== '' &&
    age >= 18 &&
    age <= 40 &&
    (!usernameChanged || status === 'available')

  const usernameBorder =
    !usernameChanged
      ? 'border-white/10'
      : status === 'available'
        ? 'border-green-500'
        : status === 'taken' || status === 'invalid'
          ? 'border-red-500'
          : 'border-white/10'

  const updatePhoto = (index, value) => {
    const next = [...photos]
    next[index] = value
    setPhotos(next)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!canSubmit) {
      toast.error('Please fill in all required fields')
      return
    }

    setLoading(true)
    try {
      await updateUserProfile(
        user.uid,
        {
          username: normalizeUsername(username),
          age,
          interestedIn,
          bio,
          socials: normalizeSocials(socials),
          photos: photos.filter(Boolean),
        },
        profile.username
      )
      await refreshProfile()
      toast.success('Profile updated!')
      onCancel()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[70] bg-black flex flex-col">
      <SubpageHeaderBar title="Edit profile" onBack={onCancel} />

      <form
        id="edit-profile-form"
        onSubmit={handleSubmit}
        className="flex-1 overflow-y-auto pb-[calc(5.5rem+var(--ios-safe-bottom))]"
      >
        <div className="px-[var(--ios-page-x-lg)] py-5">
          <PhotoUrlSection
            photos={photos}
            updatePhoto={updatePhoto}
            visiblePhotoSlots={visiblePhotoSlots}
            setVisiblePhotoSlots={setVisiblePhotoSlots}
          />
        </div>

        <div className="space-y-5 pb-4">
          <SettingsSection title="Basics">
            <div className="px-4 py-4 border-b border-white/10">
              <label className={fieldLabelClass}>Username</label>
              <div className={`flex items-center rounded-full border ${usernameBorder} ${textFieldClass} !px-0`}>
                <span className="pl-5 pr-1 text-[var(--ios-label-secondary)]">@</span>
                <input
                  value={username}
                  onChange={(e) => setUsername(normalizeUsername(e.target.value))}
                  className="flex-1 min-w-0 py-3 pr-5 bg-transparent outline-none text-[17px]"
                  maxLength={20}
                />
              </div>
              {usernameError && usernameChanged && (
                <p className="text-red-400 text-[15px] mt-2">{usernameError}</p>
              )}
              {!usernameError && usernameChanged && status === 'available' && (
                <p className="text-green-400 text-[15px] mt-2">This username is available</p>
              )}
              {usernameChanged && status === 'checking' && (
                <p className="text-[var(--ios-label-secondary)] text-[15px] mt-2">Checking availability…</p>
              )}
            </div>
            <div className="px-4 py-4 border-b border-white/10">
              <label className={fieldLabelClass}>Age</label>
              <AgeSlider value={age} onChange={setAge} />
            </div>
            <div className="px-4 py-4">
              <label className={fieldLabelClass}>Gender</label>
              <div className="px-5 py-3 rounded-full bg-white/5 border border-white/10 text-[var(--ios-label-secondary)] text-[17px]">
                {formatGenderLabel(profile?.gender)} (locked)
              </div>
            </div>
          </SettingsSection>

          <SettingsSection title="Looking for">
            <div className="p-2 flex gap-1">
              {[
                { value: 'men', label: 'Men' },
                { value: 'women', label: 'Women' },
                { value: 'both', label: 'Both' },
              ].map((opt) => (
                <RoleOptionButton
                  key={opt.value}
                  label={opt.label}
                  selected={interestedIn === opt.value}
                  onClick={() => setInterestedIn(opt.value)}
                />
              ))}
            </div>
            <div className="px-4 pb-3 flex items-center gap-1.5">
              <button type="button" onClick={() => setShowBothInfo(true)} className="text-[var(--ios-label-secondary)]">
                <IconInfoCircle size={16} />
              </button>
              <span className="text-[13px] text-[var(--ios-label-secondary)]">What does “Both” mean?</span>
            </div>
          </SettingsSection>

          <SettingsSection title="About you">
            <div className="px-4 py-4">
              <label className={fieldLabelClass}>Bio</label>
              <textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Tell people about yourself…"
                className="w-full min-h-[120px] px-5 py-3 bg-[var(--ios-fill-tertiary)] rounded-[var(--ios-radius-xl)] border border-white/10 outline-none focus:border-[var(--ios-blue)] resize-none text-[17px] leading-relaxed"
                maxLength={300}
              />
            </div>
          </SettingsSection>

          <SettingsSection title="Links">
            <div className="px-4 py-4">
              <SocialLinksEditor socials={socials} onChange={setSocials} />
            </div>
          </SettingsSection>
        </div>
      </form>

      <div className="shrink-0 px-[var(--ios-page-x-lg)] pt-3 pb-[max(1rem,var(--ios-safe-bottom))] border-t border-white/10 bg-black/95 backdrop-blur-md">
        <button
          type="submit"
          form="edit-profile-form"
          disabled={!canSubmit || loading}
          className={`${btnFilledClass} w-full`}
        >
          {loading ? 'Saving…' : 'Save changes'}
        </button>
      </div>

      <Modal isOpen={showBothInfo} onClose={() => setShowBothInfo(false)}>
        <div className="p-6">
          <h3 className={`${typoTitle3Class} mb-2`}>About “Both”</h3>
          <p className="text-[var(--ios-label-secondary)] text-[15px] leading-relaxed">
            Selecting “Both” means you&apos;re open to meeting all kinds of people as friends.
          </p>
        </div>
      </Modal>
    </div>
  )
}
