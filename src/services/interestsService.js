import {
  collection,
  doc,
  getDocs,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
  setDoc,
} from 'firebase/firestore'
import { db } from '../firebase/config'

function interestIdFromLabel(label = '') {
  const normalized = label
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
  return normalized ? `custom-${normalized}` : ''
}

function normalizeInterestDoc(id, data = {}) {
  if (!id || !data.label) return null
  return {
    id,
    label: String(data.label).trim().slice(0, 32),
    custom: data.custom === true,
    createdBy: data.createdBy || null,
  }
}

export function subscribeCustomInterests(callback, onError) {
  const q = query(collection(db, 'interests'), orderBy('label'))
  return onSnapshot(
    q,
    (snap) => {
      callback(snap.docs.map((d) => normalizeInterestDoc(d.id, d.data())).filter(Boolean))
    },
    (err) => {
      onError?.(err)
      callback([])
    }
  )
}

export async function fetchCustomInterests() {
  const snap = await getDocs(query(collection(db, 'interests'), orderBy('label')))
  return snap.docs.map((d) => normalizeInterestDoc(d.id, d.data())).filter(Boolean)
}

export async function createCustomInterest(label, userId) {
  const cleanLabel = String(label || '').trim().replace(/\s+/g, ' ').slice(0, 32)
  const id = interestIdFromLabel(cleanLabel)
  if (!id || cleanLabel.length < 2) {
    throw new Error('Interest name is too short')
  }

  await setDoc(
    doc(db, 'interests', id),
    {
      label: cleanLabel,
      custom: true,
      createdBy: userId || null,
      createdAt: serverTimestamp(),
    },
    { merge: true }
  )
  return { id, label: cleanLabel, custom: true, createdBy: userId || null }
}
