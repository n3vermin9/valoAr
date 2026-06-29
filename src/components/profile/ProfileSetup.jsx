import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { IconInfoCircle } from '@tabler/icons-react'
import { useAuth } from '../../contexts/AuthContext'
import { createUserProfile } from '../../services/userService'
import { useUsernameCheck } from '../../hooks/useUsernameCheck'
import { normalizeUsername } from '../../utils/helpers'
import AgeSlider from './AgeSlider'
import PhotoUrlSection from './PhotoUrlSection'
import Modal from '../ui/Modal'
import { pageTitleClass, typoSubheadClass, fieldLabelClass, btnFilledClass } from '../../utils/designSystem'

export default function ProfileSetup() {
  const { user, refreshProfile } = useAuth()
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [age, setAge] = useState(25)
  const [gender, setGender] = useState('')
  const [interestedIn, setInterestedIn] = useState('')
  const [bio, setBio] = useState('')
  const [photos, setPhotos] = useState(['', '', ''])
  const [visiblePhotoSlots, setVisiblePhotoSlots] = useState(1)
  const [showBothInfo, setShowBothInfo] = useState(false)
  const [showGenderConfirm, setShowGenderConfirm] = useState(false)
  const [loading, setLoading] = useState(false)

  const { status, error: usernameError } = useUsernameCheck(username, user?.uid)

  const filledPhotos = photos.filter(Boolean)
  const canSubmit =
    status === 'available' &&
    photos[0].trim() !== '' &&
    gender !== '' &&
    interestedIn !== '' &&
    age >= 18 &&
    age <= 40

  const usernameBorder =
    status === 'available'
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
    <div className="h-full overflow-y-auto pb-24">
      <div className="px-6 pt-8 pb-4">
        <h1 className={pageTitleClass}>Set up your profile</h1>
        <p className={`${typoSubheadClass} mt-1`}>Tell us about yourself</p>
      </div>

      <form onSubmit={handleSubmit} className="px-6 space-y-6">
        <PhotoUrlSection
          photos={photos}
          updatePhoto={updatePhoto}
          visiblePhotoSlots={visiblePhotoSlots}
          setVisiblePhotoSlots={setVisiblePhotoSlots}
          showSamplePhotos
        />

        <div>
          <label className="text-sm text-white/60 mb-2 block">Username</label>
          <div className={`flex items-center bg-white/10 rounded-full border ${usernameBorder}`}>
            <span className="pl-4 pr-1 text-white/60">@</span>
            <input
              value={username}
              onChange={(e) => setUsername(normalizeUsername(e.target.value))}
              placeholder="username"
              className="flex-1 px-1 py-3 bg-transparent outline-none"
              maxLength={20}
            />
          </div>
          {usernameError && <p className="text-red-400 text-sm mt-1">{usernameError}</p>}
          {!usernameError && status === 'available' && (
            <p className="text-green-400 text-sm mt-1">This username is available</p>
          )}
          {status === 'checking' && <p className="text-white/50 text-sm mt-1">Checking availability...</p>}
        </div>

        <div>
          <label className="text-sm text-white/60 mb-2 block">Age</label>
          <AgeSlider value={age} onChange={setAge} />
        </div>

        <div>
          <label className="text-sm text-white/60 mb-2 block">Gender</label>
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
                  gender === opt.value ? 'bg-blue-500' : 'bg-white/10 hover:bg-white/20'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <p className="text-xs text-white/40 mt-2">Gender cannot be changed after saving</p>
        </div>

        <div>
          <label className="text-sm text-white/60 mb-2 block flex items-center gap-1">
            Interested In
            <button type="button" onClick={() => setShowBothInfo(true)}>
              <IconInfoCircle size={16} className="text-white/40" />
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
                  interestedIn === opt.value ? 'bg-blue-500' : 'bg-white/10 hover:bg-white/20'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-sm text-white/60 mb-2 block">Bio</label>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="Tell people about yourself..."
            className="w-full px-5 py-3 bg-white/10 rounded-2xl border border-white/10 outline-none focus:border-blue-500 resize-none h-24"
            maxLength={300}
          />
        </div>

        <button
          type="submit"
          disabled={loading || !canSubmit}
          className="w-full py-3 bg-blue-500 hover:bg-blue-600 rounded-full font-medium disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? <LoadingSpinner size="w-5 h-5" /> : 'Complete Profile'}
        </button>
      </form>

      <Modal isOpen={showBothInfo} onClose={() => setShowBothInfo(false)}>
        <div className="p-6">
          <h3 className="text-lg font-semibold mb-2">About "Both"</h3>
          <p className="text-white/70">
            Selecting "Both" means you're open to meeting all kinds of people as friends.
            You'll see profiles of all genders that fit your other preferences.
          </p>
        </div>
      </Modal>

      <Modal isOpen={showGenderConfirm} onClose={() => setShowGenderConfirm(false)}>
        <div className="p-6">
          <h3 className="text-lg font-semibold mb-2">Confirm Gender</h3>
          <p className="text-white/70 mb-6">
            Your gender will be set to <span className="font-medium text-white">{gender === 'male' ? 'Boy' : 'Girl'}</span> and
            cannot be changed later. Are you sure?
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => setShowGenderConfirm(false)}
              className="flex-1 py-3 bg-white/10 rounded-full"
            >
              Go Back
            </button>
            <button onClick={confirmAndSave} className="flex-1 py-3 bg-blue-500 rounded-full">
              Confirm
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
