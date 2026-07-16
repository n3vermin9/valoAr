import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  writeBatch,
  getDocs,
} from 'firebase/firestore'
import { db } from '../firebase/config'

export function subscribeInbox(userId, callback, onError) {
  if (!userId) return () => {}

  const inboxRef = collection(db, 'users', userId, 'inbox')
  const q = query(inboxRef, orderBy('timestamp', 'desc'))

  return onSnapshot(
    q,
    (snap) => {
      callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    },
    (err) => {
      onError?.(err)
      callback([])
    }
  )
}

function matchesInboxFilter(data, match = {}) {
  if (!match || typeof match !== 'object') return false
  if (match.type != null && data.type !== match.type) return false
  if (match.actorId != null && data.actorId !== match.actorId) return false
  if (match.storyId != null && data.storyId !== match.storyId) return false
  if (match.meetupId != null && data.meetupId !== match.meetupId) return false
  if (match.chatId != null && data.chatId !== match.chatId) return false
  return true
}

/** Delete inbox items that match the given fields (e.g. same actor + story reaction). */
export async function removeMatchingInboxNotifications(userId, match) {
  if (!userId || !match?.type) return 0

  const snap = await getDocs(collection(db, 'users', userId, 'inbox'))
  const toDelete = snap.docs.filter((d) => matchesInboxFilter(d.data(), match))
  if (!toDelete.length) return 0

  // Firestore batches max 500 ops.
  for (let i = 0; i < toDelete.length; i += 450) {
    const batch = writeBatch(db)
    toDelete.slice(i, i + 450).forEach((d) => batch.delete(d.ref))
    await batch.commit()
  }
  return toDelete.length
}

/** Update matching inbox items in place (no new docs / no re-notify). Returns count updated. */
export async function patchMatchingInboxNotifications(userId, match, patch = {}) {
  if (!userId || !match?.type || !patch || typeof patch !== 'object') return 0

  const snap = await getDocs(collection(db, 'users', userId, 'inbox'))
  const matches = snap.docs.filter((d) => matchesInboxFilter(d.data(), match))
  if (!matches.length) return 0

  // Keep the newest matching item; drop duplicates quietly.
  matches.sort((a, b) => (b.data().timestamp || 0) - (a.data().timestamp || 0))
  const [keep, ...extras] = matches

  const batch = writeBatch(db)
  batch.update(keep.ref, patch)
  extras.forEach((d) => batch.delete(d.ref))
  await batch.commit()
  return matches.length
}

/**
 * Push an inbox notification.
 * Pass `replaceMatch` to delete prior matching items first (e.g. reaction change).
 */
export async function pushInboxNotification(userId, payload, { replaceMatch } = {}) {
  if (!userId || !payload?.type) return

  if (replaceMatch) {
    await removeMatchingInboxNotifications(userId, replaceMatch)
  }

  await addDoc(collection(db, 'users', userId, 'inbox'), {
    read: false,
    timestamp: Date.now(),
    ...payload,
  })
}

export async function markInboxRead(userId, notificationId) {
  if (!userId || !notificationId) return
  await updateDoc(doc(db, 'users', userId, 'inbox', notificationId), { read: true })
}

export async function markAllInboxRead(userId) {
  if (!userId) return
  const snap = await getDocs(collection(db, 'users', userId, 'inbox'))
  const batch = writeBatch(db)
  snap.docs.forEach((d) => {
    if (!d.data().read) batch.update(d.ref, { read: true })
  })
  await batch.commit()
}

export async function deleteInboxNotification(userId, notificationId) {
  if (!userId || !notificationId) return
  await deleteDoc(doc(db, 'users', userId, 'inbox', notificationId))
}
