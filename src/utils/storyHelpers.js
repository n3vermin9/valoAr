export const STORY_TTL_MS = 24 * 60 * 60 * 1000
export const MAX_STORY_LENGTH = 280
export const MAX_STORIES_PER_USER = 5
export const STORY_DURATION_MS = 6000
export const MAX_STORY_REPLY_LENGTH = 200

export const STORY_PRIVACY = {
  FRIENDS: 'friends',
  ALL: 'all',
}

export const STORY_COLORS = [
  {
    id: 'violet',
    className: 'bg-gradient-to-br from-violet-600 via-purple-700 to-indigo-900',
    quoteClassName: 'bg-gradient-to-br from-violet-600/45 via-purple-700/45 to-indigo-900/45',
  },
  {
    id: 'blue',
    className: 'bg-gradient-to-br from-blue-600 via-sky-700 to-cyan-900',
    quoteClassName: 'bg-gradient-to-br from-blue-600/45 via-sky-700/45 to-cyan-900/45',
  },
  {
    id: 'rose',
    className: 'bg-gradient-to-br from-rose-600 via-pink-700 to-red-900',
    quoteClassName: 'bg-gradient-to-br from-rose-600/45 via-pink-700/45 to-red-900/45',
  },
  {
    id: 'amber',
    className: 'bg-gradient-to-br from-amber-500 via-orange-600 to-red-800',
    quoteClassName: 'bg-gradient-to-br from-amber-500/45 via-orange-600/45 to-red-800/45',
  },
  {
    id: 'emerald',
    className: 'bg-gradient-to-br from-emerald-600 via-teal-700 to-green-900',
    quoteClassName: 'bg-gradient-to-br from-emerald-600/45 via-teal-700/45 to-green-900/45',
  },
  {
    id: 'slate',
    className: 'bg-gradient-to-br from-slate-600 via-zinc-700 to-neutral-900',
    quoteClassName: 'bg-gradient-to-br from-slate-600/45 via-zinc-700/45 to-neutral-900/45',
  },
]

export function toTimestampMs(value) {
  if (value == null) return 0
  if (typeof value === 'number') return value
  if (typeof value.toMillis === 'function') return value.toMillis()
  if (typeof value.toDate === 'function') return value.toDate().getTime()
  if (typeof value === 'string') {
    const parsed = Date.parse(value)
    return Number.isNaN(parsed) ? 0 : parsed
  }
  if (typeof value.seconds === 'number') {
    return value.seconds * 1000 + (value.nanoseconds ?? 0) / 1e6
  }
  return 0
}

export function storyCreatedMs(story) {
  return toTimestampMs(story?.createdAt)
}

export function isStoryActive(story, now = Date.now()) {
  const created = storyCreatedMs(story)
  if (!created) return false
  if (now - created >= STORY_TTL_MS) return false
  if (isMeetupStory(story)) {
    const meetupExpiresAt = toTimestampMs(story.meetupExpiresAt)
    if (meetupExpiresAt && meetupExpiresAt <= now) return false
  }
  return true
}

export function getStoryColorClass(colorId) {
  return STORY_COLORS.find((c) => c.id === colorId)?.className || STORY_COLORS[0].className
}

export function getStoryReplyQuoteColorClass(colorId) {
  const entry = STORY_COLORS.find((c) => c.id === colorId) || STORY_COLORS[0]
  return entry.quoteClassName || entry.className
}

export function hasUnseenStories(stories, viewedAtMs = 0) {
  if (!stories?.length) return false
  const latest = Math.max(...stories.map(storyCreatedMs))
  return latest > viewedAtMs
}

export function getFirstUnseenStoryIndex(stories, viewedAtMs = 0) {
  if (!stories?.length) return 0
  const index = stories.findIndex((story) => storyCreatedMs(story) > viewedAtMs)
  return index >= 0 ? index : 0
}

export function filterStoriesForViewer(
  stories,
  { viewerId, ownerId, friendIds = [], allowPublicFromNonFriends = true } = {}
) {
  if (!stories?.length) return []
  const isOwn = viewerId === ownerId
  const isFriend = friendIds.includes(ownerId)
  return stories.filter((story) => {
    if (!isStoryActive(story)) return false
    if (isOwn) return true
    const privacy = story.privacy || STORY_PRIVACY.FRIENDS
    if (privacy === STORY_PRIVACY.ALL) return allowPublicFromNonFriends || isFriend
    return isFriend
  })
}

