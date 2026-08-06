import ProfileLookingFor from './ProfileLookingFor'
import SocialLinksDisplay from './SocialLinksDisplay'
import { typoBodyClass } from '../../utils/designSystem'

/**
 * Bio / looking-for / friend-count / socials block (interests live in ProfileInterestsCard).
 */
export default function ProfileAboutBlock({
  profile,
  showFriendCount = false,
  friendCount = 0,
  socialsVisible = true,
}) {
  const bio = profile?.bio?.trim()
  const hasLookingFor = Boolean(profile?.interestedIn)

  return (
    <div className="p-4 min-w-0 flex flex-col gap-3.5">
      <p
        className={`${typoBodyClass} break-words whitespace-pre-wrap leading-relaxed ${
          bio ? '' : 'text-[var(--ios-label-tertiary)]'
        }`}
      >
        {bio || 'No bio yet'}
      </p>

      {hasLookingFor || showFriendCount ? (
        <div className="flex flex-col gap-1.5">
          {hasLookingFor ? (
            <ProfileLookingFor
              gender={profile?.gender}
              interestedIn={profile?.interestedIn}
              className="text-[13px] leading-snug text-[var(--ios-label-tertiary)]"
            />
          ) : null}
          {showFriendCount ? (
            <p className="text-[12px] leading-none text-[var(--ios-label-tertiary)]">
              Has {friendCount} {friendCount === 1 ? 'friend' : 'friends'}
            </p>
          ) : null}
        </div>
      ) : null}

      <SocialLinksDisplay socials={profile?.socials} visible={socialsVisible} />
    </div>
  )
}
