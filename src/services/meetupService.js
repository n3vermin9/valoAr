import {
  collection,
  doc,
  getDoc,
  updateDoc,
  onSnapshot,
  query,
  where,
  serverTimestamp,
  arrayUnion,
  arrayRemove,
  deleteField,
  runTransaction,
} from 'firebase/firestore'
import { db } from '../firebase/config'
import { createMeetupGroupChat, leaveGroupChat, deleteGroupChat } from './groupChatService'
import { deleteMeetupAnnouncementStories } from './storyService'
import { postSystemMessage, postAndPinMeetupInfo, SYSTEM_EVENTS } from './systemChatMessage'

const MEETUP_COOLDOWN_MS = 60 * 1000
const MEETUP_CHAT_GRACE_MS = 12 * 60 * 60 * 1000

export function meetupExpiryMs(meetup) {
  const end = toMs(meetup?.endAt)
  return end ? end + MEETUP_CHAT_GRACE_MS : 0
}

function toMs(value) {
  if (!value) return 0
  if (typeof value === 'number') return value
  if (typeof value.toMillis === 'function') return value.toMillis()
  return 0
}

export function isMeetupActive(meetup, now = Date.now()) {
  if (meetup?.cancelled) return false
  const expiresAt = toMs(meetup?.expiresAt)
  const endAt = toMs(meetup?.endAt)
  if (expiresAt && endAt && Math.abs(expiresAt - endAt) < 5000 && endAt <= now) return false
  if (expiresAt) return expiresAt > now
  return meetupExpiryMs(meetup) > now
}

function isMeetupVisibleForUser(meetup, userId, friendIdsSet) {
  if (!isMeetupActive(meetup)) return false
  if (meetup.privacy !== 'friends') return true
  if (meetup.creatorId === userId) return true
  if (meetup.participants?.includes(userId)) return true
  return friendIdsSet.has(meetup.creatorId)
}

export function subscribeMeetupManager(userId, friendIds = [], callback, onError) {
  if (!userId) {
    callback({ myMeetups: [], availableMeetups: [], placeCounts: {} })
    return () => {}
  }

  const friendSet = new Set(friendIds || [])
  return onSnapshot(
    collection(db, 'meetups'),
    (snap) => {
      const all = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
      const now = Date.now()
      const active = all.filter((meetup) => isMeetupActive(meetup, now))
      const visible = active.filter((meetup) => isMeetupVisibleForUser(meetup, userId, friendSet))
      const sortedVisible = visible.sort((a, b) => toMs(a.startAt) - toMs(b.startAt))
      const myMeetups = sortedVisible.filter((meetup) => meetup.participants?.includes(userId))
      const availableMeetups = sortedVisible.filter((meetup) => !meetup.participants?.includes(userId))
      const placeCounts = {}
      sortedVisible.forEach((meetup) => {
        const isJoined = meetup.participants?.includes(userId)
        const isFull = (meetup.participants?.length || 0) >= meetup.maxMembers
        if (isFull && !isJoined) return
        placeCounts[meetup.placeId] = (placeCounts[meetup.placeId] || 0) + 1
      })
      callback({ myMeetups, availableMeetups, placeCounts })
    },
    (err) => {
      onError?.(err)
      callback({ myMeetups: [], availableMeetups: [], placeCounts: {} })
    }
  )
}

export function subscribeMeetupsForPlace(placeId, callback, onError) {
  if (!placeId) {
    callback([])
    return () => {}
  }

  const q = query(collection(db, 'meetups'), where('placeId', '==', placeId))
  return onSnapshot(
    q,
    (snap) => {
      const now = Date.now()
      const meetups = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .filter((m) => isMeetupActive(m, now))
        .sort((a, b) => toMs(a.startAt) - toMs(b.startAt))
      callback(meetups)
    },
    (err) => {
      onError?.(err)
      callback([])
    }
  )
}

