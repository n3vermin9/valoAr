import {
  collection,
  doc,
  addDoc,
  deleteDoc,
  setDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteField,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
  writeBatch,
} from 'firebase/firestore'
import { db } from '../firebase/config'
import { sendMessage } from './chatService'
import { getMatchId, reportBackgroundError } from '../utils/helpers'
import { pushInboxNotification } from './inboxService'
import {
  isStoryActive,
  storyCreatedMs,
  MAX_STORIES_PER_USER,
  MAX_STORY_LENGTH,
  STORY_TTL_MS,
  STORY_PRIVACY,
  filterStoriesForViewer,
  toTimestampMs,
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
    await deleteDoc(authorRef).catch(() => {
      // The next story sync will retry stale public-author cleanup.
    })
  }
}

export function subscribeUserStories(userId, callback, onError) {
  if (!userId) return () => {}

  const storiesRef = collection(db, 'users', userId, 'stories')
  const q = query(storiesRef, orderBy('createdAt', 'desc'))

  return onSnapshot(
    q,
    (snap) => {
      callback(mapStories(snap.docs))
    },
    (err) => {
      onError?.(err)
      callback([])
    }
  )
}

export function subscribeStoriesFeed(viewerId, friendIds = [], callback, onError) {
  if (!viewerId) return () => {}

  const cache = new Map()
  const userUnsubs = new Map()
  let activeFriendIds = [...friendIds]

  const getCoreIds = () => new Set([viewerId, ...activeFriendIds])

  let snapshotReady = false

  const emit = ({ force = false } = {}) => {
    // Avoid the initial empty callback before any story snapshots arrive —
    // that was flashing Discover's "Add a story" CTA.
    if (!snapshotReady && !force) return

    const coreIds = getCoreIds()
    const feed = [...coreIds]
      .map((userId) => ({
        userId,
        stories: filterForViewer(cache.get(userId) || [], viewerId, userId, activeFriendIds),
      }))
      .filter((entry) => entry.stories.length > 0)
    callback(feed)
  }

  const ensureUserSub = (userId) => {
    if (userUnsubs.has(userId)) return
    const unsub = subscribeUserStories(
      userId,
      (stories) => {
        cache.set(userId, stories)
        snapshotReady = true
        emit({ force: true })
      },
      onError
    )
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

  const updateFriendIds = (nextFriendIds = []) => {
    activeFriendIds = [...nextFriendIds]
    syncSubs()
  }

  syncSubs()

  const unsubscribe = () => {
    userUnsubs.forEach((unsub) => unsub())
    userUnsubs.clear()
    cache.clear()
  }

  unsubscribe.updateFriendIds = updateFriendIds
  return unsubscribe
}

/** @deprecated Use subscribeStoriesFeed */
export function subscribeFriendsStories(viewerId, friendIds = [], callback, onError) {
  return subscribeStoriesFeed(viewerId, friendIds, callback, onError)
}

export function subscribeStoryViews(viewerId, callback, onError) {
  if (!viewerId) return () => {}

  return onSnapshot(
    collection(db, 'users', viewerId, 'storyViews'),
    (snap) => {
      const views = {}
      snap.docs.forEach((d) => {
        const data = d.data()
        views[d.id] = data.viewedAt?.toMillis?.() ?? data.viewedAt ?? 0
      })
      callback(views)
    },
    (err) => {
      onError?.(err)
      callback({})
    }
  )
}

export function subscribeStoryWatchers(ownerId, storyId, callback, onError) {
  if (!ownerId || !storyId) return () => {}

  const viewsRef = collection(db, 'users', ownerId, 'stories', storyId, 'views')
  const q = query(viewsRef, orderBy('viewedAt', 'desc'))

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

export function subscribeStoryExists(ownerId, storyId, callback, onError) {
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
    (err) => {
      onError?.(err)
      callback(false)
    }
  )
}

export async function postStory(
  userId,
  {
    text,
    color,
    privacy = STORY_PRIVACY.FRIENDS,
    meetupId,
    meetupChatId,
    meetupPlaceId,
    meetupPlaceLat,
    meetupPlaceLng,
    meetupPlaceEmoji,
    meetupPlacePhotoUrl,
    meetupMaxMembers,
    meetupParticipantIds,
    meetupParticipantGenders,
    meetupExpiresAt,
    meetupStartAt,
    storyKind,
  }
) {
  const trimmed = text.trim()
  if (!trimmed) throw new Error('Story cannot be empty')

  const storiesRef = collection(db, 'users', userId, 'stories')
  const existing = await getDocs(query(storiesRef, orderBy('createdAt', 'desc')))
  const active = mapStories(existing.docs)

  if (active.length >= MAX_STORIES_PER_USER) {
    throw new Error(`You can only have ${MAX_STORIES_PER_USER} active stories`)
  }

  const payload = {
    text: trimmed,
    color: color || 'violet',
    privacy: privacy === STORY_PRIVACY.ALL ? STORY_PRIVACY.ALL : STORY_PRIVACY.FRIENDS,
    createdAt: serverTimestamp(),
    userId,
  }

  if (meetupId) {
    payload.storyKind = storyKind || 'meetup'
    payload.meetupId = meetupId
    if (meetupChatId) payload.meetupChatId = meetupChatId
    if (meetupPlaceId) payload.meetupPlaceId = meetupPlaceId
    if (typeof meetupPlaceLat === 'number') payload.meetupPlaceLat = meetupPlaceLat
    if (typeof meetupPlaceLng === 'number') payload.meetupPlaceLng = meetupPlaceLng
    if (meetupPlaceEmoji) payload.meetupPlaceEmoji = meetupPlaceEmoji
    const placePhoto = typeof meetupPlacePhotoUrl === 'string' ? meetupPlacePhotoUrl.trim() : ''
    if (placePhoto) payload.meetupPlacePhotoUrl = placePhoto.slice(0, 1000)
    if (meetupMaxMembers) payload.meetupMaxMembers = meetupMaxMembers
    if (Array.isArray(meetupParticipantIds) && meetupParticipantIds.length) {
      payload.meetupParticipantIds = meetupParticipantIds
    }
    if (meetupParticipantGenders && typeof meetupParticipantGenders === 'object') {
      payload.meetupParticipantGenders = meetupParticipantGenders
    }
    if (meetupExpiresAt) payload.meetupExpiresAt = meetupExpiresAt
    if (meetupStartAt) payload.meetupStartAt = meetupStartAt
  }

  await addDoc(storiesRef, payload)

  await syncPublicStoryAuthor(userId)
}

export async function postMeetupStory(
  userId,
  {
    meetupId,
    chatId,
    title,
    placeName,
    subplaceName = '',
    placeId,
    placeLat,
    placeLng,
    placeEmoji,
    placePhotoUrl,
    maxMembers,
    participantIds = [],
    participantGenders = {},
    description = '',
    startAt,
    expiresAt,
    privacy = STORY_PRIVACY.FRIENDS,
  }
) {
  if (!meetupId) throw new Error('Missing meetup')

  const locationLabel = subplaceName ? `${placeName} · ${subplaceName}` : placeName
  const startLabel = new Date(startAt).toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })

  const lines = [
    `📍 ${title || `Meetup at ${locationLabel}`}`,
    locationLabel,
    `🕐 ${startLabel}`,
    description.trim(),
  ].filter(Boolean)

  const text = lines.join('\n').slice(0, MAX_STORY_LENGTH)

  await postStory(userId, {
    text,
    color: 'amber',
    privacy,
    meetupId,
    meetupChatId: chatId,
    meetupPlaceId: placeId,
    meetupPlaceLat: placeLat,
    meetupPlaceLng: placeLng,
    meetupPlaceEmoji: placeEmoji,
    meetupPlacePhotoUrl: placePhotoUrl,
    meetupMaxMembers: maxMembers,
    meetupParticipantIds: participantIds,
    meetupParticipantGenders: participantGenders,
    meetupExpiresAt: expiresAt,
    meetupStartAt: startAt,
    storyKind: 'meetup',
  })
}

