export const EVENT_PLACES = [
  { id: 'cafe-1', name: 'Corner Café', type: 'cafe', emoji: '☕', offset: [0.004, 0.003] },
  { id: 'park-1', name: 'City Park', type: 'park', emoji: '🌳', offset: [-0.003, 0.005] },
  { id: 'bar-1', name: 'Riverside Bar', type: 'bar', emoji: '🍹', offset: [0.002, -0.004] },
  { id: 'cafe-2', name: 'Book & Brew', type: 'cafe', emoji: '📚', offset: [-0.005, -0.002] },
  { id: 'park-2', name: 'Sunset Square', type: 'park', emoji: '🌅', offset: [0.006, -0.001] },
]

export const PLACE_TYPES = [
  { id: 'cafe', label: 'Café', emoji: '☕' },
  { id: 'park', label: 'Park', emoji: '🌳' },
  { id: 'bar', label: 'Bar', emoji: '🍹' },
  { id: 'food', label: 'Food', emoji: '🍽️' },
  { id: 'music', label: 'Music', emoji: '🎵' },
  { id: 'sport', label: 'Sport', emoji: '⚽' },
  { id: 'other', label: 'Other', emoji: '📍' },
]

export function getPlaceTypeEmoji(typeId) {
  return PLACE_TYPES.find((t) => t.id === typeId)?.emoji || '📍'
}

export function getDefaultSeedPlaces(center) {
  return EVENT_PLACES.map((place) => ({
    name: place.name,
    type: place.type,
    emoji: place.emoji,
    lat: center[0] + place.offset[0],
    lng: center[1] + place.offset[1],
  }))
}

// Local, read-only places shown when Firestore has none yet (or is unreadable),
// so the map is never empty for default users.
export function getFallbackPlaces(center) {
  return EVENT_PLACES.map((place) => ({
    id: `local-${place.id}`,
    name: place.name,
    type: place.type,
    emoji: place.emoji,
    subplaces: [],
    isLocal: true,
    lat: center[0] + place.offset[0],
    lng: center[1] + place.offset[1],
  }))
}

const PLACEHOLDER_USERS = [
  { id: 'placeholder-1', username: 'alex', age: 22, isPlaceholder: true, isFriend: true },
  { id: 'placeholder-2', username: 'sam', age: 20, isPlaceholder: true },
  { id: 'placeholder-3', username: 'jordan', age: 24, isPlaceholder: true, isFriend: true },
  { id: 'placeholder-4', username: 'riley', age: 21, isPlaceholder: true },
  { id: 'placeholder-5', username: 'casey', age: 23, isPlaceholder: true },
]

const USER_OFFSETS = [
  [0.002, 0.0015],
  [-0.0015, 0.0025],
  [0.003, -0.002],
  [-0.0025, -0.003],
  [0.001, 0.004],
  [0.004, 0.001],
  [-0.003, 0.001],
  [0.0025, -0.0035],
  [-0.004, 0.0035],
  [0.005, 0.002],
  [-0.001, -0.004],
  [0.0015, -0.005],
  [-0.005, -0.001],
  [0.0045, -0.0025],
  [-0.0035, 0.004],
  [0.006, -0.003],
]

function offsetPosition(center, offset) {
  return [center[0] + offset[0], center[1] + offset[1]]
}

export function scatterUsersAroundCenter(center, profiles = [], friendIds = []) {
  if (profiles.length === 0) return []
  const friendSet = new Set(friendIds)
  const friends = []
  const others = []
  for (const profile of profiles) {
    if (!profile?.id) continue
    if (profile.isFriend === true || friendSet.has(profile.id)) friends.push(profile)
    else others.push(profile)
  }
  const ordered = [...friends, ...others].slice(0, 16)
  return ordered.map((profile, index) => ({
    id: profile.id,
    profile,
    photo: profile.photos?.[0] || null,
    isFriend: profile.isFriend === true || friendSet.has(profile.id),
    position: offsetPosition(center, USER_OFFSETS[index % USER_OFFSETS.length]),
  }))
}

const MAP_SETTINGS_KEY = 'discoverMapSettings'

export const DEFAULT_MAP_SETTINGS = { display: 'both', show: 'everyone', theme: 'dark' }

const LEGACY_THEME_MAP = {
  voyager: 'labeled',
  light_all: 'light',
  dark_all: 'dark',
}

/** Until the user picks a map theme, tiles follow the app appearance. */
function getDefaultMapSettings() {
  const light =
    typeof document !== 'undefined' &&
    document.documentElement.classList.contains('theme-light')
  return { ...DEFAULT_MAP_SETTINGS, theme: light ? 'light' : 'dark' }
}

export function loadMapSettings() {
  const defaults = getDefaultMapSettings()
  try {
    const raw = localStorage.getItem(MAP_SETTINGS_KEY)
    if (!raw) return defaults
    const parsed = { ...defaults, ...JSON.parse(raw) }
    if (LEGACY_THEME_MAP[parsed.theme]) {
      parsed.theme = LEGACY_THEME_MAP[parsed.theme]
    }
    if (!parsed.themeChosen) {
      parsed.theme = defaults.theme
    }
    return parsed
  } catch {
    return defaults
  }
}

export function saveMapSettings(settings) {
  try {
    localStorage.setItem(MAP_SETTINGS_KEY, JSON.stringify(settings))
  } catch {
    // ignore persistence errors (e.g. private mode)
  }
}

export function getEventPlacesAroundCenter(center) {
  return EVENT_PLACES.map((place) => ({
    ...place,
    position: offsetPosition(center, place.offset),
  }))
}
