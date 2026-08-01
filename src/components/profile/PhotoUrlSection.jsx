import { useState, useEffect, useMemo, useRef } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { IconPlus, IconX } from '@tabler/icons-react'
import ConfirmDialog from '../ui/ConfirmDialog'
import {
  chatFloatingButtonClass,
  photoHeroFrameClass,
  photoHeroImageClass,
} from '../../utils/designSystem'

const photoControlSpring = { type: 'spring', stiffness: 520, damping: 30 }
const photoOverlayControlClass = `${chatFloatingButtonClass} text-white/80`
/** Same bottom fade as PhotoHeroView on profile viewing. */
const photoHeroScrimClass =
  'absolute bottom-0 inset-x-0 z-[10] pointer-events-none bg-gradient-to-t from-black via-black/80 to-transparent h-32'

export const SAMPLE_PROFILE_PHOTOS = [
  'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcQnvhPPC8A8dZ7DhQiqL8_bvErdnIN1XbJkYx2o64onBg&s=10',
  'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcT2kaC5zyrWmhTzl6TPzIvI5USiu08kBMKCHw&s',
  'https://toc.h-cdn.co/assets/16/09/1600x1600/square-1456787230-gettyimages-168599144-1.jpg',
  'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSUpXk8E9Jo-5ep79TH13BTxFXIWTMem-3Mug&s',
]

export function isSampleProfilePhoto(url) {
  const trimmed = url?.trim()
  return Boolean(trimmed && SAMPLE_PROFILE_PHOTOS.includes(trimmed))
}

export function getVisiblePhotoSlotCount(photos) {
  for (let i = photos.length - 1; i >= 0; i -= 1) {
    if (photos[i]?.trim()) return Math.max(1, i + 1)
  }
  return 1
}

export function promotePhotoToPrimary(photos, index) {
  const url = photos[index]?.trim()
  if (!url || index === 0) return photos

  const rest = photos.filter((item, i) => item.trim() && i !== index)
  return [...[url], ...rest, '', '', ''].slice(0, photos.length)
}

export function compactPhotos(photos) {
  const filled = photos.map((url) => url.trim()).filter(Boolean)
  return [...filled, '', '', ''].slice(0, photos.length)
}

function SamplePhotoPicker({ photos, updatePhoto, variant = 'default' }) {
  const primaryPhoto = photos[0]?.trim()
  const selectedSample = isSampleProfilePhoto(primaryPhoto) ? primaryPhoto : null

  const handleRemove = (e) => {
    e.stopPropagation()
    updatePhoto(0, '')
  }

  if (selectedSample) {
    const isHero = variant === 'hero'
    return (
      <div className={isHero ? undefined : 'mb-4 px-[var(--ios-page-x-lg)]'}>
        <div
          className={`relative overflow-hidden ${
            isHero ? photoHeroFrameClass : 'w-full aspect-square max-w-sm mx-auto rounded-2xl'
          }`}
        >
          <img
            src={selectedSample}
            alt=""
            className={isHero ? photoHeroImageClass : 'w-full h-full object-cover'}
          />
          <div aria-hidden className={photoHeroScrimClass} />
          <button
            type="button"
            onClick={handleRemove}
            className={`absolute z-[30] ${photoOverlayControlClass} ${
              isHero
                ? 'top-[max(0.75rem,var(--ios-safe-top))] right-[var(--ios-page-x-lg)]'
                : 'top-3 right-3'
            }`}
            aria-label="Remove photo"
          >
            <IconX size={24} stroke={2} className="w-6 h-6" />
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="mb-4 px-[var(--ios-page-x-lg)]">
      <p className="text-xs text-white/40 mb-2">Sample photos</p>
      <div className="grid grid-cols-4 gap-2">
        {SAMPLE_PROFILE_PHOTOS.map((url) => (
          <button
            key={url}
            type="button"
            onClick={() => updatePhoto(0, url)}
            className="rounded-xl overflow-hidden border-2 border-white/10 transition-colors hover:border-white/25"
          >
            <img src={url} alt="" className="w-full aspect-square object-cover" />
          </button>
        ))}
      </div>
    </div>
  )
}

function PhotoSlot({ index, url, updatePhoto, placeholder }) {
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    setFailed(false)
  }, [url])

  if (url.trim() && !failed) return null

  return (
    <input
      value={url}
      onChange={(e) => updatePhoto(index, e.target.value)}
      placeholder={placeholder}
      className="w-full aspect-square px-5 text-center bg-white/10 border border-white/10 outline-none focus:border-blue-500 rounded-none border-x-0 border-t-0"
    />
  )
}