export async function deleteStory(userId, storyId) {
  const viewsSnap = await getDocs(collection(db, 'users', userId, 'stories', storyId, 'views'))
  const batch = writeBatch(db)
  viewsSnap.docs.forEach((d) => batch.delete(d.ref))
  batch.delete(doc(db, 'users', userId, 'stories', storyId))
  await batch.commit()
  await syncPublicStoryAuthor(userId)
}

export function subscribeStoryReactions(ownerId, storyId, callback, onError) {
  if (!ownerId || !storyId) {
    callback({})
    return () => {}
  }

  const storyRef = doc(db, 'users', ownerId, 'stories', storyId)
  return onSnapshot(
    storyRef,
    (snap) => {
      if (!snap.exists()) {
        callback({})
        return
      }
      callback(snap.data()?.reactions || {})
    },
    (err) => {
      onError?.(err)
      callback({})
    }
  )
}

export async function setStoryReaction(ownerId, storyId, userId, emoji, actorUsername = 'User') {
  if (!ownerId || !storyId || !userId || !emoji) return null

  const storyRef = doc(db, 'users', ownerId, 'stories', storyId)
  const snap = await getDoc(storyRef)
  if (!snap.exists()) return null

  const reactions = { ...(snap.data().reactions || {}) }
  const removing = reactions[userId] === emoji
  if (removing) {
    delete reactions[userId]
  } else {
    reactions[userId] = emoji
  }

  await updateDoc(storyRef, {
    reactions: Object.keys(reactions).length ? reactions : deleteField(),
  })

  if (!removing && ownerId !== userId) {
    await pushInboxNotification(ownerId, {
      type: 'story_reaction',
      actorId: userId,
      actorUsername,
      emoji,
      storyId,
    }).catch((err) => reportBackgroundError('Failed to push story reaction inbox item', err))
  }

  return reactions[userId] || null
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

export async function deleteMeetupAnnouncementStories(userId, meetupId) {
  if (!userId || !meetupId) return

  const storiesRef = collection(db, 'users', userId, 'stories')
  const snap = await getDocs(storiesRef)
  const batch = writeBatch(db)
  let deleted = false

  for (const d of snap.docs) {
    const story = d.data()
    if (story.storyKind !== 'meetup' || story.meetupId !== meetupId) continue
    const viewsSnap = await getDocs(collection(db, 'users', userId, 'stories', d.id, 'views'))
    viewsSnap.docs.forEach((v) => batch.delete(v.ref))
    batch.delete(d.ref)
    deleted = true
  }

  if (!deleted) return
  await batch.commit()
  await syncPublicStoryAuthor(userId)
}

export async function deleteExpiredStories(userId) {
  const storiesRef = collection(db, 'users', userId, 'stories')
  const snap = await getDocs(storiesRef)
  const now = Date.now()
  const batch = writeBatch(db)

  for (const d of snap.docs) {
    const story = { id: d.id, ...d.data() }
    const created = story.createdAt?.toMillis?.() ?? story.createdAt ?? 0
    const expiredByTtl = created && now - created >= STORY_TTL_MS
    const expiredMeetup =
      story.storyKind === 'meetup' &&
      story.meetupId &&
      toTimestampMs(story.meetupExpiresAt) > 0 &&
      toTimestampMs(story.meetupExpiresAt) <= now
    if (!expiredByTtl && !expiredMeetup) continue

    const viewsSnap = await getDocs(collection(db, 'users', userId, 'stories', d.id, 'views'))
    viewsSnap.docs.forEach((v) => batch.delete(v.ref))
    batch.delete(d.ref)
  }

  await batch.commit()
  await syncPublicStoryAuthor(userId)
}

export async function deleteAllUserStories(userId) {
  const snap = await getDocs(collection(db, 'users', userId, 'stories'))
  if (snap.empty) {
    await deleteDoc(doc(db, 'publicStoryAuthors', userId)).catch((err) =>
      reportBackgroundError('Failed to clean public story author', err)
    )
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
