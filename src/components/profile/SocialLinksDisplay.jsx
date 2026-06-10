import { SOCIAL_PLATFORMS, getSocialHref, formatSocialLabel, hasSocialLinks, normalizeSocials } from '../../utils/socialLinks'
import { TelegramIcon, InstagramIcon, TikTokIcon } from './SocialIcons'

const SOCIAL_ICONS = {
  telegram: TelegramIcon,
  instagram: InstagramIcon,
  tiktok: TikTokIcon,
}

const iconButtonClass =
  'inline-flex items-center justify-center w-10 h-10 rounded-full bg-white/10 border border-white/10 text-white/85 hover:bg-white/15 hover:text-white transition-colors'

export default function SocialLinksDisplay({ socials: rawSocials, compact = false, visible = true }) {
  if (!visible) return null
  const socials = normalizeSocials(rawSocials)
  if (!hasSocialLinks(socials)) return null

  const buttonClass = compact
    ? 'inline-flex items-center justify-center w-8 h-8 rounded-full bg-white/10 border border-white/10 text-white/85 hover:bg-white/15 hover:text-white transition-colors'
    : iconButtonClass

  return (
    <div className={compact ? 'mt-2.5' : 'mt-4 pt-4 border-t border-white/10 text-center'}>
      <div className={`flex flex-wrap gap-2 ${compact ? '' : 'justify-center'}`}>
        {SOCIAL_PLATFORMS.map(({ id, label }) => {
          const value = socials[id]
          if (!value) return null
          const href = getSocialHref(id, value)
          const Icon = SOCIAL_ICONS[id]
          const title = `${label} · ${formatSocialLabel(id, value)}`
          const iconSize = compact ? 16 : 20
          const iconClassName = id === 'telegram' ? 'mr-1 block shrink-0' : 'block shrink-0'

          if (href) {
            return (
              <a
                key={id}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className={buttonClass}
                aria-label={title}
                title={title}
              >
                <Icon size={iconSize} className={iconClassName} />
              </a>
            )
          }

          return (
            <span key={id} className={buttonClass} title={title} aria-label={title}>
              <Icon size={iconSize} className={iconClassName} />
            </span>
          )
        })}
      </div>
    </div>
  )
}
