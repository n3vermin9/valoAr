import {
  collection,
  doc,
  addDoc,
  deleteDoc,
  setDoc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
  writeBatch,
} from 'firebase/firestore'
import { db } from '../firebase/config'
import { sendMessage } from './chatService'
import { getMatchId } from '../utils/helpers'
import {
  isStoryActive,
  storyCreatedMs,
  MAX_STORIES_PER_USER,
  STORY_TTL_MS,
  STORY_PRIVACY,
  filterStoriesForViewer,
} from '../utils/storyHelpers'

function mapStories(docs, now = Date.now()) {
  return docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((story) => isStoryActive(story, now))
    .sort((a, b) => storyCreatedMs(a) - storyCreatedMs(b))
}

function filterForViewer(stories, viewerId, ownerId, friendIds) {
  return filterStoriesForViewer(stories, {
    viewerId,
    ownerId,
    friendIds,
    allowPublicFromNonFriends: false,
  })
}

async function syncPublicStoryAuthor(userId) {
  const storiesRef = collection(db, 'users', userId, 'stories')
  const snap = await getDocs(query(storiesRef, orderBy('createdAt', 'desc')))
  const active = mapStories(snap.docs)
  const hasPublic = active.some((s) => s.privacy === STORY_PRIVACY.ALL)
  const authorRef = doc(db, 'publicStoryAuthors', userId)

  if (hasPublic) {
    await setDoc(authorRef, { updatedAt: serverTimestamp() }, { merge: true })
  } else {
    await deleteDoc(authorRef).catch(() => {})
  }
}

export function subscribeUserStories(userId, callback) {
  if (!userId) return () => {}

  const storiesRef = collection(db, 'users', userId, 'stories')
  const q = query(storiesRef, orderBy('createdAt', 'desc'))

  return onSnapshot(q, (snap) => {
    callback(mapStories(snap.docs))
  })
}

export function subscribeStoriesFeed(viewerId, friendIds = [], callback) {
  if (!viewerId) return () => {}

  const cache = new Map()
  const userUnsubs = new Map()

  const getCoreIds = () => new Set([viewerId, ...friendIds])

  const emit = () => {
    const coreIds = getCoreIds()
    const feed = [...coreIds]
      .map((userId) => ({
        userId,
        stories: filterForViewer(cache.get(userId) || [], viewerId, userId, friendIds),
      }))
      .filter((entry) => entry.stories.length > 0)
    callback(feed)
  }

  const ensureUserSub = (userId) => {
    if (userUnsubs.has(userId)) return
    const unsub = subscribeUserStories(userId, (stories) => {
      cache.set(userId, stories)
      emit()
    })
    userUnsubs.set(userId, unsub)
  }

  const removeUserSub = (userId) => {
    const unsub = userUnsubs.get(userId)
    if (!unsub) return
    unsub()
    userUnsubs.delete(userId)
    cache.delete(userId)
  }

  const syncSubs = () => {
    const coreIds = getCoreIds()
    coreIds.forEach(ensureUserSub)
    ;[...userUnsubs.keys()].forEach((id) => {
      if (!coreIds.has(id)) removeUserSub(id)
    })
    emit()
  }

  syncSubs()

  return () => {
    userUnsubs.forEach((unsub) => unsub())
    userUnsubs.clear()
    cache.clear()
  }
}

/** @deprecated Use subscribeStoriesFeed */
export function subscribeFriendsStories(viewerId, friendIds = [], callback) {
  return subscribeStoriesFeed(viewerId, friendIds, callback)
}

export function subscribeStoryViews(viewerId, callback) {
  if (!viewerId) return () => {}

  return onSnapshot(collection(db, 'users', viewerId, 'storyViews'), (snap) => {
    const views = {}
    snap.docs.forEach((d) => {
      const data = d.data()
      views[d.id] = data.viewedAt?.toMillis?.() ?? data.viewedAt ?? 0
    })
    callback(views)
  })
}

export function subscribeStoryWatchers(ownerId, storyId, callback) {
  if (!ownerId || !storyId) return () => {}

  const viewsRef = collection(db, 'users', ownerId, 'stories', storyId, 'views')
  const q = query(viewsRef, orderBy('viewedAt', 'desc'))

  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
  })
}

export function subscribeStoryExists(ownerId, storyId, callback) {
  if (!ownerId || !storyId) {
    callback(null)
    return () => {}
  }

  const storyRef = doc(db, 'users', ownerId, 'stories', storyId)
  return onSnapshot(
    storyRef,
    (snap) => {
      if (!snap.exists()) {
        callback(false)
        return
      }
      callback(isStoryActive({ id: snap.id, ...snap.data() }))
    },
    () => callback(false)
  )
}

