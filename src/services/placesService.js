import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDoc,
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

const placeCache = new Map()

export async function fetchMapPlace(placeId) {
  if (!placeId) return null
  if (placeCache.has(placeId)) return placeCache.get(placeId)

  const snap = await getDoc(doc(db, 'mapPlaces', placeId))
  if (!snap.exists()) return null
  const place = { id: snap.id, ...snap.data() }
  placeCache.set(placeId, place)
  return place
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
