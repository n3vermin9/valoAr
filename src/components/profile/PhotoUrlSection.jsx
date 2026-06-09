import { useState, useEffect } from 'react'
import { IconPlus } from '@tabler/icons-react'

export const SAMPLE_PROFILE_PHOTOS = [
  'https://uztag.info/upload/resize_cache/iblock/734/554_350_2/734006f0c865c4cb23f0fca35ac72f63.jpg',
  'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcT2kaC5zyrWmhTzl6TPzIvI5USiu08kBMKCHw&s',
  'https://toc.h-cdn.co/assets/16/09/1600x1600/square-1456787230-gettyimages-168599144-1.jpg',
  'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSUpXk8E9Jo-5ep79TH13BTxFXIWTMem-3Mug&s',
]

function SamplePhotoPicker({ photos, updatePhoto }) {
  return (
    <div className="mb-4">
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

function PhotoPreview({ url, single, onRemove, onError }) {
  if (!url.trim()) return null

  return (
    <div className="relative group">
      <img
        src={url}
        alt=""
        onError={onError}
        className={`object-cover rounded-2xl border border-white/10 ${
          single ? 'w-44 h-44' : 'w-24 h-24'
        }`}
      />
      <button
        type="button"
        onClick={onRemove}
        className="absolute -top-2 -right-2 w-7 h-7 rounded-full bg-black/80 border border-white/20 text-white opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-base leading-none"
        aria-label="Remove photo"
      >
        ×
      </button>
    </div>
  )
}

function PhotoSlot({ index, url, updatePhoto, single, placeholder }) {
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    setFailed(false)
  }, [url])

  if (url.trim() && !failed) {
    return (
      <PhotoPreview
        url={url}
        single={single}
        onRemove={() => updatePhoto(index, '')}
        onError={() => setFailed(true)}
      />
    )
  }

  return (
    <input
      value={url}
      onChange={(e) => updatePhoto(index, e.target.value)}
      placeholder={placeholder}
      className="w-full px-5 py-3 bg-white/10 rounded-full border border-white/10 outline-none focus:border-blue-500 mb-2"
    />
  )
}

export default function PhotoUrlSection({
  photos,
  updatePhoto,
  visiblePhotoSlots,
  setVisiblePhotoSlots,
  showSamplePhotos = false,
}) {
  const filledInVisible = photos.slice(0, visiblePhotoSlots).filter((url) => url.trim()).length

  return (
    <div>
      <label className="text-sm text-white/60 mb-3 block">Profile Photo</label>

      {showSamplePhotos && <SamplePhotoPicker photos={photos} updatePhoto={updatePhoto} />}

      {Array.from({ length: visiblePhotoSlots }).map((_, i) => {
        const hasPreview = photos[i]?.trim()

        return (
          <div
            key={i}
            className={hasPreview ? `mb-4 ${filledInVisible === 1 ? 'flex justify-center' : 'flex justify-start'}` : undefined}
          >
            <PhotoSlot
              index={i}
              url={photos[i]}
              updatePhoto={updatePhoto}
              single={filledInVisible === 1}
              placeholder={i === 0 ? 'Photo URL (required)' : `Photo ${i + 1} URL (optional)`}
            />
          </div>
        )
      })}

      {visiblePhotoSlots < 3 && (
        <button
          type="button"
          onClick={() => setVisiblePhotoSlots((n) => n + 1)}
          className="flex items-center gap-1.5 text-sm text-blue-400 hover:text-blue-300 mt-1"
        >
          <IconPlus size={16} />
          add more
        </button>
      )}
    </div>
  )
}
