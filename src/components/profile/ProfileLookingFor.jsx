import { formatGenderLabel } from '../../utils/helpers'

export default function ProfileLookingFor({ gender, interestedIn, className = 'text-sm text-[var(--ios-label-secondary)] mt-3' }) {
  const genderLabel = formatGenderLabel(gender)
  const genderClass =
    gender === 'male'
      ? 'text-blue-400'
      : gender === 'female'
        ? 'text-pink-400'
        : 'text-[var(--ios-label-secondary)]'

  let lookingFor = null
  if (interestedIn === 'both') {
    lookingFor = <span className="text-[var(--ios-label)]">friends</span>
  } else if (interestedIn === 'women') {
    lookingFor = <span className="text-pink-400">female friends</span>
  } else if (interestedIn === 'men') {
    lookingFor = <span className="text-blue-400">male friends</span>
  }

  if (!lookingFor) return null

  return (
    <p className={className}>
      <span className={genderClass}>{genderLabel}</span>
      {' looking for '}
      {lookingFor}
    </p>
  )
}
