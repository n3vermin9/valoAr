import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import { Capacitor } from '@capacitor/core'
import { storage, auth } from '../firebase/config'

export const APP_NAME = 'valoAr'
export const APP_SLUG = 'valoar'
export const APP_AGE_MIN = 16
export const APP_AGE_MAX = 26
export const DISCOVER_AGE_GAP_DEFAULT = 3

export function reportBackgroundError(label, err) {
  if (!import.meta.env.DEV) return
  // Keep production quiet while still surfacing silent background failures during development.
  console.debug(label, err)
}

/** Map flaky Firebase / IndexedDB errors (esp. iOS Safari) to a clear toast. */
export function formatFirebaseError(err, fallback = 'Something went wrong') {
  const code = err?.code || ''
  const message = err?.message || fallback

  if (code === 'auth/unauthorized-domain' || /unauthorized-domain/i.test(message)) {
    return 'Firebase blocked this app URL. For iOS Simulator run: npm run cap:ios:sim'
  }
  if (code === 'auth/api-key-not-valid' || /api-key-not-valid/i.test(message)) {
    return 'Invalid Firebase API key — check your .env and restart npm run dev'
  }
  if (code === 'auth/network-request-failed' || /network-request-failed/i.test(message)) {
    if (Capacitor.isNativePlatform()) {
      return 'Network error on device — rebuild with npm run cap:ios:sim. If it persists, use an iOS 18.3 simulator or a physical phone (iOS 18.4+ simulators have a known Apple bug).'
    }
    return 'Network error — check your connection and that npm run dev is running'
  }
  if (
    /indexed database|IOS_INDEXEDDB|connection lost|client is offline|unavailable|Failed to get document/i.test(
      message
    )
  ) {
    return 'Couldn’t save — check your connection and try again'
  }
  return message
}

export {
  navGlassClass,
  navGlassInnerClass,
  navGlassMenuClass,
  headerMenuGlassClass,
  dropdownMenuItemClass,
  dropdownMenuItemDangerClass,
  dropdownMenuItemWithIconClass,
  dropdownMenuItemWithIconDangerClass,
  notificationGlassClass,
  modalGlassClass,
  modalScrimClass,
  glassNavBarClass,
  glassInputBarClass,
  glassActionButtonClass,
  dropdownMenuClass,
  contextMenuMotion,
  tapScaleClass,
  pageTitleClass,
  pageHeaderClass,
  listRowClass,
  listRowSelectedClass,
  textFieldClass,
  btnFilledClass,
  btnFilledDangerClass,
  btnBorderedClass,
  btnPlainClass,
  iconButtonClass,
} from './designSystem'

function dataUrlToBlob(dataUrl) {
  const [header, base64] = dataUrl.split(',')
  const mime = header.match(/:(.*?);/)?.[1] || 'image/jpeg'
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return new Blob([bytes], { type: mime })
}

function storageSetupError(error) {
  const code = error?.code || ''
  if (code === 'storage/unauthorized') {
    return new Error('Upload denied. Deploy storage.rules (firebase deploy --only storage) and sign in again.')
  }
  if (code === 'storage/unknown' || code === 'storage/object-not-found' || error?.message?.includes('404')) {
    return new Error(
      'Firebase Storage is not set up. In Firebase Console open Storage, click Get started, then set VITE_FIREBASE_STORAGE_BUCKET to the bucket name shown there.'
    )
  }
  return new Error(error?.message || 'Upload failed')
}

export function formatMessagePreview(data = {}) {
  if (data.type === 'system' || data.systemEvent) return data.text || ''
  if (data.storyReply && data.text) return `replied to story: ${data.text}`
  if (data.text) return data.text
  if (data.imageUrl) return '📷 Photo'
  if (data.audioUrl) return 'Voice message'
  return ''
}

export function getMessagePreviewText(message = {}) {
  if (message.type === 'system' || message.systemEvent) return message.text || ''
  if (message.text) return message.text
  if (message.imageUrl) return 'Photo'
  if (message.audioUrl) return 'Voice message'
  return 'Message'
}

export function buildReplyPayload(message) {
  if (!message?.id) return null
  return {
    id: message.id,
    senderId: message.senderId,
    text: message.text || null,
    imageUrl: message.imageUrl || null,
    audioUrl: message.audioUrl || null,
  }
}

export function getChatStatusLabel({ isTyping, presence }) {
  if (isTyping) return { text: 'typing…', variant: 'typing' }
  if (presence?.online) return { text: 'online', variant: 'online' }
  if (presence?.lastSeen) {
    return { text: `last seen ${formatLastSeen(presence.lastSeen)}`, variant: 'offline' }
  }
  return { text: 'offline', variant: 'offline' }
}

export const MESSAGE_REACTIONS = ['❤️', '😂', '👍', '😮', '😢', '🔥']

