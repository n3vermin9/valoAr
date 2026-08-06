import { useState } from 'react'
import CitySelect from '../profile/CitySelect'
import HobbiesSelect from '../profile/HobbiesSelect'
import {
  hasActiveDiscoverFilters,
  normalizeDiscoverFilters,
  saveDiscoverFilters,
} from '../../utils/discoverFilters'
import { typoCaptionClass } from '../../utils/designSystem'

export default function DiscoverFiltersPanel({ filters, onChange, userId }) {
  const [draft, setDraft] = useState(() => normalizeDiscoverFilters(filters))
  const active = hasActiveDiscoverFilters(draft)

  const apply = (nextFilters) => {
    const normalized = normalizeDiscoverFilters(nextFilters)
    setDraft(normalized)
    saveDiscoverFilters(normalized)
    onChange?.(normalized)
  }

  const clear = () => apply(normalizeDiscoverFilters())

  return (
    <div className="space-y-8">
      <section>
        <p className={`${typoCaptionClass} mb-2`}>City</p>
        <CitySelect
          value={draft.city}
          onChange={(city) => apply({ ...draft, city })}
          allowAny
        />
      </section>

      <section className="border-t border-[var(--ios-hairline)] pt-8">
        <p className={`${typoCaptionClass} mb-2`}>Interests</p>
        <HobbiesSelect
          value={draft.hobbies}
          onChange={(hobbies) => apply({ ...draft, hobbies })}
          userId={userId}
          showLabel={false}
        />
      </section>

      <button
        type="button"
        onClick={clear}
        disabled={!active}
        className="w-full py-3 rounded-full bg-[var(--ios-fill-tertiary)] text-[var(--ios-label)] disabled:opacity-40"
      >
        Clear Discover filters
      </button>
    </div>
  )
}
