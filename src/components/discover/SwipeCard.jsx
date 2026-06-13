import { IconHeart, IconX, IconMessageCircle } from '@tabler/icons-react'
import { sad } from '../../assets'
import { profileActionBtnClass } from '../../utils/designSystem'
import ProfileLookingFor from '../profile/ProfileLookingFor'
import SocialLinksDisplay from '../profile/SocialLinksDisplay'

export default function SwipeCard({
  profile,
  onSwipe,
  onLikeWithMessage,
  alreadyLikedYou,
  alreadyMatched,
  onViewProfile,
}) {
  const bio = profile.bio?.trim()

  return (
    <div className="relative w-full max-w-[17rem] mx-auto max-h-full">
      <div className="relative flex flex-col rounded-[var(--ios-radius-lg)] overflow-hidden bg-white/5 border border-white/10 shadow-2xl">
        <img
          src={profile.photos?.[0] || sad}
          alt=""
          draggable={false}
          className="w-full aspect-square object-cover cursor-pointer"
          onClick={() => onViewProfile?.(profile)}
        />

        <div className="px-3.5 pt-2.5 max-h-28 overflow-y-auto overscroll-y-contain">
          <button type="button" onClick={() => onViewProfile?.(profile)} className="text-left">
            <h3 className="text-base font-bold leading-tight">
              {profile.username}, {profile.age}
            </h3>
          </button>

          {bio && (
            <p className="text-xs text-white/70 mt-1.5 leading-relaxed whitespace-pre-wrap break-words">
              {bio}
            </p>
          )}

          <ProfileLookingFor
            gender={profile.gender}
            interestedIn={profile.interestedIn}
            className="text-xs text-white/50 mt-1.5"
          />

          <SocialLinksDisplay socials={profile.socials} compact visible={alreadyMatched} />
        </div>

        <div className="flex items-center gap-2 px-3.5 py-3 shrink-0 border-t border-white/5">
          <button
            type="button"
            onClick={() => onSwipe('pass')}
            disabled={alreadyMatched}
            className={`${profileActionBtnClass} !h-9`}
            aria-label="Pass"
          >
            <IconX size={18} className="text-white/70" stroke={3} />
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
            <IconMessageCircle size={18} className="text-white/70" stroke={3} />
          </button>
          <button
            type="button"
            onClick={() => onSwipe('like')}
            disabled={alreadyLikedYou || alreadyMatched}
            className={`${profileActionBtnClass} !h-9`}
            aria-label="Send friend request"
          >
            <IconHeart size={18} className="text-white/70" stroke={3} />
          </button>
        </div>
      </div>
    </div>
  )
}