export function getVoiceMimeType() {
  const types = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg']
  return types.find((type) => MediaRecorder.isTypeSupported(type)) || ''
}

export function getMatchId(uid1, uid2) {
  return [uid1, uid2].sort().join('_')
}

export function getSavedMessagesChatId(userId) {
  return `saved_${userId}`
}

export function isSavedMessagesChat(chatOrId, userId) {
  if (!userId) return false
  if (typeof chatOrId === 'string') return chatOrId === getSavedMessagesChatId(userId)
  return chatOrId?.isSavedMessages === true || chatOrId?.id === getSavedMessagesChatId(userId)
}

export function isRemovedChatOpponent(chat, otherUserId, otherUser, userLoaded = true) {
  if (!otherUserId || chat?.isSavedMessages) return false
  if (chat?.opponentRemoved === true) return true
  if (chat?.removedUsers?.[otherUserId]) return true
  if (!userLoaded) return false
  return otherUser === null
}

export function getRemovedChatUsername(chat, otherUserId, fallback = 'User') {
  if (!otherUserId) return fallback
  const removed = chat?.removedUsers?.[otherUserId]
  if (typeof removed === 'string' && removed) return removed
  if (removed?.username) return removed.username
  return fallback
}

export function validateUsername(username) {
  if (!username || username.length < 4 || username.length > 20) {
    return 'Username must be 4-20 characters'
  }
  if (!/^[a-z0-9]+$/.test(username)) {
    return 'Only lowercase letters and numbers allowed'
  }
  return null
}

export function normalizeUsername(value = '') {
  return value.toLowerCase().trim().replace(/^@+/, '').replace(/[^a-z0-9]/g, '')
}

export function buildUsernameBase(value = '') {
  const cleaned = normalizeUsername(value).slice(0, 20)
  if (cleaned.length >= 4) return cleaned
  return `${cleaned}user`.slice(0, 20)
}

export function formatGenderLabel(gender) {
  if (gender === 'male') return 'Boy'
  if (gender === 'female') return 'Girl'
  return '—'
}

