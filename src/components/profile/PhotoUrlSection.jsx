import { useState, useEffect, useMemo, useRef } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { IconPlus, IconX } from '@tabler/icons-react'
import ConfirmDialog from '../ui/ConfirmDialog'
import { chatRoomTopScrimClass, photoHeroFrameClass, photoHeroImageClass } from '../../utils/designSystem'

const photoControlSpring = { type: 'spring', stiffness: 520, damping: 30 }
const photoControlButtonClass =
  'h-12 w-12 shrink-0 flex items-center justify-center rounded-full border border-[var(--ios-glass-border)] bg-white/10 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] transition-colors hover:bg-white/15 active:bg-white/20'

export const SAMPLE_PROFILE_PHOTOS = [
  'https://uztag.info/upload/resize_cache/iblock/734/554_350_2/734006f0c865c4cb23f0fca35ac72f63.jpg',
  'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcT2kaC5zyrWmhTzl6TPzIvI5USiu08kBMKCHw&s',
  'https://toc.h-cdn.co/assets/16/09/1600x1600/square-1456787230-gettyimages-168599144-1.jpg',
  'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSUpXk8E9Jo-5ep79TH13BTxFXIWTMem-3Mug&s',
]

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

function SamplePhotoPicker({ photos, updatePhoto }) {
  return (
    <div className="mb-4 px-[var(--ios-page-x-lg)]">
      <p className="text-xs text-white/40 mb-2">Sample photos</p>
      <div className="grid grid-cols-4 gap-2">
        {SAMPLE_PROFILE_PHOTOS.map((url) => {
          const selected = photos[0] === url
          return (
            <button
              key={url}
              type="button"
              onClick={() => updatePhoto(0, url)}
              className={`rounded-xl overflow-hidden border-2 transition-colors ${
                selected ? 'border-blue-500' : 'border-white/10 hover:border-white/25'
              }`}
            >
              <img src={url} alt="" className="w-full aspect-square object-cover" />
            </button>
          )
        })}
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

    const nextPhotos = photos.map((url, i) => (i === currentEntry.index ? '' : url))
    updatePhoto(currentEntry.index, '')
    onActiveSlotChange?.(null)
    setVisiblePhotoSlots(getVisiblePhotoSlotCount(nextPhotos))
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

  return (
    <div ref={heroRef}>
      {showSamplePhotos && <SamplePhotoPicker photos={photos} updatePhoto={updatePhoto} />}

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

            <div
              aria-hidden
              className={chatRoomTopScrimClass}
              style={{ height: 'calc(var(--ios-safe-top) + 4.5rem)' }}
            />
            <div
              aria-hidden
              className="absolute bottom-0 inset-x-0 z-[10] pointer-events-none bg-gradient-to-t from-black via-black/80 to-transparent h-32"
            />

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
                  key="photo-controls-scrim"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.16 }}
                  className="absolute inset-0 z-20 pointer-events-none bg-black/20"
                />
              ) : null}
            </AnimatePresence>

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
                      className={photoControlButtonClass}
                      aria-label="Add more photos"
                    >
                      <IconPlus size={22} stroke={2} />
                    </motion.button>
                  ) : null}
                  <motion.button
                    type="button"
                    initial={{ opacity: 0, scale: 0.78 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.78 }}
                    transition={photoControlSpring}
                    onClick={requestRemoveCurrent}
                    className={`${photoControlButtonClass} text-white/80`}
                    aria-label="Remove photo"
                  >
                    <IconX size={22} stroke={2} />
                  </motion.button>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </>
        )}
      </div>

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

  return (
    <div>
      {label ? <label className="text-sm text-white/60 mb-3 block">{label}</label> : null}

      {showSamplePhotos && <SamplePhotoPicker photos={photos} updatePhoto={updatePhoto} />}

      {Array.from({ length: visiblePhotoSlots }).map((_, i) => {
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
