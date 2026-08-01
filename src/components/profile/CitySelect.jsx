import { CITIES } from '../../utils/profileOptions'
import { compactInputClass } from '../../utils/designSystem'

/**
 * City dropdown. Pass allowAny for Discover filters (empty = any city).
 */
export default function CitySelect({
  value = '',
  onChange,
  className = '',
  allowAny = false,
  anyLabel = 'Any city',
}) {
  return (
    <select
      value={value || ''}
      onChange={(e) => onChange(e.target.value)}
      className={`${compactInputClass} appearance-none bg-[url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%23ffffff99' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")] bg-[length:16px] bg-[right_0.9rem_center] bg-no-repeat pr-10 ${className}`}
      aria-label="City"
    >
      {allowAny ? <option value="">{anyLabel}</option> : null}
      {CITIES.map((city) => (
        <option key={city.id} value={city.id}>
          {city.label}
        </option>
      ))}
    </select>
  )
}
