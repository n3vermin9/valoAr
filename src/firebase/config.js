import { Capacitor } from '@capacitor/core'
import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import {
  initializeFirestore,
  memoryLocalCache,
  persistentLocalCache,
  persistentMultipleTabManager,
} from 'firebase/firestore'
import { getDatabase } from 'firebase/database'
import { getStorage } from 'firebase/storage'

const storageBucket = import.meta.env.VITE_FIREBASE_STORAGE_BUCKET?.trim().replace(/^gs:\/\//, '')

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
}

/** iOS Safari / Capacitor WKWebView IndexedDB is flaky and surfaces as “connection lost”. */
function preferMemoryFirestoreCache() {
  if (typeof navigator === 'undefined') return false
  if (Capacitor.isNativePlatform()) return true
  const ua = navigator.userAgent || ''
  const iOS = /iP(hone|ad|od)/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
  const safari = /Safari/i.test(ua) && !/Chrome|Chromium|Edg|Firefox/i.test(ua)
  return iOS || safari
}

const app = initializeApp(firebaseConfig)
export const auth = getAuth(app)
export const db = initializeFirestore(
  app,
  preferMemoryFirestoreCache()
    ? { localCache: memoryLocalCache() }
    : { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) }
)
export const rtdb = getDatabase(app)
export const storage = storageBucket ? getStorage(app, `gs://${storageBucket}`) : getStorage(app)

export default app