export function formatMeetupCountdown(expiresAtMs, now = Date.now()) {
  const diff = expiresAtMs - now
  if (!expiresAtMs || diff <= 0) return 'Ended'
  const hours = Math.floor(diff / 3600000)
  const minutes = Math.floor((diff % 3600000) / 60000)
  const seconds = Math.floor((diff % 60000) / 1000)
  if (hours > 0) return `${hours}h ${minutes}m left`
  if (minutes > 0) return `${minutes}m ${seconds}s left`
  return `${seconds}s left`
}

export function formatMeetupStoryTimer(expiresAtMs, now = Date.now()) {
  const diff = expiresAtMs - now
  if (!expiresAtMs || diff <= 0) return 'Ended'
  const totalSeconds = Math.floor(diff / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  const pad = (value) => String(value).padStart(2, '0')
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`
}

export function isMeetupStory(story) {
  return story?.storyKind === 'meetup' && Boolean(story?.meetupId)
}

export function parseMeetupStoryContent(story, meetupData = null, { militaryTime = true } = {}) {
  if (meetupData) {
    const venue = meetupData.subplaceName
      ? `${meetupData.placeName} · ${meetupData.subplaceName}`
      : meetupData.placeName || ''
    const startMs = toTimestampMs(meetupData.startAt)
    const startLabel = startMs
      ? new Date(startMs).toLocaleString(undefined, {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          hour12: !militaryTime,
        })
      : ''
    return {
      title: meetupData.title || 'Meetup',
      venue,
      time: startLabel,
      description: (meetupData.description || '').trim(),
    }
  }

  const lines = (story?.text || '').split('\n')
  const titleLine = lines[0]?.trim() || ''
  const title = titleLine.startsWith('📍 ') ? titleLine.slice(2) : titleLine || 'Meetup'
  const venue = lines[1]?.trim() || ''
  const timeLine = lines[2]?.trim() || ''
  const time = timeLine.startsWith('🕐 ') ? timeLine.slice(2) : timeLine
  const description = lines.slice(3).join('\n').trim()

  return { title, venue, time, description }
}

export function getMeetupMapCoords(story, meetupData = null) {
  const lat = meetupData?.placeLat ?? story?.meetupPlaceLat
  const lng = meetupData?.placeLng ?? story?.meetupPlaceLng
  if (typeof lat === 'number' && typeof lng === 'number') return { lat, lng }
  return null
}

const MEETUP_MAP_TILE_SIZE = 256
const MEETUP_MAP_TILE_URL =
  'https://a.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png'
const preloadedMeetupTiles = new Set()

function meetupTileUrl(zoom, x, y) {
  return MEETUP_MAP_TILE_URL.replace('{z}', String(zoom))
    .replace('{x}', String(x))
    .replace('{y}', String(y))
}

export function getMeetupMapTiles(lat, lng, zoom = 16) {
  const n = 2 ** zoom
  const xFloat = ((lng + 180) / 360) * n
  const latRad = (lat * Math.PI) / 180
  const yFloat = ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n
  const centerTileX = Math.floor(xFloat)
  const centerTileY = Math.floor(yFloat)
  const pinGridX = MEETUP_MAP_TILE_SIZE + (xFloat - centerTileX) * MEETUP_MAP_TILE_SIZE
  const pinGridY = MEETUP_MAP_TILE_SIZE + (yFloat - centerTileY) * MEETUP_MAP_TILE_SIZE

  const tiles = []
  for (let row = -1; row <= 1; row++) {
    for (let col = -1; col <= 1; col++) {
      const x = centerTileX + col
      const y = centerTileY + row
      tiles.push({
        key: `${x}-${y}`,
        url: meetupTileUrl(zoom, x, y),
      })
    }
  }

  return {
    tiles,
    pinGridX,
    pinGridY,
    gridSize: MEETUP_MAP_TILE_SIZE * 3,
  }
}

export function preloadMeetupMapTiles(lat, lng, zoom = 16) {
  const { tiles } = getMeetupMapTiles(lat, lng, zoom)
  tiles.forEach((tile) => {
    if (preloadedMeetupTiles.has(tile.url)) return
    preloadedMeetupTiles.add(tile.url)
    const img = new Image()
    img.decoding = 'async'
    img.src = tile.url
  })
}

/** @deprecated use getMeetupMapTiles */
export function getMeetupTilePreview(lat, lng, zoom = 15) {
  const n = 2 ** zoom
  const xFloat = ((lng + 180) / 360) * n
  const latRad = (lat * Math.PI) / 180
  const yFloat = ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n
  const tileX = Math.floor(xFloat)
  const tileY = Math.floor(yFloat)
  const pinX = (xFloat - tileX) * 100
  const pinY = (yFloat - tileY) * 100
  return {
    url: meetupTileUrl(zoom, tileX, tileY),
    pinX,
    pinY,
  }
}

export function formatStoryTime(ms) {
  if (!ms) return ''
  const diff = Math.max(0, Date.now() - ms)
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return 'Expired'
}

export function formatStoryViewTime(ms) {
  if (!ms) return ''
  const diff = Date.now() - ms
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  return `${hours}h ago`
}

export function buildStoryShareText(story, ownerUsername) {
  const snippet = story.text?.length > 80 ? `${story.text.slice(0, 80)}…` : story.text
  return `${ownerUsername}'s story on valoAr:\n"${snippet}"`
}

const LEGACY_STORY_REPLY_RE = /^📖 Replied to your story "(.*)": (.*)$/s

export function parseLegacyStoryReplyText(text) {
  if (!text) return null
  const match = text.match(LEGACY_STORY_REPLY_RE)
  if (!match) return null
  return { storyText: match[1], replyText: match[2] }
}

export function getStoryReplyDisplay(message = {}) {
  if (message.storyReply) {
    return { storyReply: message.storyReply, text: message.text || '' }
  }
  const legacy = parseLegacyStoryReplyText(message.text)
  if (legacy) {
    return {
      storyReply: {
        text: legacy.storyText,
        color: 'slate',
        ownerUsername: null,
      },
      text: legacy.replyText,
    }
  }
  return { storyReply: null, text: message.text || '' }
}

export function getStoryRingState(stories, viewedAtMs, { isOwn = false } = {}) {
  const hasStories = stories.length > 0
  const unseen = !isOwn && hasStories && hasUnseenStories(stories, viewedAtMs)
  const seen = !isOwn && hasStories && !unseen
  const initialStoryIndex = isOwn ? 0 : getFirstUnseenStoryIndex(stories, viewedAtMs)
  return { hasStories, unseen, seen, initialStoryIndex }
}

export function getStoryReplySnippet(text, maxLen = 80) {
  if (!text) return ''
  let cleaned = text
  if (text.includes('story on valoAr:')) {
    const quoted = text.match(/"([^"]*)"/)
    if (quoted) cleaned = quoted[1]
  }
  return cleaned.length > maxLen ? `${cleaned.slice(0, maxLen)}…` : cleaned
}

export function storyOpenOriginFromRect(rect) {
  if (!rect) return null
  return {
    x: rect.left,
    y: rect.top,
    width: rect.width,
    height: rect.height,
  }
}

export function getStoryOpenMotion(origin) {
  const w = window.innerWidth
  const h = window.innerHeight

  if (!origin) {
    return { transformOrigin: '50% 42%', initialScale: 0.14 }
  }

  const cx = origin.x + origin.width / 2
  const cy = origin.y + origin.height / 2
  const initialScale = Math.min(
    1,
    Math.max(origin.width / w, origin.height / h, 0.06)
  )

  return {
    transformOrigin: `${cx}px ${cy}px`,
    initialScale,
  }
}

export const storySlideVariants = {
  enter: ({ direction }) => ({
    x: `${direction * 100}%`,
    zIndex: direction === 1 ? 2 : 1,
  }),
  center: {
    x: '0%',
    zIndex: 1,
  },
  exit: ({ direction }) => ({
    x: `${-direction * 100}%`,
    zIndex: direction === 1 ? 1 : 2,
  }),
}

export const storyUserSlideTransition = {
  type: 'tween',
  duration: 0.22,
  ease: [0.32, 0.72, 0, 1],
}
