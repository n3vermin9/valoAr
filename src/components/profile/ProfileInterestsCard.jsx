import { HobbiesDisplay } from './HobbiesSelect'
import { insetCardOuterClass } from '../../utils/designSystem'
import { normalizeHobbies } from '../../utils/profileOptions'

/**
 * Standalone interests card shown under the bio/about card.
 */
export default function ProfileInterestsCard({ profile, className = '' }) {
  const hobbies = normalizeHobbies(profile?.hobbies)
  if (!hobbies.length) return null

  return (
    <div className={`${insetCardOuterClass} mt-3 min-w-0 mx-[var(--ios-page-x-lg)] overflow-hidden ${className}`}>
      <div className="px-4 py-3.5 bg-gradient-to-br from-white/[0.04] to-transparent">
        <div className="flex items-center justify-between gap-3 mb-2.5">
          <p className="text-left text-[12px] font-semibold tracking-wide uppercase text-[var(--ios-label-secondary)]">
            Interests
          </p>
          <span className="text-[11px] text-[var(--ios-label-tertiary)]">
            {hobbies.length}/4
          </span>
        </div>
        <HobbiesDisplay hobbies={hobbies} variant="organic" />
      </div>
    </div>
  )
}
