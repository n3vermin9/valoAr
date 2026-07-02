import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import toast from 'react-hot-toast'
import { AnimatePresence, motion } from 'framer-motion'
import { useAuth } from '../../contexts/AuthContext'
import { updateUserProfile } from '../../services/userService'
import { useUsernameCheck } from '../../hooks/useUsernameCheck'
import { normalizeUsername, formatGenderLabel } from '../../utils/helpers'
import { normalizeSocials, SOCIAL_PLATFORMS } from '../../utils/socialLinks'
import { setProfileEditorOpen } from '../../utils/profileOverlay'
import AgeSlider from './AgeSlider'
import PhotoUrlSection, { getVisiblePhotoSlotCount, promotePhotoToPrimary } from './PhotoUrlSection'
import SocialLinksEditor from './SocialLinksEditor'
import EditSaveBar from '../ui/EditSaveBar'
import PhotoGallery from '../ui/PhotoGallery'
import ChevronBack from '../ui/ChevronBack'
import { SettingsSection, RoleOptionButton } from '../ui/SettingsUI'
import {
  fieldLabelClass,
  compactInputClass,
  compactInputAffixClass,
  compactInputInnerClass,
  navGlassClass,
  sectionLabelClass,
  chatFloatingButtonClass,
  typoSubheadClass,
} from '../../utils/designSystem'

function EditFieldSection({ children, compact = false }) {
  return (
    <SettingsSection>
      <div className={compact ? 'px-4 py-3' : 'px-4 py-4'}>{children}</div>
    </SettingsSection>
  )
}

