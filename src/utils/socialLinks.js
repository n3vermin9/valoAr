export const SOCIAL_PLATFORMS = [
  { id: 'telegram', label: 'Telegram', host: 't.me' },
  { id: 'instagram', label: 'Instagram', host: 'instagram.com' },
  { id: 'tiktok', label: 'TikTok', host: 'tiktok.com' },
]

const DEFAULT_SOCIALS = { telegram: '', instagram: '', tiktok: '' }

export const EMPTY_SOCIALS = { ...DEFAULT_SOCIALS }

/** True when viewer and target are friends (mutual match). */
export function isFriendsWith(viewerProfile, targetUserId) {
  if (!viewerProfile || !targetUserId) return false
  if (viewerProfile.id === targetUserId) return true
  return Array.isArray(viewerProfile.matches) && viewerProfile.matches.includes(targetUserId)
}

export function stripSocials(profile) {
  if (!profile) return profile
  return { ...profile, socials: normalizeSocials(EMPTY_SOCIALS) }
}

export function sanitizeProfileSocials(profile, viewerProfile) {
  if (!profile) return profile
  if (isFriendsWith(viewerProfile, profile.id)) return profile
  return stripSocials(profile)
}

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