function HeroPhotoSection({
  photos,
  updatePhoto,
  visiblePhotoSlots,
  setVisiblePhotoSlots,
  showSamplePhotos,
  maxSlots,
  onActiveSlotChange,
  heroRef,
  onOpenGallery,
}) {
  const [showPhotoControls, setShowPhotoControls] = useState(false)
  const [confirmRemoveOpen, setConfirmRemoveOpen] = useState(false)
  const [currentViewIndex, setCurrentViewIndex] = useState(0)
  const prevEntryCount = useRef(0)
  const photoTapTimeoutRef = useRef(null)

  const canAddMore = Boolean(setVisiblePhotoSlots && visiblePhotoSlots < maxSlots)

  const photoEntries = useMemo(
    () =>
      photos
        .slice(0, visiblePhotoSlots)
        .map((url, index) => ({ url: url.trim(), index }))
        .filter(({ url }) => url),
    [photos, visiblePhotoSlots]
  )

  const entryCount = photoEntries.length
  const safeViewIndex = entryCount ? Math.min(currentViewIndex, entryCount - 1) : 0
  const currentEntry = photoEntries[safeViewIndex] ?? null
  const hasPhotos = entryCount > 0
  const hasMultiplePhotos = entryCount > 1

  useEffect(() => {
    if (entryCount === 0) {
      setCurrentViewIndex(0)
      prevEntryCount.current = 0
      return
    }
    if (entryCount > prevEntryCount.current) {
      setCurrentViewIndex(0)
    } else if (currentViewIndex >= entryCount) {
      setCurrentViewIndex(entryCount - 1)
    }
    prevEntryCount.current = entryCount
  }, [entryCount, currentViewIndex])

  useEffect(() => {
    return () => {
      if (photoTapTimeoutRef.current) clearTimeout(photoTapTimeoutRef.current)
    }
  }, [])

  const handleCenterTap = (e) => {
    e.stopPropagation()
    if (hasPhotos) setShowPhotoControls((current) => !current)
  }

  const handlePhotoTap = (e) => {
    e.stopPropagation()
    if (!hasPhotos) return

    if (!onOpenGallery) {
      handleCenterTap(e)
      return
    }

    if (photoTapTimeoutRef.current) {
      clearTimeout(photoTapTimeoutRef.current)
      photoTapTimeoutRef.current = null
      setShowPhotoControls(false)
      onOpenGallery(safeViewIndex)
      return
    }

    photoTapTimeoutRef.current = setTimeout(() => {
      photoTapTimeoutRef.current = null
      handleCenterTap(e)
    }, 280)
  }

  const handlePhotoDoubleTap = (e) => {
    if (!onOpenGallery || !hasPhotos) return
    e.stopPropagation()
    if (photoTapTimeoutRef.current) {
      clearTimeout(photoTapTimeoutRef.current)
      photoTapTimeoutRef.current = null
    }
    setShowPhotoControls(false)
    onOpenGallery(safeViewIndex)
  }

  const handleAddMore = (e) => {
    e.stopPropagation()
    const nextCount = Math.min(visiblePhotoSlots + 1, maxSlots)
    setVisiblePhotoSlots(nextCount)
    onActiveSlotChange?.(nextCount - 1)
    setShowPhotoControls(false)
  }

  const requestRemoveCurrent = (e) => {
    e.stopPropagation()
    setShowPhotoControls(false)
    setConfirmRemoveOpen(true)
  }

  const confirmRemoveCurrent = () => {
    if (!currentEntry) {
      setConfirmRemoveOpen(false)
      return
    }

    updatePhoto(currentEntry.index, '')
    onActiveSlotChange?.(null)
    setShowPhotoControls(false)
    setCurrentViewIndex((index) => Math.max(0, index - 1))
    setConfirmRemoveOpen(false)
  }

  const goToPrevious = (e) => {
    e.stopPropagation()
    setShowPhotoControls(false)
    setCurrentViewIndex((index) => (index - 1 + entryCount) % entryCount)
  }

  const goToNext = (e) => {
    e.stopPropagation()
    setShowPhotoControls(false)
    setCurrentViewIndex((index) => (index + 1) % entryCount)
  }

  const primarySampleSelected = showSamplePhotos && isSampleProfilePhoto(photos[0])
  const showSamplePicker = showSamplePhotos && (primarySampleSelected || !hasPhotos)
  const showHeroFrame = !showSamplePhotos || (hasPhotos && !primarySampleSelected)

  return (
    <div ref={heroRef}>
      {showSamplePicker ? (
        <SamplePhotoPicker photos={photos} updatePhoto={updatePhoto} variant="hero" />
      ) : null}

      {showHeroFrame ? (
      <div className={photoHeroFrameClass}>
        {!hasPhotos ? (
          <PhotoSlot
            index={0}
            url={photos[0]}
            updatePhoto={updatePhoto}
            placeholder="Photo URL (required)"
          />
        ) : (
          <>
            <img
              key={currentEntry.url}
              src={currentEntry.url}
              alt=""
              className={photoHeroImageClass}
            />

            {hasMultiplePhotos ? (
              <>
                <button
                  type="button"
                  onClick={goToPrevious}
                  className="absolute inset-y-0 left-0 z-[15] w-[38%]"
                  aria-label="Previous photo"
                />
                <button
                  type="button"
                  onClick={handlePhotoTap}
                  onDoubleClick={handlePhotoDoubleTap}
                  className="absolute inset-y-0 left-[38%] z-[15] w-[24%]"
                  aria-label={onOpenGallery ? 'Photo options or view full size' : 'Photo options'}
                />
                <button
                  type="button"
                  onClick={goToNext}
                  className="absolute inset-y-0 right-0 z-[15] w-[38%]"
                  aria-label="Next photo"
                />
              </>
            ) : (
              <button
                type="button"
                onClick={handlePhotoTap}
                onDoubleClick={handlePhotoDoubleTap}
                className="absolute inset-0 z-[15]"
                aria-label={onOpenGallery ? 'Photo options or view full size' : 'Photo options'}
              />
            )}

            <div aria-hidden className={photoHeroScrimClass} />

            {hasMultiplePhotos ? (
              <div
                className="absolute top-[calc(var(--ios-safe-top)+2rem)] left-1/2 z-[20] flex w-[min(52vw,200px)] -translate-x-1/2 gap-1 pointer-events-none"
                aria-hidden
              >
                {photoEntries.map((entry, index) => (
                  <div key={entry.index} className="flex-1 h-[2px] rounded-full bg-white/25 overflow-hidden">
                    <div
                      className={`h-full rounded-full bg-white transition-[width] duration-75 ${
                        index === safeViewIndex ? 'w-full' : 'w-0'
                      }`}
                    />
                  </div>
                ))}
              </div>
            ) : null}

            <AnimatePresence>
              {showPhotoControls ? (
                <motion.div
                  key="photo-controls"
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={photoControlSpring}
                  className="absolute top-[max(0.75rem,var(--ios-safe-top))] right-[var(--ios-page-x-lg)] z-[30] flex items-center gap-2 pointer-events-auto"
                >
                  {canAddMore ? (
                    <motion.button
                      type="button"
                      initial={{ opacity: 0, scale: 0.78 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.78 }}
                      transition={photoControlSpring}
                      onClick={handleAddMore}
                      className={photoOverlayControlClass}
                      aria-label="Add more photos"
                    >
                      <IconPlus size={24} stroke={2} className="w-6 h-6" />
                    </motion.button>
                  ) : null}
                  <motion.button
                    type="button"
                    initial={{ opacity: 0, scale: 0.78 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.78 }}
                    transition={photoControlSpring}
                    onClick={requestRemoveCurrent}
                    className={photoOverlayControlClass}
                    aria-label="Remove photo"
                  >
                    <IconX size={24} stroke={2} className="w-6 h-6" />
                  </motion.button>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </>
        )}
      </div>
      ) : null}

      {showHeroFrame ? (
      <ConfirmDialog
        isOpen={confirmRemoveOpen}
        onClose={() => setConfirmRemoveOpen(false)}
        onConfirm={confirmRemoveCurrent}
        title="Remove photo?"
        message={
          entryCount > 1
            ? 'This photo will be removed from your profile.'
            : 'This is your only profile photo. Removing it will leave your profile without a photo until you add a new one.'
        }
        confirmLabel="Remove"
        danger
        overlayClassName="z-[80]"
      />
      ) : null}
    </div>
  )
}

export default function PhotoUrlSection({
  photos,
  updatePhoto,
  visiblePhotoSlots,
  setVisiblePhotoSlots,
  showSamplePhotos = false,
  maxSlots = 3,
  label = null,
  variant = 'default',
  activeSlot = null,
  onActiveSlotChange,
  heroRef,
  onOpenGallery,
}) {
  if (variant === 'hero') {
    return (
      <HeroPhotoSection
        photos={photos}
        updatePhoto={updatePhoto}
        visiblePhotoSlots={visiblePhotoSlots}
        setVisiblePhotoSlots={setVisiblePhotoSlots}
        showSamplePhotos={showSamplePhotos}
        maxSlots={maxSlots}
        onActiveSlotChange={onActiveSlotChange}
        heroRef={heroRef}
        onOpenGallery={onOpenGallery}
      />
    )
  }

  const filledInVisible = photos.slice(0, visiblePhotoSlots).filter((url) => url.trim()).length
  const primarySampleSelected = showSamplePhotos && isSampleProfilePhoto(photos[0])

  return (
    <div>
      {label ? <label className="text-sm text-white/60 mb-3 block">{label}</label> : null}

      {showSamplePhotos && (primarySampleSelected || !photos[0]?.trim()) ? (
        <SamplePhotoPicker photos={photos} updatePhoto={updatePhoto} />
      ) : null}

      {Array.from({ length: visiblePhotoSlots }).map((_, i) => {
        if (i === 0 && primarySampleSelected) return null

        const hasPreview = photos[i]?.trim()

        return (
          <div
            key={i}
            className={hasPreview ? `mb-4 w-full ${filledInVisible === 1 ? '' : 'flex justify-start'}` : undefined}
          >
            {hasPreview ? (
              <div
                className={`overflow-hidden border border-white/10 ${
                  filledInVisible === 1
                    ? 'w-full aspect-square rounded-2xl'
                    : 'w-24 h-24 rounded-2xl shrink-0'
                }`}
              >
                <img
                  src={photos[i]}
                  alt=""
                  className="block h-full w-full object-cover object-center"
                />
              </div>
            ) : (
              <input
                value={photos[i]}
                onChange={(e) => updatePhoto(i, e.target.value)}
                placeholder={i === 0 ? 'Photo URL (required)' : `Photo ${i + 1} URL (optional)`}
                className="w-full px-5 py-3 bg-white/10 rounded-full border border-white/10 outline-none focus:border-blue-500 mb-2"
              />
            )}
          </div>
        )
      })}

      {setVisiblePhotoSlots && visiblePhotoSlots < maxSlots && (
        <button
          type="button"
          onClick={() => setVisiblePhotoSlots((n) => Math.min(n + 1, maxSlots))}
          className="flex items-center gap-1.5 text-sm text-blue-400 hover:text-blue-300 mt-1"
        >
          <IconPlus size={16} />
          add more
        </button>
      )}
    </div>
  )
}