export default function EditProfile({ onCancel }) {
  const { user, profile, refreshProfile } = useAuth()
  const initialPhotos = profile?.photos?.concat(['', '', '']).slice(0, 3) || ['', '', '']
  const initialSocials = useMemo(() => normalizeSocials(profile?.socials), [profile?.socials])

  const [username, setUsername] = useState(profile?.username || '')
  const [age, setAge] = useState(profile?.age || 25)
  const [interestedIn, setInterestedIn] = useState(profile?.interestedIn || '')
  const [bio, setBio] = useState(profile?.bio || '')
  const [socials, setSocials] = useState(() => normalizeSocials(profile?.socials))
  const [photos, setPhotos] = useState(initialPhotos)
  const [visiblePhotoSlots, setVisiblePhotoSlots] = useState(
    Math.max(1, initialPhotos.filter(Boolean).length)
  )
  const [loading, setLoading] = useState(false)
  const [activePhotoSlot, setActivePhotoSlot] = useState(null)
  const [galleryOpen, setGalleryOpen] = useState(false)
  const [galleryInitialIndex, setGalleryInitialIndex] = useState(0)
  const extraPhotoInputRef = useRef(null)
  const heroSectionRef = useRef(null)

  const showExtraPhotoInput =
    activePhotoSlot !== null && activePhotoSlot > 0 && !photos[activePhotoSlot]?.trim()

  const dismissExtraPhotoInput = useCallback(() => {
    setActivePhotoSlot(null)
    setVisiblePhotoSlots((current) => {
      const next = getVisiblePhotoSlotCount(photos)
      return Math.min(current, next)
    })
  }, [photos])

  useEffect(() => {
    if (!showExtraPhotoInput) return undefined

    const handlePointerDown = (event) => {
      if (extraPhotoInputRef.current?.contains(event.target)) return
      dismissExtraPhotoInput()
    }

    document.addEventListener('pointerdown', handlePointerDown)
    return () => document.removeEventListener('pointerdown', handlePointerDown)
  }, [showExtraPhotoInput, dismissExtraPhotoInput])

  useEffect(() => {
    if (activePhotoSlot === null) return
    if (photos[activePhotoSlot]?.trim()) setActivePhotoSlot(null)
  }, [photos, activePhotoSlot])

  useEffect(() => {
    setProfileEditorOpen(true)
    return () => setProfileEditorOpen(false)
  }, [])

  const usernameChanged = username !== profile?.username
  const { status, error: usernameError } = useUsernameCheck(username, user?.uid, usernameChanged)

  const currentPhotos = photos.filter(Boolean)
  const profilePhotos = profile?.photos || []
  const photosChanged =
    currentPhotos.length !== profilePhotos.length ||
    currentPhotos.some((photo, index) => photo !== profilePhotos[index])
  const socialsChanged = SOCIAL_PLATFORMS.some(({ id }) => socials[id] !== initialSocials[id])

  const hasChanges =
    username !== (profile?.username || '') ||
    age !== (profile?.age || 25) ||
    interestedIn !== (profile?.interestedIn || '') ||
    bio !== (profile?.bio || '') ||
    photosChanged ||
    socialsChanged

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
    const wasEmpty = !photos[index]?.trim()
    let next = [...photos]
    next[index] = value

    if (index > 0 && value.trim() && wasEmpty) {
      next = promotePhotoToPrimary(next, index)
      setVisiblePhotoSlots(getVisiblePhotoSlotCount(next))
    }

    setPhotos(next)
  }

  const openGallery = (index = 0) => {
    setGalleryInitialIndex(index)
    setGalleryOpen(true)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!canSubmit || !hasChanges) {
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
      <form
        id="edit-profile-form"
        onSubmit={handleSubmit}
        className={`flex-1 overflow-y-auto ${
          hasChanges ? 'pb-[calc(5.5rem+var(--ios-safe-bottom))]' : 'pb-[max(1rem,var(--ios-safe-bottom))]'
        }`}
      >
        <div className="relative">
          <div className="absolute top-[max(0.75rem,var(--ios-safe-top))] left-[var(--ios-page-x-lg)] z-30">
            <ChevronBack
              onClick={onCancel}
              buttonClassName={`${chatFloatingButtonClass} text-white/80`}
              className="w-6 h-6"
            />
          </div>
          <PhotoUrlSection
            variant="hero"
            photos={photos}
            updatePhoto={updatePhoto}
            visiblePhotoSlots={visiblePhotoSlots}
            setVisiblePhotoSlots={setVisiblePhotoSlots}
            activeSlot={activePhotoSlot}
            onActiveSlotChange={setActivePhotoSlot}
            heroRef={heroSectionRef}
            onOpenGallery={openGallery}
          />
        </div>

        <AnimatePresence initial={false}>
          {showExtraPhotoInput ? (
            <motion.div
              key={`extra-photo-${activePhotoSlot}`}
              ref={extraPhotoInputRef}
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 420, damping: 36 }}
              className="overflow-hidden bg-black"
            >
              <div className="px-[var(--ios-page-x-lg)] py-3">
                <input
                  autoFocus
                  value={photos[activePhotoSlot] || ''}
                  onChange={(e) => updatePhoto(activePhotoSlot, e.target.value)}
                  placeholder={`Photo ${activePhotoSlot + 1} URL`}
                  className={compactInputClass}
                />
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>

        <motion.div
          layout
          animate={{
            marginTop: showExtraPhotoInput ? '-1.5rem' : '-3.5rem',
            paddingTop: showExtraPhotoInput ? '1rem' : '2rem',
          }}
          transition={{ layout: { type: 'spring', stiffness: 420, damping: 36 }, marginTop: { type: 'spring', stiffness: 420, damping: 36 }, paddingTop: { type: 'spring', stiffness: 420, damping: 36 } }}
          className="relative z-10 bg-gradient-to-b from-transparent via-black/95 to-black"
        >
          <div className="space-y-4 pb-4">
          <EditFieldSection>
            <label className={fieldLabelClass}>Username</label>
            <div className={`${compactInputAffixClass} border ${usernameBorder}`}>
              <span className="pl-4 pr-1 text-[var(--ios-label-secondary)] text-[15px] leading-none">@</span>
              <input
                value={username}
                onChange={(e) => setUsername(normalizeUsername(e.target.value))}
                className={compactInputInnerClass}
                maxLength={20}
              />
            </div>
            {usernameError && usernameChanged && (
              <p className="text-red-400 text-[13px] mt-1.5">{usernameError}</p>
            )}
            {!usernameError && usernameChanged && status === 'available' && (
              <p className="text-green-400 text-[13px] mt-1.5">Available</p>
            )}
            {usernameChanged && status === 'checking' && (
              <p className={`${typoSubheadClass} mt-1.5`}>Checking…</p>
            )}

            <label className={`${fieldLabelClass} mt-4`}>Bio</label>
            <input
              type="text"
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Tell people about yourself…"
              className={compactInputClass}
              maxLength={120}
            />
          </EditFieldSection>

          <EditFieldSection compact>
            <AgeSlider value={age} onChange={setAge} />
          </EditFieldSection>

          <section>
            <p className={`${sectionLabelClass} normal-case`}>
              <span
                className={
                  profile?.gender === 'female'
                    ? 'text-pink-400'
                    : profile?.gender === 'male'
                      ? 'text-[var(--ios-blue)]'
                      : ''
                }
              >
                {formatGenderLabel(profile?.gender)}
              </span>
              {' looking for'}
            </p>
            <div className={`mx-4 ${navGlassClass} p-1.5`}>
              <div className="relative flex gap-1">
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
            </div>
          </section>

          <SettingsSection title="Links">
            <div className="px-4 py-4 flex justify-center">
              <SocialLinksEditor socials={socials} onChange={setSocials} />
            </div>
          </SettingsSection>
          </div>
        </motion.div>
      </form>

      <EditSaveBar
        visible={hasChanges}
        formId="edit-profile-form"
        loading={loading}
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
