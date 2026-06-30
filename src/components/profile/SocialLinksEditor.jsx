import { useState } from 'react'
import { SOCIAL_PLATFORMS } from '../../utils/socialLinks'
import { TelegramIcon, InstagramIcon, TikTokIcon } from './SocialIcons'

const SOCIAL_ICONS = {
  telegram: TelegramIcon,
  instagram: InstagramIcon,
  tiktok: TikTokIcon,
}

export default function SocialLinksEditor({ socials, onChange }) {
  const [activeId, setActiveId] = useState(null)
  const activePlatform = SOCIAL_PLATFORMS.find(({ id }) => id === activeId)

  const togglePlatform = (id) => {
    setActiveId((current) => (current === id ? null : id))
  }

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {SOCIAL_PLATFORMS.map(({ id, label }) => {
          const Icon = SOCIAL_ICONS[id]
          const hasValue = Boolean(socials[id]?.trim())
          const isActive = activeId === id

          return (
            <button
              key={id}
              type="button"
              onClick={() => togglePlatform(id)}
              aria-label={label}
              aria-pressed={isActive}
              className={`inline-flex items-center justify-center w-11 h-11 rounded-full border transition-colors ${
                isActive
                  ? 'border-[var(--ios-blue)] bg-[var(--ios-blue)]/15 text-white'
                  : hasValue
                    ? 'border-[var(--ios-blue)]/40 bg-white/10 text-white'
                    : 'border-white/10 bg-white/[0.06] text-white/55 hover:bg-white/10 hover:text-white/80'
              }`}
            >
              <Icon size={20} />
            </button>
          )
        })}
      </div>

      {activePlatform ? (
        <div className="mt-3 flex items-center gap-2">
          <span className="text-[15px] text-[var(--ios-label-secondary)] shrink-0">@</span>
          <input
            autoFocus
            value={socials[activePlatform.id] || ''}
            onChange={(e) => onChange({ ...socials, [activePlatform.id]: e.target.value })}
            placeholder={`${activePlatform.label} username`}
            className="flex-1 min-w-0 px-4 py-2.5 bg-[var(--ios-fill-tertiary)] rounded-full border border-white/10 outline-none focus:border-[var(--ios-blue)] text-[15px]"
            maxLength={80}
          />
        </div>
      ) : null}
    </div>
  )
}
