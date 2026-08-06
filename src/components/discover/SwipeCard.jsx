import { useState, useEffect, useRef } from 'react'
import { IconHeart, IconX, IconMessageCircle } from '@tabler/icons-react'
import { sad } from '../../assets'
import { profileActionBtnClass } from '../../utils/designSystem'
import ProfileLookingFor from '../profile/ProfileLookingFor'
import SocialLinksDisplay from '../profile/SocialLinksDisplay'
import { HobbiesDisplay } from '../profile/HobbiesSelect'
import VerifiedBadge from '../ui/VerifiedBadge'
import { getCityLabel, normalizeHobbies } from '../../utils/profileOptions'

export default function SwipeCard({
  profile,
  onSwipe,
  onLikeWithMessage,
  alreadyLikedYou,
  alreadyMatched,
  onViewProfile,
  currentUserHobbies = [],
}) {
  const bio = profile.bio?.trim()
  const photos = (profile.photos || []).filter(Boolean)
  const displayPhotos = photos.length ? photos : [sad]
  const cityLabel = getCityLabel(profile.city)
  const currentHobbySet = new Set(normalizeHobbies(currentUserHobbies))
  const profileHobbies = normalizeHobbies(profile.hobbies)
  const mutualHobbies = profileHobbies.filter((id) => currentHobbySet.has(id))
  const orderedHobbies = [
    ...mutualHobbies,
    ...profileHobbies.filter((id) => !currentHobbySet.has(id)),
  ]
  const [photoIndex, setPhotoIndex] = useState(0)
  const galleryRef = useRef(null)

  useEffect(() => {
    setPhotoIndex(0)
    galleryRef.current?.scrollTo({ left: 0, behavior: 'instant' })
  }, [profile.id])

  const handleGalleryScroll = () => {
    const el = galleryRef.current
    if (!el || el.clientWidth <= 0) return
    const index = Math.round(el.scrollLeft / el.clientWidth)
    setPhotoIndex(index)
  }

  return (
    <div className="relative w-full max-w-[18rem] mx-auto max-h-full">
      <div className="relative flex flex-col rounded-[var(--ios-radius-lg)] overflow-hidden bg-[var(--ios-fill-tertiary)] border border-[var(--ios-hairline)] shadow-2xl">
        <div className="relative">
          <div
            ref={galleryRef}
            onScroll={handleGalleryScroll}
            className="flex overflow-x-auto snap-x snap-mandatory overscroll-x-contain scrollbar-hide touch-pan-x"
          >
            {displayPhotos.map((src, i) => (
              <img
                key={`${profile.id}-${i}`}
                src={src}
                alt=""
                draggable={false}
                className="w-full aspect-square shrink-0 snap-start object-cover cursor-pointer"
                onClick={() => onViewProfile?.(profile)}
              />
            ))}
          </div>
          {displayPhotos.length > 1 && (
            <div className="absolute bottom-2 left-0 right-0 flex justify-center gap-1.5 pointer-events-none">
              {displayPhotos.map((_, i) => (
                <span
                  key={i}
                  className={`h-1.5 rounded-full transition-all ${
                    i === photoIndex ? 'w-3 bg-white' : 'w-1.5 bg-white/40'
                  }`}
                />
              ))}
            </div>
          )}
        </div>

        <div className="px-3.5 pt-2.5 max-h-36 overflow-y-auto overscroll-y-contain">
          <button type="button" onClick={() => onViewProfile?.(profile)} className="text-left w-full">
            <h3 className="text-base font-bold leading-tight inline-flex items-center gap-1 flex-wrap">
              <span>
                {profile.username}, {profile.age}
                {cityLabel ? ` · ${cityLabel}` : ''}
              </span>
              <VerifiedBadge username={profile.username} size={16} />
            </h3>
          </button>

          {bio && (
            <p className="text-xs text-[var(--ios-label-secondary)] mt-1.5 leading-relaxed whitespace-pre-wrap break-words">
              {bio}
            </p>
          )}

          <ProfileLookingFor
            gender={profile.gender}
            interestedIn={profile.interestedIn}
            className="text-xs text-[var(--ios-label-tertiary)] mt-1.5"
          />

          <HobbiesDisplay
            hobbies={orderedHobbies}
            highlightIds={mutualHobbies}
            className="mt-1.5"
            limit={4}
            variant="card"
          />

          <SocialLinksDisplay socials={profile.socials} compact visible={alreadyMatched} />
        </div>

        <div className="flex items-center gap-2 px-3.5 py-3 shrink-0 border-t border-[var(--ios-hairline)]">
          <button
            type="button"
            onClick={() => onSwipe('pass')}
            disabled={alreadyMatched}
            className={`${profileActionBtnClass} !h-9`}
            aria-label="Pass"
          >
            <IconX size={18} className="text-[var(--ios-label-secondary)]" stroke={3} />
          </button>
          <button
            type="button"
            onClick={onLikeWithMessage}
            disabled={alreadyLikedYou || alreadyMatched}
            className={`${profileActionBtnClass} !h-9`}
            aria-label="Send friend request with message"
            title={
              alreadyMatched
                ? 'Already friends'
                : alreadyLikedYou
                  ? 'They already sent a request — check Friend Requests'
                  : 'Send friend request with message'
            }
          >
            <IconMessageCircle size={18} className="text-[var(--ios-label-secondary)]" stroke={3} />
          </button>
          <button
            type="button"
            onClick={() => onSwipe('like')}
            disabled={alreadyLikedYou || alreadyMatched}
            className={`${profileActionBtnClass} !h-9`}
            aria-label="Send friend request"
          >
            <IconHeart size={18} className="text-[var(--ios-label-secondary)]" stroke={3} />
          </button>
        </div>
      </div>
    </div>
  )
}
