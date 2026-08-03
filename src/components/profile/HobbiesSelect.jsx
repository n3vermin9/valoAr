import { useEffect, useMemo, useState } from 'react'
import { IconSearch, IconX } from '@tabler/icons-react'
import toast from 'react-hot-toast'
import {
  MAX_HOBBIES,
  getCombinedHobbies,
  getHobbyLabel,
  normalizeHobbies,
} from '../../utils/profileOptions'
import { fieldLabelClass, typoSubheadClass } from '../../utils/designSystem'
import AppTextInput from '../ui/AppTextInput'
import { createCustomInterest, subscribeCustomInterests } from '../../services/interestsService'

const LIST_HEIGHT = 'h-28' // fixed ~112px — fewer chips visible at once

/**
 * Multi-select hobbies picker with search + selected chips.
 */
export default function HobbiesSelect({
  value = [],
  onChange,
  max = MAX_HOBBIES,
  className = '',
  userId = null,
  showLabel = true,
}) {
  const [query, setQuery] = useState('')
  const [customInterests, setCustomInterests] = useState([])
  const [creatingInterest, setCreatingInterest] = useState(false)
  const options = useMemo(() => getCombinedHobbies(customInterests), [customInterests])
  const optionMap = useMemo(() => new Map(options.map((hobby) => [hobby.id, hobby])), [options])
  const selected = useMemo(() => normalizeHobbies(value).slice(0, max), [value, max])
  const selectedSet = useMemo(() => new Set(selected), [selected])
  const cleanQuery = query.trim().replace(/\s+/g, ' ')

  const filtered = useMemo(() => {
    const q = cleanQuery.toLowerCase()
    if (!q) return options
    return options.filter(
      (h) => h.label.toLowerCase().includes(q) || h.id.toLowerCase().includes(q)
    )
  }, [cleanQuery, options])

  const canCreate =
    cleanQuery.length >= 2 &&
    !options.some((hobby) => hobby.label.toLowerCase() === cleanQuery.toLowerCase())

  useEffect(() => {
    return subscribeCustomInterests(setCustomInterests)
  }, [])

  const toggle = (id, { clearSearch = false } = {}) => {
    if (selectedSet.has(id)) {
      onChange(selected.filter((x) => x !== id))
      return
    }
    if (selected.length >= max) return
    onChange([...selected, id])
    if (clearSearch) setQuery('')
  }

  const handleCreateInterest = async () => {
    if (!canCreate || creatingInterest) return
    setCreatingInterest(true)
    try {
      const interest = await createCustomInterest(cleanQuery, userId)
      if (!selectedSet.has(interest.id) && selected.length < max) {
        onChange([...selected, interest.id])
      }
      setQuery('')
    } catch (err) {
      toast.error(err.message || 'Could not create interest')
    } finally {
      setCreatingInterest(false)
    }
  }

  return (
    <div className={className}>
      <div className={`flex items-baseline gap-3 mb-1.5 ${showLabel ? 'justify-between' : 'justify-end'}`}>
        {showLabel ? (
          <label className={`${fieldLabelClass} !mb-0 !text-[13px]`}>Hobbies</label>
        ) : null}
        <span className={`${typoSubheadClass} !text-[12px]`}>
          {selected.length}/{max}
        </span>
      </div>

      <div className="min-h-8 flex flex-wrap gap-1.5 mb-2">
        {selected.length === 0 ? (
          <span className="text-[12px] text-white/35 leading-8">Pick up to {max}</span>
        ) : (
          selected.map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => toggle(id)}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-blue-500/70 text-white text-[12px] font-medium leading-none"
            >
              {optionMap.get(id)?.label || getHobbyLabel(id)}
              <IconX size={12} stroke={2.5} className="opacity-80" />
            </button>
          ))
        )}
      </div>

      <div className="relative mb-2">
        <IconSearch
          size={13}
          className="absolute left-2.5 top-1/2 -translate-y-1/2 text-white/40 pointer-events-none"
        />
        <AppTextInput
          label="Search hobbies"
          layout="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search…"
          className="!h-8 !min-h-8 pl-8 pr-3 !text-[13px] bg-white/[0.06] border-white/5"
        />
      </div>

      <div
        className={`${LIST_HEIGHT} rounded-2xl bg-white/[0.03] overflow-y-auto overscroll-contain`}
      >
        {filtered.length === 0 && !canCreate ? (
          <p className="px-3 py-4 text-center text-white/35 text-[12px]">No hobbies match</p>
        ) : null}
        {filtered.length > 0 || canCreate ? (
          <div className="flex flex-wrap gap-1.5 p-2.5 content-start">
            {filtered.map((hobby) => {
              const on = selectedSet.has(hobby.id)
              const atCap = !on && selected.length >= max
              return (
                <button
                  key={hobby.id}
                  type="button"
                  disabled={atCap}
                  onClick={() => toggle(hobby.id, { clearSearch: Boolean(hobby.custom) || Boolean(cleanQuery) })}
                  className={`px-2.5 py-1 rounded-full text-[12px] font-medium leading-none transition-colors disabled:opacity-30 ${
                    on
                      ? 'bg-blue-500/70 text-white'
                      : 'bg-transparent text-white/50 hover:bg-white/[0.06] hover:text-white/70'
                  }`}
                >
                  {hobby.label}
                  {hobby.custom ? <span className="ml-1 text-white/35">custom</span> : null}
                </button>
              )
            })}
            {canCreate ? (
              <button
                type="button"
                disabled={creatingInterest || selected.length >= max}
                onClick={handleCreateInterest}
                className="px-2.5 py-1 rounded-full text-[12px] font-medium leading-none bg-blue-500/20 text-blue-200 border border-blue-400/20 disabled:opacity-35"
              >
                {creatingInterest ? 'Adding…' : `Add “${cleanQuery}”`}
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  )
}

/** Read-only chip row for profile / cards. */
export function HobbiesDisplay({
  hobbies = [],
  className = '',
  limit = MAX_HOBBIES,
  variant = 'default',
  highlightIds = [],
}) {
  const ids = normalizeHobbies(hobbies)
  if (!ids.length) return null
  const shown = ids.slice(0, limit)
  const extra = ids.length - shown.length
  const organic = variant === 'organic'
  const card = variant === 'card'
  const highlightSet = new Set(normalizeHobbies(highlightIds))

  return (
    <div
      className={`flex flex-wrap ${
        organic
          ? 'justify-center items-center gap-x-2 gap-y-2 max-w-[17rem] mx-auto min-h-8'
          : card
            ? 'grid grid-cols-2 gap-1 max-w-full'
          : 'gap-1.5'
      } ${className}`}
    >
      {shown.map((id) => (
        <span
          key={id}
          className={
            highlightSet.has(id)
              ? `${card ? 'min-w-0 px-1.5 py-0.5 text-[10.5px] text-center truncate' : 'px-3 py-1.5 text-[12px]'} rounded-full bg-blue-500/10 text-blue-100 font-medium leading-none border border-blue-400/55 shadow-[0_0_0_1px_rgba(96,165,250,0.12)]`
              : organic
                ? 'px-3 py-1.5 rounded-full bg-white/[0.08] text-white/85 text-[12px] font-medium leading-none border border-transparent'
                : card
                  ? 'min-w-0 px-1.5 py-0.5 rounded-full bg-white/10 text-white/75 text-[10.5px] text-center truncate font-medium leading-none border border-transparent'
                  : 'px-2.5 py-1 rounded-full bg-white/10 text-white/80 text-[12px] font-medium leading-none border border-transparent'
          }
          title={getHobbyLabel(id)}
        >
          {getHobbyLabel(id)}
        </span>
      ))}
      {extra > 0 ? (
        <span
          className={
            organic
              ? 'px-3 py-1.5 rounded-full bg-white/[0.06] text-white/45 text-[12px] font-medium leading-none'
              : 'px-2.5 py-1 rounded-full bg-white/10 text-white/50 text-[12px] font-medium leading-none'
          }
        >
          +{extra}
        </span>
      ) : null}
    </div>
  )
}
