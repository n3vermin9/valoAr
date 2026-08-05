export const APPEARANCE_STORAGE_KEY = 'valoAr.appearance'
export const APPEARANCE_OPTIONS = ['light', 'dark', 'system']

const THEME_COLORS = {
  light: '#f2f2f7',
  dark: '#000000',
}

/** @returns {'light' | 'dark' | 'system'} */
export function normalizeAppearance(value) {
  if (value === 'light' || value === 'dark' || value === 'system') return value
  return 'system'
}

export function getStoredAppearance() {
  try {
    return normalizeAppearance(localStorage.getItem(APPEARANCE_STORAGE_KEY))
  } catch {
    return 'system'
  }
}

export function prefersDarkScheme() {
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

/** @returns {'light' | 'dark'} */
export function resolveAppearance(preference = 'system') {
  const pref = normalizeAppearance(preference)
  if (pref === 'light' || pref === 'dark') return pref
  return prefersDarkScheme() ? 'dark' : 'light'
}

function setThemeColorMeta(resolved) {
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) meta.setAttribute('content', THEME_COLORS[resolved] || THEME_COLORS.dark)
}

/**
 * Apply appearance to <html> and mirror to localStorage.
 * @param {'light' | 'dark' | 'system'} preference
 */
export function applyAppearance(preference = 'system') {
  const pref = normalizeAppearance(preference)
  const resolved = resolveAppearance(pref)
  const root = document.documentElement
  root.classList.toggle('theme-light', resolved === 'light')
  root.classList.toggle('theme-dark', resolved === 'dark')
  setThemeColorMeta(resolved)
  try {
    localStorage.setItem(APPEARANCE_STORAGE_KEY, pref)
  } catch {
    /* ignore quota / private mode */
  }
  return resolved
}

/** Boot from localStorage before React paints. */
export function bootAppearance() {
  return applyAppearance(getStoredAppearance())
}

/**
 * Keep system preference in sync while the user has chosen "system".
 * @returns {() => void} unsubscribe
 */
export function subscribeSystemAppearance(getPreference) {
  const mq = window.matchMedia('(prefers-color-scheme: dark)')
  const onChange = () => {
    if (normalizeAppearance(getPreference()) === 'system') applyAppearance('system')
  }
  mq.addEventListener('change', onChange)
  return () => mq.removeEventListener('change', onChange)
}
