import { useEffect, useId, useRef, useState } from 'react'
import { IconCheck, IconChevronDown } from '@tabler/icons-react'
import { CITIES } from '../../utils/profileOptions'
import {
  compactInputClass,
  dropdownMenuItemClass,
  navGlassMenuClass,
} from '../../utils/designSystem'

/**
 * Custom city picker (button + menu). Avoids native <select>, which shows
 * iOS’s keyboard accessory bar (↑↓ Done) in Safari / home-screen PWAs.
 */
export default function CitySelect({
  value = '',
  onChange,
  className = '',
  allowAny = false,
  anyLabel = 'Any city',
}) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef(null)
  const listId = useId()

  const options = allowAny
    ? [{ id: '', label: anyLabel }, ...CITIES]
    : CITIES

  const selected =
    options.find((city) => city.id === (value || '')) || options[0] || null

  useEffect(() => {
    if (!open) return undefined

    const onPointerDown = (e) => {
      if (!rootRef.current?.contains(e.target)) setOpen(false)
    }
    const onKeyDown = (e) => {
      if (e.key === 'Escape') setOpen(false)
    }

    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        type="button"
        className={`${compactInputClass} flex items-center justify-between gap-2 text-left pr-3`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        aria-label="City"
        onClick={() => setOpen((current) => !current)}
      >
        <span className="truncate">{selected?.label || anyLabel}</span>
        <IconChevronDown
          size={18}
          stroke={2}
          className={`shrink-0 text-[var(--ios-label-secondary)] transition-transform ${
            open ? 'rotate-180' : ''
          }`}
        />
      </button>

      {open ? (
        <ul
          id={listId}
          role="listbox"
          aria-label="City"
          className={`absolute left-0 right-0 top-[calc(100%+6px)] z-40 max-h-56 overflow-y-auto py-1 ${navGlassMenuClass}`}
        >
          {options.map((city) => {
            const isSelected = (value || '') === city.id
            return (
              <li key={city.id || 'any'} role="option" aria-selected={isSelected}>
                <button
                  type="button"
                  className={`${dropdownMenuItemClass} flex w-full items-center justify-between gap-3 ${
                    isSelected ? 'bg-white/[0.08]' : ''
                  }`}
                  onClick={() => {
                    onChange(city.id)
                    setOpen(false)
                  }}
                >
                  <span className="truncate">{city.label}</span>
                  {isSelected ? (
                    <IconCheck size={18} stroke={2.25} className="shrink-0 text-[var(--ios-blue)]" />
                  ) : null}
                </button>
              </li>
            )
          })}
        </ul>
      ) : null}
    </div>
  )
}
