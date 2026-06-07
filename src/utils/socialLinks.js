export const SOCIAL_PLATFORMS = [
  { id: 'telegram', label: 'Telegram', host: 't.me' },
  { id: 'instagram', label: 'Instagram', host: 'instagram.com' },
  { id: 'tiktok', label: 'TikTok', host: 'tiktok.com' },
]

const DEFAULT_SOCIALS = { telegram: '', instagram: '', tiktok: '' }

export function normalizeSocials(raw = {}) {
  const next = { ...DEFAULT_SOCIALS }
  for (const { id } of SOCIAL_PLATFORMS) {
    next[id] = (raw[id] || '').trim()
  }
  return next
}

export function hasSocialLinks(socials) {
  return SOCIAL_PLATFORMS.some(({ id }) => Boolean(socials?.[id]?.trim()))
}

function stripAt(value) {
  return value.replace(/^@+/, '').trim()
}

export function getSocialHref(platformId, value) {
  const trimmed = (value || '').trim()
  if (!trimmed) return null

  if (/^https?:\/\//i.test(trimmed)) return trimmed

  const handle = stripAt(trimmed)

  switch (platformId) {
    case 'telegram':
      return `https://t.me/${handle}`
    case 'instagram':
      return `https://instagram.com/${handle}`
    case 'tiktok':
      return `https://tiktok.com/@${handle}`
    default:
      return null
  }
}

export function formatSocialLabel(platformId, value) {
  const trimmed = (value || '').trim()
  if (!trimmed) return ''
  return `@${stripAt(trimmed)}`
}
