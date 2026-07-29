import { useState } from 'react'
import CitySelect from '../profile/CitySelect'
import HobbiesSelect from '../profile/HobbiesSelect'
import {
  hasActiveDiscoverFilters,
  normalizeDiscoverFilters,
  saveDiscoverFilters,
} from '../../utils/discoverFilters'

export default function DiscoverFiltersPanel({ filters, onChange, userId }) {
  const [draft, setDraft] = useState(() => normalizeDiscoverFilters(filters))
  const active = hasActiveDiscoverFilters(draft)

  const apply = (nextFilters) => {
    const normalized = normalizeDiscoverFilters(nextFilters)
    setDraft(normalized)
    saveDiscoverFilters(normalized)
    onChange?.(normalized)
  }

  const setCity = (city) => {
    apply({
      ...draft,
      city: draft.city === city ? '' : city,
    })
  }

  const clear = () => apply(normalizeDiscoverFilters())

  return (
    <div className="space-y-6">
      <section>
        <p className="text-[12px] font-semibold uppercase tracking-wide text-white/45 mb-2">
          City
        </p>
        <div className="space-y-2">
          <button
            type="button"
            onClick={() => apply({ ...draft, city: '' })}
            className={`px-4 py-2.5 rounded-full text-[15px] font-medium transition-colors ${
              !draft.city
                ? 'bg-blue-500 text-white'
                : 'bg-white/10 text-white/75 hover:bg-white/15'
            }`}
          >
            Any city
          </button>
          <CitySelect value={draft.city} onChange={setCity} />
        </div>
      </section>

      <section>
        <p className="text-[12px] font-semibold uppercase tracking-wide text-white/45 mb-2">
          Interests
        </p>
        <HobbiesSelect
          value={draft.hobbies}
          onChange={(hobbies) => apply({ ...draft, hobbies })}
          userId={userId}
        />
      </section>

      <button
        type="button"
        onClick={clear}
        disabled={!active}
        className="w-full py-3 rounded-full bg-white/10 text-white/80 disabled:opacity-40"
      >
        Clear Discover filters
      </button>
    </div>
  )
}