async function assertCanCreate(userId) {
  const userRef = doc(db, 'users', userId)
  const userSnap = await getDoc(userRef)
  const userData = userSnap.exists() ? userSnap.data() : {}

  const activeMeetupId = userData.activeMeetupId
  if (activeMeetupId) {
    const activeSnap = await getDoc(doc(db, 'meetups', activeMeetupId))
    if (!activeSnap.exists() || !isMeetupActive(activeSnap.data())) {
      await updateDoc(userRef, { activeMeetupId: deleteField() })
    } else {
      throw new Error('You already have an active meetup. End it before creating a new one.')
    }
  }

  const lastMeetupAt = toMs(userData.lastMeetupAt)
  if (
    userData.activeMeetupId &&
    lastMeetupAt &&
    Date.now() - lastMeetupAt < MEETUP_COOLDOWN_MS
  ) {
    const secondsLeft = Math.ceil((MEETUP_COOLDOWN_MS - (Date.now() - lastMeetupAt)) / 1000)
    throw new Error(`Please wait ${secondsLeft}s before creating another meetup`)
  }
}

export async function createMeetup({
  placeId,
  placeName,
  placeLat,
  placeLng,
  subplaceName = '',
  creatorId,
  creatorUsername = 'User',
  title,
  description = '',
  startAt,
  endAt,
  privacy = 'public',
  maxMembers = 10,
}) {
  if (!creatorId) throw new Error('Not signed in')
  if (!placeId) throw new Error('Missing place')
  const startMs = typeof startAt === 'number' ? startAt : new Date(startAt).getTime()
  const endMs = typeof endAt === 'number' ? endAt : new Date(endAt).getTime()
  if (!startMs || !endMs) throw new Error('Pick a valid time')
  if (endMs <= startMs) throw new Error('End time must be after the start time')
  if (endMs <= Date.now()) throw new Error('Meetup time must be in the future')

  const cappedMembers = Math.max(2, Math.min(10, Number(maxMembers) || 10))
  const trimmedTitle = (title || '').trim().slice(0, 60) || `Meetup at ${placeName || 'a place'}`

  await assertCanCreate(creatorId)

  const chat = await createMeetupGroupChat(creatorId, {
    name: trimmedTitle,
    description,
    memberLimit: cappedMembers,
    expiresAt: endMs + MEETUP_CHAT_GRACE_MS,
  })

  const meetupRef = doc(collection(db, 'meetups'))
  const meetupData = {
    placeId,
    placeName: placeName || '',
    placeLat: typeof placeLat === 'number' ? placeLat : null,
    placeLng: typeof placeLng === 'number' ? placeLng : null,
    subplaceName: subplaceName || '',
    creatorId,
    creatorUsername,
    title: trimmedTitle,
    description: description.trim().slice(0, 280),
    startAt: startMs,
    endAt: endMs,
    expiresAt: endMs + MEETUP_CHAT_GRACE_MS,
    privacy: privacy === 'friends' ? 'friends' : 'public',
    maxMembers: cappedMembers,
    chatId: chat.id,
    participants: [creatorId],
    createdAt: serverTimestamp(),
  }

  await runTransaction(db, async (transaction) => {
    transaction.set(meetupRef, meetupData)
    transaction.update(doc(db, 'chats', chat.id), { meetupId: meetupRef.id })
    transaction.update(doc(db, 'users', creatorId), {
      activeMeetupId: meetupRef.id,
      lastMeetupAt: serverTimestamp(),
    })
  })

  await postAndPinMeetupInfo(chat.id, creatorId, { id: meetupRef.id, ...meetupData }).catch(() => {})

  return { id: meetupRef.id, ...meetupData, chatId: chat.id }
}

