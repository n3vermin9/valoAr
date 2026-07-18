import ProfileLookingFor from './ProfileLookingFor'
import SocialLinksDisplay from './SocialLinksDisplay'
import { HobbiesDisplay } from './HobbiesSelect'
import { typoBodyClass } from '../../utils/designSystem'

/**
 * Bio / looking-for / hobbies / friend-count block inside the profile about card.
 */
export default function ProfileAboutBlock({
  profile,
  showFriendCount = false,
  friendCount = 0,
  socialsVisible = true,
}) {
  const bio = profile?.bio?.trim()
  const hasHobbies = Array.isArray(profile?.hobbies) && profile.hobbies.length > 0
  const hasLookingFor = Boolean(profile?.interestedIn)
  const hasMeta = hasLookingFor || hasHobbies || showFriendCount

  return (
    <div className="p-4 min-w-0 flex flex-col gap-3.5">
      <p
        className={`${typoBodyClass} text-white/90 break-words whitespace-pre-wrap leading-relaxed ${
          bio ? '' : 'text-white/40'
        }`}
      >
        {bio || 'No bio yet'}
      </p>

      {hasMeta ? (
        <div className="flex flex-col gap-2.5 pt-3 border-t border-white/[0.06]">
          {hasLookingFor ? (
            <ProfileLookingFor
              gender={profile?.gender}
              interestedIn={profile?.interestedIn}
              className="text-[13px] leading-snug text-white/45"
            />
          ) : null}

          {hasHobbies ? <HobbiesDisplay hobbies={profile.hobbies} /> : null}

          {showFriendCount ? (
            <p className="text-[12px] leading-none text-white/35">
              Has {friendCount} {friendCount === 1 ? 'friend' : 'friends'}
            </p>
          ) : null}
        </div>
      ) : null}

      <SocialLinksDisplay socials={profile?.socials} visible={socialsVisible} />
    </div>
  )
}