export function formatLastSeen(timestamp) {
  if (!timestamp) return 'offline'
  const ms = typeof timestamp === 'number' ? timestamp : timestamp.toMillis?.() ?? Date.now()
  const diff = Date.now() - ms
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

export function usesMilitaryTime(profile) {
  // 24h is default until the user opts into 12h in settings.
  return profile?.useMilitaryTime !== false
}

export function formatAppDateTime(
  value,
  {
    militaryTime = true,
    weekday = 'short',
    month = 'short',
    day = 'numeric',
    includeDate = true,
  } = {}
) {
  if (!value) return ''
  const date = value?.toDate?.() ?? new Date(typeof value === 'number' ? value : value)
  if (Number.isNaN(date.getTime())) return ''
  const timeOpts = militaryTime
    ? { hour: '2-digit', minute: '2-digit', hour12: false }
    : { hour: 'numeric', minute: '2-digit', hour12: true }
  if (!includeDate) return date.toLocaleTimeString(undefined, timeOpts)
  return date.toLocaleString(undefined, {
    ...(weekday ? { weekday } : {}),
    ...(month ? { month } : {}),
    ...(day ? { day } : {}),
    ...timeOpts,
  })
}

export function formatChatTime(timestamp, militaryTime = true) {
  if (!timestamp) return ''
  const date = timestamp.toDate?.() ?? new Date(timestamp)
  const now = new Date()
  const timeOpts = militaryTime
    ? { hour: '2-digit', minute: '2-digit', hour12: false }
    : { hour: 'numeric', minute: '2-digit' }
  const isToday =
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear()

  const yesterday = new Date(now)
  yesterday.setDate(yesterday.getDate() - 1)
  const isYesterday =
    date.getDate() === yesterday.getDate() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getFullYear() === yesterday.getFullYear()

  if (isToday) {
    return date.toLocaleTimeString([], timeOpts)
  }
  if (isYesterday) return 'Yesterday'
  if (now - date < 7 * 24 * 60 * 60 * 1000) {
    return date.toLocaleDateString([], { weekday: 'short' })
  }
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' })
}

export function formatMessageTime(timestamp, militaryTime = true) {
  if (!timestamp) return ''
  const date = timestamp.toDate?.() ?? new Date(timestamp)
  const timeOpts = militaryTime
    ? { hour: '2-digit', minute: '2-digit', hour12: false }
    : { hour: 'numeric', minute: '2-digit' }
  return date.toLocaleTimeString([], timeOpts)
}

export function genderMatchesPreference(userGender, interestedIn) {
  if (interestedIn === 'both') return true
  if (interestedIn === 'men') return userGender === 'male'
  if (interestedIn === 'women') return userGender === 'female'
  return true
}

export function ageInRange(userAge, targetAge, gap = DISCOVER_AGE_GAP_DEFAULT) {
  return Math.abs(userAge - targetAge) <= gap
}

export function compressImage(file, maxSizeMB = 5) {
  return new Promise((resolve, reject) => {
    if (file.size > maxSizeMB * 1024 * 1024) {
      reject(new Error(`Image must be under ${maxSizeMB}MB`))
      return
    }
    const reader = new FileReader()
    reader.onload = (e) => resolve(e.target.result)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

const lowQualityImageCache = new Map()

/** Downscale a remote/data image for lightweight UI surfaces (chat cards, etc.). */
export function getLowQualityImageSrc(url, { maxWidth = 420, quality = 0.52 } = {}) {
  if (!url) return Promise.resolve('')
  const cacheKey = `${url}|${maxWidth}|${quality}`
  if (lowQualityImageCache.has(cacheKey)) {
    return Promise.resolve(lowQualityImageCache.get(cacheKey))
  }

  return new Promise((resolve) => {
    const img = new Image()
    img.decoding = 'async'
    img.referrerPolicy = 'no-referrer'
    // Allows canvas export when the host sends CORS headers.
    img.crossOrigin = 'anonymous'

    const finish = (src) => {
      lowQualityImageCache.set(cacheKey, src)
      resolve(src)
    }

    img.onload = () => {
      try {
        const naturalW = img.naturalWidth || maxWidth
        const naturalH = img.naturalHeight || maxWidth
        const scale = Math.min(1, maxWidth / naturalW)
        const width = Math.max(1, Math.round(naturalW * scale))
        const height = Math.max(1, Math.round(naturalH * scale))
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d', { alpha: false })
        if (!ctx) {
          finish(url)
          return
        }
        ctx.drawImage(img, 0, 0, width, height)
        finish(canvas.toDataURL('image/jpeg', quality))
      } catch {
        finish(url)
      }
    }
    img.onerror = () => finish(url)
    img.src = url
  })
}

export async function uploadChatImage(userId, matchId, base64Image) {
  if (!auth.currentUser) {
    throw new Error('You must be signed in to send photos')
  }

  const bucket = import.meta.env.VITE_FIREBASE_STORAGE_BUCKET?.trim().replace(/^gs:\/\//, '')
  if (!bucket) {
    throw new Error('VITE_FIREBASE_STORAGE_BUCKET is not set in .env')
  }

  const blob = dataUrlToBlob(base64Image)
  const ext = blob.type === 'image/png' ? 'png' : 'jpg'
  const fileName = `${userId}_${Date.now()}.${ext}`
  const storageRef = ref(storage, `chat-images/${matchId}/${fileName}`)

  try {
    await uploadBytes(storageRef, blob, { contentType: blob.type })
    return getDownloadURL(storageRef)
  } catch (error) {
    throw storageSetupError(error)
  }
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(new Error('Failed to encode voice message'))
    reader.readAsDataURL(blob)
  })
}

function withTimeout(promise, ms, message) {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error(message)), ms)
    }),
  ])
}

async function uploadChatAudioToStorage(userId, matchId, blob) {
  const ext = blob.type.includes('mp4') ? 'm4a' : blob.type.includes('ogg') ? 'ogg' : 'webm'
  const fileName = `${userId}_${Date.now()}.${ext}`
  const storageRef = ref(storage, `chat-voice/${matchId}/${fileName}`)
  const contentType = (blob.type || 'audio/webm').split(';')[0]

  return withTimeout(
    (async () => {
      await uploadBytes(storageRef, blob, { contentType })
      return getDownloadURL(storageRef)
    })(),
    20000,
    'Voice upload timed out'
  )
}

export async function uploadChatAudio(userId, matchId, blob) {
  if (!auth.currentUser) {
    throw new Error('You must be signed in to send voice messages')
  }

  const MAX_INLINE_AUDIO_BYTES = 700_000

  if (blob.size <= MAX_INLINE_AUDIO_BYTES) {
    return withTimeout(blobToDataUrl(blob), 10000, 'Encoding voice message timed out')
  }

  const bucket = import.meta.env.VITE_FIREBASE_STORAGE_BUCKET?.trim().replace(/^gs:\/\//, '')
  if (!bucket) {
    throw new Error('Recording is too large. Set up Firebase Storage or record a shorter message.')
  }

  try {
    return await uploadChatAudioToStorage(userId, matchId, blob)
  } catch (error) {
    throw storageSetupError(error)
  }
}

export function shareProfile(userId, username) {
  const url = `${window.location.origin}/profile/${userId}`
  if (navigator.share) {
    return navigator.share({ title: `${username} on ${APP_NAME}`, url })
  }
  return navigator.clipboard.writeText(url)
}