export async function cancelMeetup(meetupId, userId) {
  if (!userId) throw new Error('Not signed in')
  const meetupRef = doc(db, 'meetups', meetupId)
  const snap = await getDoc(meetupRef)
  if (!snap.exists()) throw new Error('Meetup not found')

  const meetup = { id: snap.id, ...snap.data() }
  if (!isMeetupActive(meetup)) throw new Error('This meetup has already ended')

  const chatId = meetup.chatId

  if (meetup.creatorId === userId) {
    const now = Date.now()
    await runTransaction(db, async (transaction) => {
      transaction.update(meetupRef, { endAt: now, expiresAt: now, cancelled: true })
      transaction.update(doc(db, 'users', userId), {
        activeMeetupId: deleteField(),
        lastMeetupAt: deleteField(),
      })
    })
    if (chatId) {
      await deleteGroupChat(chatId, userId)
    }
    await deleteMeetupAnnouncementStories(userId, meetupId).catch(() => {})
    return { chatId, hostCancelled: true }
  }

  if (!meetup.participants?.includes(userId)) {
    throw new Error('You are not in this meetup')
  }

  await updateDoc(meetupRef, { participants: arrayRemove(userId) })
  if (chatId) {
    await leaveGroupChat(chatId, userId)
  }
  const userRef = doc(db, 'users', userId)
  const userSnap = await getDoc(userRef)
  if (userSnap.exists() && userSnap.data()?.activeMeetupId === meetupId) {
    await updateDoc(userRef, { activeMeetupId: deleteField() })
  }

  return { chatId, hostCancelled: false }
}

export async function fetchMeetup(meetupId) {
  if (!meetupId) return null
  const snap = await getDoc(doc(db, 'meetups', meetupId))
  if (!snap.exists()) return null
  return { id: snap.id, ...snap.data() }
}

export function subscribeMeetup(meetupId, callback, onError) {
  if (!meetupId) {
    callback(null)
    return () => {}
  }

  return onSnapshot(
    doc(db, 'meetups', meetupId),
    (snap) => {
      if (!snap.exists()) {
        callback(null)
        return
      }
      callback({ id: snap.id, ...snap.data() })
    },
    (err) => {
      onError?.(err)
      callback(null)
    }
  )
}

export async function joinMeetup(meetupId, userId) {
  if (!userId) throw new Error('Not signed in')
  const meetupRef = doc(db, 'meetups', meetupId)
  const snap = await getDoc(meetupRef)
  if (!snap.exists()) throw new Error('Meetup not found')

  const meetup = snap.data()
  if (!isMeetupActive(meetup)) throw new Error('This meetup has ended')

  const chatRef = doc(db, 'chats', meetup.chatId)
  const chatSnap = await getDoc(chatRef)
  if (!chatSnap.exists()) throw new Error('Meetup chat not found')
  const chat = chatSnap.data()
  if (chat.bannedUserIds?.includes(userId)) {
    throw new Error('You are banned from this meetup')
  }

  if (meetup.participants?.includes(userId)) {
    // Repair chat membership if they were kicked from chat but meetup was stale, or vice versa.
    if (!chat.participants?.includes(userId) || chat.hiddenFor?.includes(userId)) {
      await updateDoc(chatRef, {
        participants: arrayUnion(userId),
        memberHistory: arrayUnion(userId),
        [`unreadCount.${userId}`]: 0,
        hiddenFor: arrayRemove(userId),
      })
    }
    return { chatId: meetup.chatId, alreadyJoined: true }
  }
  if ((meetup.participants?.length || 0) >= meetup.maxMembers) {
    throw new Error('This meetup is full')
  }

  if (meetup.privacy === 'friends') {
    const creatorSnap = await getDoc(doc(db, 'users', meetup.creatorId))
    const creatorMatches = creatorSnap.exists() ? creatorSnap.data().matches || [] : []
    if (!creatorMatches.includes(userId)) {
      throw new Error('This meetup is for the host’s friends only')
    }
  }

  await updateDoc(meetupRef, { participants: arrayUnion(userId) })
  await updateDoc(chatRef, {
    participants: arrayUnion(userId),
    memberHistory: arrayUnion(userId),
    [`unreadCount.${userId}`]: 0,
    hiddenFor: arrayRemove(userId),
  })

  await postSystemMessage(meetup.chatId, {
    event: SYSTEM_EVENTS.JOINED,
    actorId: userId,
    isMeetup: true,
  }).catch(() => {})

  return { chatId: meetup.chatId, alreadyJoined: false }
}
