import { useState } from 'react'
import toast from 'react-hot-toast'
import { IconInfoCircle } from '@tabler/icons-react'
import { useAuth } from '../../contexts/AuthContext'
import { updateUserProfile } from '../../services/userService'
import { useUsernameCheck } from '../../hooks/useUsernameCheck'
import { normalizeUsername, formatGenderLabel } from '../../utils/helpers'
import AgeSlider from './AgeSlider'
import PhotoUrlSection from './PhotoUrlSection'
import Modal from '../ui/Modal'
import LoadingSpinner from '../ui/LoadingSpinner'

export default function EditProfile({ onCancel }) {
  const { user, profile, refreshProfile } = useAuth()
  const initialPhotos = profile?.photos?.concat(['', '', '']).slice(0, 3) || ['', '', '']
  const [username, setUsername] = useState(profile?.username || '')
  const [age, setAge] = useState(profile?.age || 25)
  const [interestedIn, setInterestedIn] = useState(profile?.interestedIn || '')
  const [bio, setBio] = useState(profile?.bio || '')
  const [photos, setPhotos] = useState(initialPhotos)
  const [visiblePhotoSlots, setVisiblePhotoSlots] = useState(
    Math.max(1, initialPhotos.filter(Boolean).length)
  )
  const [showBothInfo, setShowBothInfo] = useState(false)
  const [loading, setLoading] = useState(false)

  const usernameChanged = username !== profile?.username
  const { status, error: usernameError } = useUsernameCheck(username, user?.uid, usernameChanged)

  const filledPhotos = photos.filter(Boolean)
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
    <div className="h-full overflow-y-auto pb-24">
      <div className="flex items-center justify-between px-6 pt-6 pb-4">
        <h1 className="text-xl font-bold">Edit Profile</h1>
        <button
          onClick={onCancel}
          className="text-blue-500 hover:text-blue-400 text-sm font-medium transition-colors"
        >
          Cancel
        </button>
      </div>

      <form onSubmit={handleSubmit} className="px-6 space-y-6 pb-4">
        <PhotoUrlSection
          photos={photos}
          updatePhoto={updatePhoto}
          visiblePhotoSlots={visiblePhotoSlots}
          setVisiblePhotoSlots={setVisiblePhotoSlots}
        />

        <div>
          <label className="text-sm text-white/60 mb-2 block">Username</label>
          <div className={`flex items-center bg-white/10 rounded-full border ${usernameBorder}`}>
            <span className="pl-4 pr-1 text-white/60">@</span>
            <input
              value={username}
              onChange={(e) => setUsername(normalizeUsername(e.target.value))}
              className="flex-1 px-1 py-3 bg-transparent outline-none"
              maxLength={20}
            />
          </div>
          {usernameError && usernameChanged && (
            <p className="text-red-400 text-sm mt-1">{usernameError}</p>
          )}
          {!usernameError && usernameChanged && status === 'available' && (
            <p className="text-green-400 text-sm mt-1">This username is available</p>
          )}
          {usernameChanged && status === 'checking' && (
            <p className="text-white/50 text-sm mt-1">Checking availability...</p>
          )}
        </div>

        <div>
          <label className="text-sm text-white/60 mb-2 block">Age</label>
          <AgeSlider value={age} onChange={setAge} />
        </div>

        <div>
          <label className="text-sm text-white/60 mb-2 block">Gender</label>
          <div className="px-5 py-3 bg-white/5 rounded-full text-white/50">
            {formatGenderLabel(profile?.gender)} (locked)
          </div>
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
          {loading ? <LoadingSpinner size="w-5 h-5" /> : 'Save Changes'}
        </button>
      </form>

      <Modal isOpen={showBothInfo} onClose={() => setShowBothInfo(false)}>
        <div className="p-6">
          <h3 className="text-lg font-semibold mb-2">About "Both"</h3>
          <p className="text-white/70">
            Selecting "Both" means you're open to meeting all kinds of people as friends.
          </p>
        </div>
      </Modal>
    </div>
  )
}
