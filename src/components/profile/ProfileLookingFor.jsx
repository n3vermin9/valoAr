import { formatGenderLabel } from '../../utils/helpers'

export default function ProfileLookingFor({ gender, interestedIn, className = 'text-sm text-white/50 mt-3' }) {
  const genderLabel = formatGenderLabel(gender)
  const genderClass =
    gender === 'male'
      ? 'text-blue-400'
      : gender === 'female'
        ? 'text-pink-400'
        : 'text-white/50'

  let lookingFor = null
  if (interestedIn === 'both') {
    lookingFor = <span className="text-white/70">friends</span>
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
