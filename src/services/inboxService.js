import {
  collection,
  doc,
  addDoc,
  updateDoc,
  onSnapshot,
  query,
  orderBy,
  writeBatch,
  getDocs,
} from 'firebase/firestore'
import { db } from '../firebase/config'

export function subscribeInbox(userId, callback) {
  if (!userId) return () => {}

  const inboxRef = collection(db, 'users', userId, 'inbox')
  const q = query(inboxRef, orderBy('timestamp', 'desc'))

  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
  })
}

export async function pushInboxNotification(userId, payload) {
  if (!userId || !payload?.type) return

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
