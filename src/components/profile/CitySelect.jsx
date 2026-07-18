import { CITIES } from '../../utils/profileOptions'

/**
 * Single-select city control. Only Grozny is available for now.
 */
export default function CitySelect({ value, onChange, className = '' }) {
  return (
    <div className={className}>
      <div className="flex flex-wrap gap-2">
        {CITIES.map((city) => {
          const selected = value === city.id
          return (
            <button
              key={city.id}
              type="button"
              onClick={() => onChange(city.id)}
              className={`px-4 py-2.5 rounded-full text-[15px] font-medium transition-colors ${
                selected
                  ? 'bg-blue-500 text-white'
                  : 'bg-white/10 text-white/80 hover:bg-white/15'
              }`}
            >
              {city.label}
            </button>
          )
        })}
      </div>
      <p className="text-xs text-white/40 mt-2">More cities coming soon</p>
    </div>
  )
}
