/**
 * Returns an in-app route for same-origin URLs, or null for external links.
 */
export function parseInAppRoute(href) {
  if (!href || typeof href !== 'string') return null

  const origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost'
  let url
  try {
    url = new URL(href, origin)
  } catch {
    return null
  }

  if (url.origin !== origin) return null

  const path = url.pathname.replace(/\/+$/, '') || '/'

  const profileMatch = path.match(/^\/profile\/([^/]+)$/)
  if (profileMatch) return { to: `/profile/${profileMatch[1]}` }

  const joinMatch = path.match(/^\/join\/([^/]+)$/)
  if (joinMatch) return { to: `/join/${joinMatch[1]}` }

  const chatMatch = path.match(/^\/chats\/([^/]+)$/)
  if (chatMatch) return { to: `/chats/${chatMatch[1]}` }

  const groupMatch = path.match(/^\/groups\/([^/]+)$/)
  if (groupMatch) return { to: `/groups/${groupMatch[1]}` }

  const groupSettingsMatch = path.match(/^\/groups\/([^/]+)\/settings$/)
  if (groupSettingsMatch) return { to: `/groups/${groupSettingsMatch[1]}/settings` }

  if (['/discover', '/chats', '/liked', '/inbox', '/profile', '/setup'].includes(path)) {
    return { to: path }
  }

  return null
}
