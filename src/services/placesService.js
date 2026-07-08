import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  serverTimestamp,
  writeBatch,
} from 'firebase/firestore'
import { db } from '../firebase/config'

const placesCollection = () => collection(db, 'mapPlaces')

export function subscribeMapPlaces(callback, onError) {
  return onSnapshot(
    placesCollection(),
    (snap) => {
      callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    },
    (err) => {
      onError?.(err)
    }
  )
}

export async function createMapPlace(data, userId) {
  return addDoc(placesCollection(), {
    name: data.name,
    emoji: data.emoji,
    type: data.type,
    lat: data.lat,
    lng: data.lng,
    subplaces: data.subplaces || [],
    createdBy: userId || null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
}

export async function updateMapPlace(placeId, data) {
  return updateDoc(doc(db, 'mapPlaces', placeId), {
    name: data.name,
    emoji: data.emoji,
    type: data.type,
    subplaces: data.subplaces || [],
    updatedAt: serverTimestamp(),
  })
}

export async function deleteMapPlace(placeId) {
  return deleteDoc(doc(db, 'mapPlaces', placeId))
}

export async function seedMapPlaces(places, userId) {
  const batch = writeBatch(db)
  places.forEach((place) => {
    const ref = doc(placesCollection())
    batch.set(ref, {
      name: place.name,
      emoji: place.emoji,
      type: place.type,
      lat: place.lat,
      lng: place.lng,
      createdBy: userId || null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
  })
  await batch.commit()
}
