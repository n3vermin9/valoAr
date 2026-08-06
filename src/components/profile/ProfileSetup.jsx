import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { IconInfoCircle } from '@tabler/icons-react'
import { useAuth } from '../../contexts/AuthContext'
import { createUserProfile } from '../../services/userService'
import { useUsernameCheck } from '../../hooks/useUsernameCheck'
import { APP_AGE_MAX, APP_AGE_MIN, normalizeUsername } from '../../utils/helpers'
import { createSanitizedChangeHandler } from '../../utils/inputHelpers'
import AppTextInput from '../ui/AppTextInput'
import AgeSlider from './AgeSlider'
import PhotoUrlSection from './PhotoUrlSection'
import CitySelect from './CitySelect'
import HobbiesSelect from './HobbiesSelect'
import Modal from '../ui/Modal'
import FieldHint from '../ui/FieldHint'
import LoadingSpinner from '../ui/LoadingSpinner'
import Button from '../ui/Button'
import SubpageShell from '../layout/SubpageShell'
import { typoSubheadClass, typoTitle3Class } from '../../utils/designSystem'
import { DEFAULT_CITY_ID, normalizeCity, normalizeHobbies } from '../../utils/profileOptions'

export default function ProfileSetup() {
  const { user, refreshProfile, logout } = useAuth()
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [age, setAge] = useState(18)
  const [gender, setGender] = useState('')
  const [interestedIn, setInterestedIn] = useState('')
  const [city, setCity] = useState(DEFAULT_CITY_ID)
  const [hobbies, setHobbies] = useState([])
  const [bio, setBio] = useState('')
  const [photos, setPhotos] = useState(['', '', ''])
  const [visiblePhotoSlots, setVisiblePhotoSlots] = useState(1)
  const [showBothInfo, setShowBothInfo] = useState(false)
  const [showGenderConfirm, setShowGenderConfirm] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!user) navigate('/login', { replace: true })
  }, [user, navigate])

  const { status, error: usernameError } = useUsernameCheck(username, user?.uid)

  const canSubmit =
    status === 'available' &&
    photos[0].trim() !== '' &&
    gender !== '' &&
    interestedIn !== '' &&
    Boolean(city) &&
    age >= APP_AGE_MIN &&
    age <= APP_AGE_MAX

  const usernameBorder =
    status === 'available'
      ? 'border-green-500'
      : status === 'taken' || status === 'invalid'
        ? 'border-red-500'
        : 'border-[var(--ios-hairline)]'

  const updatePhoto = (index, value) => {
    const next = [...photos]
    next[index] = value
    setPhotos(next)
  }

  const handleBack = async () => {
    await logout()
    navigate('/login', { replace: true })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!canSubmit) {
      toast.error('Please fill in username, photo, gender, interested in, and age')
      return
    }

    setShowGenderConfirm(true)
  }

  const confirmAndSave = async () => {
    setShowGenderConfirm(false)
    setLoading(true)
    try {
      await createUserProfile(user.uid, {
        email: user.email,
        username: normalizeUsername(username),
        age,
        gender,
        interestedIn,
        city: normalizeCity(city),
        hobbies: normalizeHobbies(hobbies),
        bio,
        photos: photos.filter(Boolean),
      })
      await refreshProfile()
      toast.success('Profile created!')
      navigate('/discover')
    } catch (err) {
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <SubpageShell
      title="Set up your profile"
      onBack={handleBack}
      footer={
        <Button type="submit" form="profile-setup-form" fullWidth disabled={loading || !canSubmit}>
          {loading ? <LoadingSpinner size="w-5 h-5" /> : 'Complete Profile'}
        </Button>
      }
    >
      <p className={`${typoSubheadClass} px-[var(--ios-page-x-lg)] mb-6`}>Tell us about yourself</p>

      <form id="profile-setup-form" onSubmit={handleSubmit} className="px-[var(--ios-page-x-lg)] space-y-6">
        <PhotoUrlSection
          photos={photos}
          updatePhoto={updatePhoto}
          visiblePhotoSlots={visiblePhotoSlots}
          setVisiblePhotoSlots={setVisiblePhotoSlots}
          showSamplePhotos
        />

        <div>
          <label className="text-sm text-[var(--ios-label-secondary)] mb-2 block">Username</label>
          <div className={`flex items-center bg-[var(--ios-fill-tertiary)] rounded-full border ${usernameBorder}`}>
            <span className="pl-4 pr-1 text-[var(--ios-label-secondary)]">@</span>
            <AppTextInput
              bare
              label="Username"
              value={username}
              onChange={createSanitizedChangeHandler(setUsername, normalizeUsername)}
              placeholder="username"
              maxLength={20}
              className="flex-1 px-1 py-3 bg-transparent"
            />
          </div>
          <FieldHint
            tone={
              usernameError ? 'error' : status === 'available' ? 'success' : 'neutral'
            }
          >
            {usernameError
              ? usernameError
              : status === 'available'
                ? 'This username is available'
                : status === 'checking'
                  ? 'Checking…'
                  : null}
          </FieldHint>
        </div>

        <div>
          <label className="text-sm text-[var(--ios-label-secondary)] mb-2 block">Age</label>
          <AgeSlider value={age} onChange={setAge} />
        </div>

        <div>
          <label className="text-sm text-[var(--ios-label-secondary)] mb-2 block">Gender</label>
          <div className="flex gap-2">
            {[
              { value: 'male', label: 'Boy' },
              { value: 'female', label: 'Girl' },
            ].map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setGender(opt.value)}
                className={`flex-1 py-3 rounded-full transition-colors ${
                  gender === opt.value ? 'bg-blue-500' : 'bg-[var(--ios-fill-tertiary)] hover:bg-[var(--ios-fill-secondary)]'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <p className="text-xs text-[var(--ios-label-tertiary)] mt-2">Gender cannot be changed after saving</p>
        </div>

        <div>
          <label className="text-sm text-[var(--ios-label-secondary)] mb-2 block">City</label>
          <CitySelect value={city} onChange={setCity} />
        </div>

        <div>
          <label className="text-sm text-[var(--ios-label-secondary)] mb-2 block flex items-center gap-1">
            Interested In
            <button type="button" onClick={() => setShowBothInfo(true)}>
              <IconInfoCircle size={16} className="text-[var(--ios-label-tertiary)]" />
            </button>
          </label>
          <div className="flex gap-2">
            {[
              { value: 'men', label: 'Men' },
              { value: 'women', label: 'Women' },
              { value: 'both', label: 'Both' },
            ].map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setInterestedIn(opt.value)}
                className={`flex-1 py-3 rounded-full transition-colors ${
                  interestedIn === opt.value ? 'bg-blue-500' : 'bg-[var(--ios-fill-tertiary)] hover:bg-[var(--ios-fill-secondary)]'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <HobbiesSelect value={hobbies} onChange={setHobbies} userId={user?.uid} />

        <div>
          <label className="text-sm text-[var(--ios-label-secondary)] mb-2 block">Bio</label>
          <AppTextInput
            label="Bio"
            layout="multiline"
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="Tell people about yourself..."
            maxLength={300}
            className="bg-[var(--ios-fill-tertiary)]"
          />
        </div>
      </form>

      <Modal isOpen={showBothInfo} onClose={() => setShowBothInfo(false)}>
        <div className="p-6">
          <h3 className={`${typoTitle3Class} mb-2`}>About "Both"</h3>
          <p className="text-[var(--ios-label-secondary)]">
            Selecting "Both" means you're open to meeting all kinds of people as friends.
            You'll see profiles of all genders that fit your other preferences.
          </p>
        </div>
      </Modal>

      <Modal isOpen={showGenderConfirm} onClose={() => setShowGenderConfirm(false)}>
        <div className="p-6">
          <h3 className={`${typoTitle3Class} mb-2`}>Confirm Gender</h3>
          <p className="text-[var(--ios-label-secondary)] mb-6">
            Your gender will be set to <span className="font-medium text-[var(--ios-label)]">{gender === 'male' ? 'Boy' : 'Girl'}</span> and
            cannot be changed later. Are you sure?
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => setShowGenderConfirm(false)}
              className="flex-1 py-3 bg-[var(--ios-fill-tertiary)] rounded-full"
            >
              Go Back
            </button>
            <button onClick={confirmAndSave} className="flex-1 py-3 bg-blue-500 rounded-full">
              Confirm
            </button>
          </div>
        </div>
      </Modal>
    </SubpageShell>
  )
}
