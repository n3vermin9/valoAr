import {
  collection,
  addDoc,
  doc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
} from 'firebase/firestore'
import { db } from '../firebase/config'

const PLACES_COLLECTION = 'mapPlaces'

export function subscribeMapPlaces(callback, onError) {
  const q = query(collection(db, PLACES_COLLECTION), orderBy('createdAt', 'asc'))
  return onSnapshot(
    q,
    (snap) => {
      const places = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
      callback(places)
    },
    (err) => {
      onError?.(err)
      callback([])
    }
  )
}

export async function createMapPlace({ name, emoji, type, lat, lng, createdBy }) {
  const ref = await addDoc(collection(db, PLACES_COLLECTION), {
    name,
    emoji,
    type,
    lat,
    lng,
    createdBy: createdBy || null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
  return ref.id
}

export async function updateMapPlace(placeId, patch) {
  await updateDoc(doc(db, PLACES_COLLECTION, placeId), {
    ...patch,
    updatedAt: serverTimestamp(),
  })
}

export async function deleteMapPlace(placeId) {
  await deleteDoc(doc(db, PLACES_COLLECTION, placeId))
}
