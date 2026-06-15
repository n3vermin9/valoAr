import { normalizeUsername } from './helpers'

const VERIFIED_USERNAMES = new Set(['durov'])

export function isVerifiedUsername(username) {
  if (!username) return false
  return VERIFIED_USERNAMES.has(normalizeUsername(username))
}