export async function postStory(userId, { text, color, privacy = STORY_PRIVACY.FRIENDS }) {
  const trimmed = text.trim()
  if (!trimmed) throw new Error('Story cannot be empty')

  const storiesRef = collection(db, 'users', userId, 'stories')
  const existing = await getDocs(query(storiesRef, orderBy('createdAt', 'desc')))
  const active = mapStories(existing.docs)

  if (active.length >= MAX_STORIES_PER_USER) {
    throw new Error(`You can only have ${MAX_STORIES_PER_USER} active stories`)
  }

  await addDoc(storiesRef, {
    text: trimmed,
    color: color || 'violet',
    privacy: privacy === STORY_PRIVACY.ALL ? STORY_PRIVACY.ALL : STORY_PRIVACY.FRIENDS,
    createdAt: serverTimestamp(),
    userId,
  })

  await syncPublicStoryAuthor(userId)
}

export async function deleteStory(userId, storyId) {
  const viewsSnap = await getDocs(collection(db, 'users', userId, 'stories', storyId, 'views'))
  const batch = writeBatch(db)
  viewsSnap.docs.forEach((d) => batch.delete(d.ref))
  batch.delete(doc(db, 'users', userId, 'stories', storyId))
  await batch.commit()
  await syncPublicStoryAuthor(userId)
}

export async function recordStoryView(
  viewerId,
  ownerId,
  storyId,
  viewerUsername,
  viewerPhoto,
  storyCreatedMsValue
) {
  if (!viewerId || !ownerId || !storyId || viewerId === ownerId) return

  const viewRef = doc(db, 'users', ownerId, 'stories', storyId, 'views', viewerId)
  const existing = await getDoc(viewRef)

  if (existing.exists()) {
    await setDoc(
      viewRef,
      {
        username: viewerUsername || existing.data().username || 'User',
        photoUrl: viewerPhoto || existing.data().photoUrl || null,
      },
      { merge: true }
    )
  } else {
    await setDoc(viewRef, {
      viewerId,
      username: viewerUsername || 'User',
      photoUrl: viewerPhoto || null,
      viewedAt: Date.now(),
    })
  }

  await markStoriesViewed(viewerId, ownerId, storyCreatedMsValue)
}

export async function markStoriesViewed(viewerId, ownerId, storyCreatedMsValue) {
  if (!viewerId || !ownerId) return
  const markMs = storyCreatedMsValue || Date.now()
  const viewRef = doc(db, 'users', viewerId, 'storyViews', ownerId)
  const existing = await getDoc(viewRef)
  const prev = existing.exists()
    ? existing.data().viewedAt?.toMillis?.() ?? existing.data().viewedAt ?? 0
    : 0
  const viewedAt = Math.max(prev, markMs)
  await setDoc(viewRef, { viewedAt }, { merge: true })
}

export async function replyToStory(
  senderId,
  ownerId,
  story,
  replyText,
  senderUsername,
  ownerUsername,
  sendOptions = {}
) {
  const trimmed = replyText.trim()
  if (!trimmed) throw new Error('Reply cannot be empty')

  const matchId = getMatchId(senderId, ownerId)

  await sendMessage(
    matchId,
    senderId,
    {
      text: trimmed,
      storyReply: {
        storyId: story.id,
        text: story.text || '',
        color: story.color || 'violet',
        ownerId,
        ownerUsername: ownerUsername || null,
      },
    },
    { skipEnsureVisible: true, ...sendOptions }
  )
}

export async function deleteExpiredStories(userId) {
  const storiesRef = collection(db, 'users', userId, 'stories')
  const snap = await getDocs(storiesRef)
  const now = Date.now()
  const batch = writeBatch(db)

  for (const d of snap.docs) {
    const story = d.data()
    const created = story.createdAt?.toMillis?.() ?? story.createdAt ?? 0
    if (created && now - created >= STORY_TTL_MS) {
      const viewsSnap = await getDocs(collection(db, 'users', userId, 'stories', d.id, 'views'))
      viewsSnap.docs.forEach((v) => batch.delete(v.ref))
      batch.delete(d.ref)
    }
  }

  await batch.commit()
  await syncPublicStoryAuthor(userId)
}

export async function deleteAllUserStories(userId) {
  const snap = await getDocs(collection(db, 'users', userId, 'stories'))
  if (snap.empty) {
    await deleteDoc(doc(db, 'publicStoryAuthors', userId)).catch(() => {})
    return
  }

  const batch = writeBatch(db)
  for (const d of snap.docs) {
    const viewsSnap = await getDocs(collection(db, 'users', userId, 'stories', d.id, 'views'))
    viewsSnap.docs.forEach((v) => batch.delete(v.ref))
    batch.delete(d.ref)
  }
  batch.delete(doc(db, 'publicStoryAuthors', userId))
  await batch.commit()
}
