import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import { storage, auth } from '../firebase/config'

export const navGlassClass =
  'rounded-full border border-white/[0.08] bg-white/[0.05] shadow-[0_8px_32px_rgba(0,0,0,0.35),inset_0_1px_0_rgba(255,255,255,0.18)]'

export const navGlassMenuClass =
  'border border-white/[0.08] bg-white/[0.05] backdrop-blur-xl backdrop-saturate-[1.8] shadow-[0_8px_32px_rgba(0,0,0,0.35),inset_0_1px_0_rgba(255,255,255,0.18)]'

/** Chat header ⋮ menu — darker glass so blur reads over message content */
export const headerMenuGlassClass =
  'border border-white/[0.08] bg-black/70 backdrop-blur-xl backdrop-saturate-[1.8] shadow-[0_8px_32px_rgba(0,0,0,0.45),inset_0_1px_0_rgba(255,255,255,0.15)]'

export const notificationGlassClass =
  'rounded-full border border-white/[0.08] bg-black/45 backdrop-blur-lg shadow-[0_8px_32px_rgba(0,0,0,0.35),inset_0_1px_0_rgba(255,255,255,0.18)]'

export const modalGlassClass =
  'rounded-2xl border border-white/[0.08] bg-white/[0.06] backdrop-blur-2xl backdrop-saturate-[1.8] shadow-[0_8px_32px_rgba(0,0,0,0.45),inset_0_1px_0_rgba(255,255,255,0.15)]'

export const navGlassInnerClass =
  'rounded-full border border-white/[0.18] bg-white/[0.12] backdrop-blur-xl backdrop-saturate-[1.8] shadow-[inset_0_1px_0_rgba(255,255,255,0.4),inset_0_-1px_0_rgba(255,255,255,0.08),0_2px_12px_rgba(0,0,0,0.15)]'

export const contextMenuMotion = {
  initial: { opacity: 0, scale: 0.95, y: -4 },
  animate: { opacity: 1, scale: 1, y: 0 },
  exit: { opacity: 0, scale: 0.95, y: -4, transition: { duration: 0.08 } },
  transition: { duration: 0.15 },
}

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
    return new Error('Photo upload denied. Deploy storage.rules and sign in again.')
  }
  if (code === 'storage/unknown' || code === 'storage/object-not-found' || error?.message?.includes('404')) {
    return new Error(
      'Firebase Storage is not set up. In Firebase Console open Storage, click Get started, then set VITE_FIREBASE_STORAGE_BUCKET to the bucket name shown there.'
    )
  }
  return new Error(error?.message || 'Upload failed')
}

export function formatMessagePreview(data = {}) {
  if (data.text) return data.text
  if (data.imageUrl) return '📷 Photo'
  if (data.audioUrl) return '🎤 Voice'
  return ''
}

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

export function formatChatTime(timestamp, militaryTime = false) {
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

export function formatMessageTime(timestamp, militaryTime = false) {
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

export function ageInRange(userAge, targetAge, gap = 5) {
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

export async function uploadChatAudio(userId, matchId, blob) {
  if (!auth.currentUser) {
    throw new Error('You must be signed in to send voice messages')
  }

  const bucket = import.meta.env.VITE_FIREBASE_STORAGE_BUCKET?.trim().replace(/^gs:\/\//, '')
  if (!bucket) {
    throw new Error('VITE_FIREBASE_STORAGE_BUCKET is not set in .env')
  }

  const ext = blob.type.includes('mp4') ? 'm4a' : blob.type.includes('ogg') ? 'ogg' : 'webm'
  const fileName = `${userId}_${Date.now()}.${ext}`
  const storageRef = ref(storage, `chat-voice/${matchId}/${fileName}`)

  try {
    await uploadBytes(storageRef, blob, { contentType: blob.type || 'audio/webm' })
    return getDownloadURL(storageRef)
  } catch (error) {
    throw storageSetupError(error)
  }
}

export function shareProfile(userId, username) {
  const url = `${window.location.origin}/profile/${userId}`
  if (navigator.share) {
    return navigator.share({ title: `${username} on ArvoliO`, url })
  }
  return navigator.clipboard.writeText(url)
}
