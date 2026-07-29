import {
  doc,
  getDoc,
  updateDoc,
  deleteDoc,
  deleteField,
  collection,
  getDocs,
  query,
  where,
  limit,
  documentId,
  onSnapshot,
  arrayUnion,
  arrayRemove,
  increment,
  serverTimestamp,
  writeBatch,
  runTransaction,
} from 'firebase/firestore'
import { ref, set, onDisconnect, onValue, off } from 'firebase/database'
import { db, rtdb } from '../firebase/config'
import { getCachedUser, setCachedUser, invalidateUser } from './userCache'
import { setProfileSnapshot } from './profileSnapshotCache'
import { preloadAvatarImage } from './avatarImageCache'

export { getCachedUser }

function syncProfileSnapshot(userId, data) {
  if (!data) return
  setProfileSnapshot(userId, {
    username: data.username,
    photo: data.photos?.[0] || null,
  })
  preloadAvatarImage(data.photos?.[0], 128).catch((err) =>
    reportBackgroundError('Avatar preload failed', err)
  )
}
import {
  DISCOVER_AGE_GAP_DEFAULT,
  buildUsernameBase,
  normalizeUsername,
  reportBackgroundError,
} from '../utils/helpers'
import { normalizeSocials, sanitizeProfileSocials, stripSocials } from '../utils/socialLinks'
import { DEFAULT_CITY_ID, normalizeCity, normalizeHobbies } from '../utils/profileOptions'
import { removeChatForUser } from './chatService'
import { deleteAllUserStories } from './storyService'
import { pushInboxNotification } from './inboxService'

export async function fetchUser(userId) {
  const cached = getCachedUser(userId)
  if (cached) return cached

  const snap = await getDoc(doc(db, 'users', userId))
  if (!snap.exists()) {
    invalidateUser(userId)
    return null
  }
  const raw = snap.data()
  const data = {
    id: userId,
    ...raw,
    allowDirectMessages: raw.allowDirectMessages === true,
    showFriendCount: raw.showFriendCount !== false,
    useMilitaryTime: raw.useMilitaryTime !== false,
    socials: normalizeSocials(raw.socials),
  }
  setCachedUser(userId, data)
  syncProfileSnapshot(userId, data)
  return data
}

export async function fetchUsersMap(userIds) {
  const unique = [...new Set(userIds.filter(Boolean))]
  if (!unique.length) return {}

  const entries = await Promise.all(
    unique.map(async (id) => {
      const user = await fetchUser(id)
      return user ? [id, user] : null
    })
  )

  return Object.fromEntries(entries.filter(Boolean))
}

export function subscribeToUser(userId, callback, onError) {
  return onSnapshot(
    doc(db, 'users', userId),
    (snap) => {
      if (snap.exists()) {
        const raw = snap.data()
        const data = {
          id: userId,
          ...raw,
          allowDirectMessages: raw.allowDirectMessages === true,
          showFriendCount: raw.showFriendCount !== false,
          useMilitaryTime: raw.useMilitaryTime !== false,
          socials: normalizeSocials(raw.socials),
        }
        setCachedUser(userId, data)
        syncProfileSnapshot(userId, data)
        callback(data)
      } else {
        invalidateUser(userId)
        callback(null)
      }
    },
    (err) => {
      onError?.(err)
      callback(null)
    }
  )
}

export async function checkUsernameAvailable(username, currentUserId) {
  const normalized = normalizeUsername(username)
  const snap = await getDoc(doc(db, 'usernames', normalized))
  if (!snap.exists()) return true
  const data = snap.data()
  if (data.deleted === true) return false
  return data.userId === currentUserId
}

export async function getUsernameAvailability(username, currentUserId) {
  const normalized = normalizeUsername(username)
  const snap = await getDoc(doc(db, 'usernames', normalized))
  if (!snap.exists()) return { available: true }
  const data = snap.data()
  if (data.deleted === true) {
    return { available: false, error: 'This username is not available' }
  }
  if (data.userId === currentUserId) return { available: true }
  return { available: false, error: 'Username is taken' }
}

export async function getUserIdByUsername(username) {
  const normalized = normalizeUsername(username)
  if (normalized.length < 4) return null
  const snap = await getDoc(doc(db, 'usernames', normalized))
  if (!snap.exists()) return null
  const data = snap.data()
  if (data.deleted === true || !data.userId) return null
  return data.userId
}

export async function createUserProfile(userId, profileData) {
  const username = normalizeUsername(profileData.username)
  const userRef = doc(db, 'users', userId)
  const usernameRef = doc(db, 'usernames', username)

  await runTransaction(db, async (transaction) => {
    const usernameSnap = await transaction.get(usernameRef)
    if (usernameSnap.exists()) {
      const data = usernameSnap.data()
      if (data.deleted === true) {
        throw new Error('This username is not available')
      }
      if (data.userId !== userId) {
        throw new Error('Username is already taken')
      }
    }

    transaction.set(userRef, {
      ...profileData,
      username,
      city: normalizeCity(profileData.city || DEFAULT_CITY_ID),
      hobbies: normalizeHobbies(profileData.hobbies),
      matches: [],
      previousMatches: [],
      swipes: {},
      blocked: [],
      genderLocked: true,
      allowDirectMessages: false,
      showFriendCount: true,
      useMilitaryTime: true,
      createdAt: serverTimestamp(),
      swipeCount: 0,
    })
    transaction.set(usernameRef, { userId })
  })

  invalidateUser(userId)
}

export async function updateUserSettings(userId, settings) {
  await updateDoc(doc(db, 'users', userId), settings)
  invalidateUser(userId)
}

export async function updateUserProfile(userId, updates, oldUsername) {
  const userRef = doc(db, 'users', userId)
  const nextUsername = updates.username ? normalizeUsername(updates.username) : null
  const prevUsername = normalizeUsername(oldUsername || '')

  await runTransaction(db, async (transaction) => {
    const nextUpdates = { ...updates }
    if (nextUsername) nextUpdates.username = nextUsername
    if ('city' in nextUpdates) nextUpdates.city = normalizeCity(nextUpdates.city)
    if ('hobbies' in nextUpdates) nextUpdates.hobbies = normalizeHobbies(nextUpdates.hobbies)

    if (nextUsername && nextUsername !== prevUsername) {
      const nextUsernameRef = doc(db, 'usernames', nextUsername)
      const nextUsernameSnap = await transaction.get(nextUsernameRef)
      if (nextUsernameSnap.exists()) {
        const data = nextUsernameSnap.data()
        if (data.deleted === true) {
          throw new Error('This username is not available')
        }
        if (data.userId !== userId) {
          throw new Error('Username is already taken')
        }
      }

      if (prevUsername) {
        const prevUsernameRef = doc(db, 'usernames', prevUsername)
        const prevUsernameSnap = await transaction.get(prevUsernameRef)
        if (prevUsernameSnap.exists() && prevUsernameSnap.data().userId === userId) {
          transaction.delete(prevUsernameRef)
        }
      }

      transaction.set(nextUsernameRef, { userId })
    }

    transaction.update(userRef, nextUpdates)
  })
  invalidateUser(userId)
}

export async function suggestUniqueUsername(seed, currentUserId) {
  const base = buildUsernameBase(seed)
  const directAvailable = await checkUsernameAvailable(base, currentUserId)
  if (directAvailable) return base

  for (let i = 0; i < 30; i += 1) {
    const suffix = Math.floor(100 + Math.random() * 900).toString()
    const candidate = `${base.slice(0, 20 - suffix.length)}${suffix}`
    // eslint-disable-next-line no-await-in-loop
    const available = await checkUsernameAvailable(candidate, currentUserId)
    if (available) return candidate
  }

  return `${base.slice(0, 16)}${Date.now().toString().slice(-4)}`
}

export function patchProfileAfterSwipe(profile, targetId, action) {
  if (!profile) return profile
  return {
    ...profile,
    swipes: { ...(profile.swipes || {}), [targetId]: action },
    swipeCount: (profile.swipeCount || 0) + 1,
  }
}

export function patchProfileAfterMatch(profile, otherId) {
  if (!profile) return profile
  const matches = profile.matches || []
  if (matches.includes(otherId)) return profile
  return {
    ...profile,
    matches: [...matches, otherId],
    swipes: { ...(profile.swipes || {}), [otherId]: 'matched' },
  }
}

export async function recordSwipe(userId, targetId, action, message = null) {
  const userRef = doc(db, 'users', userId)

  if (action === 'like') {
    const batch = writeBatch(db)
    batch.update(userRef, {
      [`swipes.${targetId}`]: action,
      swipeCount: increment(1),
    })
    batch.set(doc(db, 'users', targetId, 'likesReceived', userId), {
      fromUserId: userId,
      message: message || null,
      timestamp: Date.now(),
      read: false,
    })
    await batch.commit()

    const targetSnap = await getDoc(doc(db, 'users', targetId))
    if (targetSnap.data()?.swipes?.[userId] === 'like') {
      await createMatch(userId, targetId)
    }
  } else {
    await updateDoc(userRef, {
      [`swipes.${targetId}`]: action,
      swipeCount: increment(1),
    })
  }
  invalidateUser(userId)
}

export async function createMatch(uid1, uid2) {
  const matchId = [uid1, uid2].sort().join('_')
  const chatRef = doc(db, 'chats', matchId)
  const chatSnap = await getDoc(chatRef)
  const batch = writeBatch(db)

  batch.update(doc(db, 'users', uid1), {
    matches: arrayUnion(uid2),
    [`swipes.${uid2}`]: 'matched',
  })
  batch.update(doc(db, 'users', uid2), {
    matches: arrayUnion(uid1),
    [`swipes.${uid1}`]: 'matched',
  })

  if (chatSnap.exists()) {
    batch.update(chatRef, {
      unfriended: false,
      hiddenFor: [],
    })
  } else {
    batch.set(chatRef, {
      participants: [uid1, uid2],
      createdAt: serverTimestamp(),
      lastMessage: null,
      mutedBy: [],
      unfriended: false,
    })
  }

  batch.delete(doc(db, 'users', uid1, 'likesReceived', uid2))
  batch.delete(doc(db, 'users', uid2, 'likesReceived', uid1))

  await batch.commit()
  invalidateUser(uid1)
  invalidateUser(uid2)

  const [profile1, profile2] = await Promise.all([fetchUser(uid1), fetchUser(uid2)])
  await Promise.all([
    pushInboxNotification(uid1, {
      type: 'match',
      actorId: uid2,
      actorUsername: profile2?.username || 'User',
    }),
    pushInboxNotification(uid2, {
      type: 'match',
      actorId: uid1,
      actorUsername: profile1?.username || 'User',
    }),
  ])

  return matchId
}

export function subscribeLikesReceived(userId, callback, onError) {
  return onSnapshot(
    collection(db, 'users', userId, 'likesReceived'),
    (snap) => {
      const likes = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (b.timestamp ?? 0) - (a.timestamp ?? 0))
      callback(likes)
    },
    (err) => {
      onError?.(err)
      callback([])
    }
  )
}

export async function acceptLike(userId, fromUserId) {
  await createMatch(userId, fromUserId)
}

export async function declineLike(userId, fromUserId) {
  const batch = writeBatch(db)
  batch.delete(doc(db, 'users', userId, 'likesReceived', fromUserId))
  batch.update(doc(db, 'users', userId), {
    [`swipes.${fromUserId}`]: 'pass',
  })
  batch.update(doc(db, 'users', fromUserId), {
    [`swipes.${userId}`]: deleteField(),
  })
  await batch.commit()
  invalidateUser(userId)
  invalidateUser(fromUserId)
}

export function getOutgoingRequestIds(userProfile) {
  const swipes = userProfile?.swipes || {}
  const matches = new Set(userProfile?.matches || [])
  return Object.entries(swipes)
    .filter(([id, action]) => action === 'like' && !matches.has(id))
    .map(([id]) => id)
}

export async function cancelFriendRequest(userId, targetId) {
  await deleteDoc(doc(db, 'users', targetId, 'likesReceived', userId))
  await updateDoc(doc(db, 'users', userId), {
    [`swipes.${targetId}`]: deleteField(),
  })
  invalidateUser(userId)
  invalidateUser(targetId)
}

export function subscribeIncomingRequest(userId, fromUserId, callback, onError) {
  return onSnapshot(
    doc(db, 'users', userId, 'likesReceived', fromUserId),
    (snap) => {
      callback(snap.exists() ? { id: snap.id, ...snap.data() } : null)
    },
    (err) => {
      onError?.(err)
      callback(null)
    }
  )
}

export function subscribeOutgoingRequest(requesterId, targetId, callback, onError) {
  if (!requesterId || !targetId) {
    callback(false)
    return () => {}
  }
  return onSnapshot(
    doc(db, 'users', targetId, 'likesReceived', requesterId),
    (snap) => callback(snap.exists()),
    (err) => {
      onError?.(err)
      callback(false)
    }
  )
}

export function subscribeActiveOutgoingRequestIds(userId, callback, onError) {
  if (!userId) {
    callback([])
    return () => {}
  }

  let userData = null
  const targetUnsubs = new Map()
  const activeByTarget = new Map()

  const publish = (targets) => {
    callback(targets.filter((targetId) => activeByTarget.get(targetId)))
  }

  const syncTargetListeners = () => {
    if (!userData) {
      for (const unsub of targetUnsubs.values()) unsub()
      targetUnsubs.clear()
      activeByTarget.clear()
      callback([])
      return
    }

    const matches = new Set(userData.matches || [])
    const targets = Object.entries(userData.swipes || {})
      .filter(([id, action]) => action === 'like' && !matches.has(id))
      .map(([id]) => id)
    const targetSet = new Set(targets)

    for (const [targetId, unsub] of targetUnsubs) {
      if (!targetSet.has(targetId)) {
        unsub()
        targetUnsubs.delete(targetId)
        activeByTarget.delete(targetId)
      }
    }

    if (targets.length === 0) {
      callback([])
      return
    }

    for (const targetId of targets) {
      if (targetUnsubs.has(targetId)) continue
      activeByTarget.set(targetId, false)
      const unsub = onSnapshot(
        doc(db, 'users', targetId, 'likesReceived', userId),
        (snap) => {
          activeByTarget.set(targetId, snap.exists())
          publish(targets)
        },
        (err) => {
          onError?.(err)
          activeByTarget.set(targetId, false)
          publish(targets)
        }
      )
      targetUnsubs.set(targetId, unsub)
    }

    publish(targets)
  }

  const userUnsub = onSnapshot(
    doc(db, 'users', userId),
    (snap) => {
      userData = snap.exists() ? snap.data() : null
      syncTargetListeners()
    },
    (err) => {
      onError?.(err)
      callback([])
    }
  )

  return () => {
    userUnsub()
    for (const unsub of targetUnsubs.values()) unsub()
  }
}

export async function markLikeAsRead(userId, fromUserId) {
  await updateDoc(doc(db, 'users', userId, 'likesReceived', fromUserId), { read: true })
}

function sharedHobbyCount(currentUser, profile) {
  const mine = new Set(normalizeHobbies(currentUser?.hobbies))
  if (!mine.size) return 0
  return normalizeHobbies(profile?.hobbies).filter((id) => mine.has(id)).length
}

function passesDiscoverFilters(currentUser, profile, filters = {}) {
  if (profile.id === currentUser.id) return false
  if (currentUser.blocked?.includes(profile.id)) return false
  if (profile.blocked?.includes(currentUser.id)) return false
  if (currentUser.matches?.includes(profile.id)) return false
  if (!genderMatchesPreference(profile.gender, currentUser.interestedIn)) return false
  if (!genderMatchesPreference(currentUser.gender, profile.interestedIn)) return false
  if (!ageInRange(currentUser.age, profile.age, DISCOVER_AGE_GAP_DEFAULT)) return false

  if (filters.city && profile.city !== filters.city) return false

  const filterHobbies = normalizeHobbies(filters.hobbies || [])
  if (filterHobbies.length) {
    const profileHobbies = new Set(normalizeHobbies(profile.hobbies))
    if (!filterHobbies.some((id) => profileHobbies.has(id))) return false
  }

  return true
}

function rankDiscoverProfiles(currentUser, profiles) {
  return profiles.sort((a, b) => {
    const sharedDiff = sharedHobbyCount(currentUser, b) - sharedHobbyCount(currentUser, a)
    if (sharedDiff !== 0) return sharedDiff
    const aName = a.username?.toLowerCase() || ''
    const bName = b.username?.toLowerCase() || ''
    return aName.localeCompare(bName)
  })
}

export async function getDiscoverFeed(currentUser, filters = {}) {
  const usersSnap = await getDocs(collection(db, 'users'))
  const newProfiles = []
  const recentProfiles = []

  for (const userDoc of usersSnap.docs) {
    const profile = { id: userDoc.id, ...userDoc.data() }
    if (!passesDiscoverFilters(currentUser, profile, filters)) continue

    const likedMe = await getDoc(doc(db, 'users', currentUser.id, 'likesReceived', profile.id))
    if (likedMe.exists()) continue

    const swipe = currentUser.swipes?.[profile.id]
    const wasFriend = currentUser.previousMatches?.includes(profile.id)

    if (swipe === 'like' || swipe === 'matched') continue

    const stripped = stripSocials(profile)

    if (!swipe && !wasFriend) {
      newProfiles.push(stripped)
    } else if (swipe === 'pass' || wasFriend) {
      recentProfiles.push(stripped)
    }
  }

  return {
    newProfiles: rankDiscoverProfiles(currentUser, newProfiles),
    recentProfiles: rankDiscoverProfiles(currentUser, recentProfiles),
  }
}

export async function getDiscoverProfiles(currentUser) {
  const { newProfiles } = await getDiscoverFeed(currentUser)
  return newProfiles
}

export async function searchUsersByUsername(queryText, currentUser = null) {
  const normalized = normalizeUsername(queryText)
  if (!normalized || normalized.length < 2) return []

  const usernameDocs = await listUsernameDocsForSearch(normalized)
  const userIds = []
  for (const usernameDoc of usernameDocs) {
    const data = usernameDoc.data()
    if (!data?.userId || data.deleted) continue
    if (!userIds.includes(data.userId)) userIds.push(data.userId)
  }

  if (!userIds.length) return []

  const userMap = await fetchUsersMap(userIds.slice(0, 25))
  return Object.values(userMap)
    .map((profile) => sanitizeProfileSocials(profile, currentUser))
    .filter(Boolean)
    .sort((a, b) => {
      const aUser = a.username?.toLowerCase() || ''
      const bUser = b.username?.toLowerCase() || ''
      const rank = (name) => {
        if (name === normalized) return 0
        if (name.startsWith(normalized)) return 1
        return 2
      }
      const diff = rank(aUser) - rank(bUser)
      if (diff !== 0) return diff
      return aUser.localeCompare(bUser)
    })
    .slice(0, 20)
}

async function listUsernameDocsForSearch(normalized) {
  const docs = new Map()

  try {
    const exactSnap = await getDoc(doc(db, 'usernames', normalized))
    if (exactSnap.exists()) docs.set(exactSnap.id, exactSnap)
  } catch {
    // ignore
  }

  try {
    const prefixSnap = await getDocs(
      query(
        collection(db, 'usernames'),
        where(documentId(), '>=', normalized),
        where(documentId(), '<=', normalized + '\uf8ff'),
        limit(25)
      )
    )
    prefixSnap.docs.forEach((d) => docs.set(d.id, d))
  } catch {
    try {
      const allSnap = await getDocs(collection(db, 'usernames'))
      allSnap.docs.forEach((d) => {
        if (d.id.includes(normalized)) docs.set(d.id, d)
      })
    } catch {
      // ignore
    }
  }

  return Array.from(docs.values())
}

function genderMatchesPreference(userGender, interestedIn) {
  if (interestedIn === 'both') return true
  if (interestedIn === 'men') return userGender === 'male'
  if (interestedIn === 'women') return userGender === 'female'
  return true
}

function ageInRange(userAge, targetAge, gap = DISCOVER_AGE_GAP_DEFAULT) {
  return Math.abs(userAge - targetAge) <= gap
}

export async function removeMatchKeepChat(userId, targetId) {
  const matchId = [userId, targetId].sort().join('_')
  const batch = writeBatch(db)

  batch.update(doc(db, 'users', userId), {
    matches: arrayRemove(targetId),
    previousMatches: arrayUnion(targetId),
    [`swipes.${targetId}`]: deleteField(),
  })
  batch.update(doc(db, 'users', targetId), {
    matches: arrayRemove(userId),
    previousMatches: arrayUnion(userId),
    [`swipes.${userId}`]: deleteField(),
  })

  const chatRef = doc(db, 'chats', matchId)
  const chatSnap = await getDoc(chatRef)
  if (chatSnap.exists()) {
    batch.update(chatRef, { unfriended: true })
  }

  await batch.commit()
  invalidateUser(userId)
  invalidateUser(targetId)
}

export async function removeMatch(userId, targetId) {
  const matchId = [userId, targetId].sort().join('_')
  const batch = writeBatch(db)

  batch.update(doc(db, 'users', userId), {
    matches: arrayRemove(targetId),
    previousMatches: arrayUnion(targetId),
    [`swipes.${targetId}`]: deleteField(),
  })
  batch.update(doc(db, 'users', targetId), {
    matches: arrayRemove(userId),
    previousMatches: arrayUnion(userId),
    [`swipes.${userId}`]: deleteField(),
  })

  await batch.commit()
  await removeChatForUser(matchId, userId)
  invalidateUser(userId)
  invalidateUser(targetId)
}

export async function blockUser(userId, targetId) {
  const matchId = [userId, targetId].sort().join('_')
  const batch = writeBatch(db)

  batch.update(doc(db, 'users', userId), {
    blocked: arrayUnion(targetId),
    matches: arrayRemove(targetId),
    previousMatches: arrayUnion(targetId),
  })
  batch.update(doc(db, 'users', targetId), {
    matches: arrayRemove(userId),
    previousMatches: arrayUnion(userId),
  })

  const chatRef = doc(db, 'chats', matchId)
  const chatSnap = await getDoc(chatRef)
  if (chatSnap.exists()) {
    batch.update(chatRef, { blockedBy: arrayUnion(userId) })
  }

  await batch.commit()
  invalidateUser(userId)
  invalidateUser(targetId)
}

export async function unmatchUser(userId, targetId) {
  await removeMatch(userId, targetId)
}

export async function fetchDeletedUser(userId) {
  const snap = await getDoc(doc(db, 'deletedUsers', userId))
  if (!snap.exists()) return null
  const data = snap.data()
  return {
    id: userId,
    username: data.username || 'User',
    deleted: true,
  }
}

export async function deleteAccount(userId, username) {
  const userSnap = await getDoc(doc(db, 'users', userId))
  const userData = userSnap.data() || {}
  const normalizedUsername = normalizeUsername(username || userData.username || '')

  const chatsSnap = await getDocs(
    query(collection(db, 'chats'), where('participants', 'array-contains', userId))
  )

  const batch = writeBatch(db)
  batch.delete(doc(db, 'users', userId))
  if (normalizedUsername) {
    batch.set(doc(db, 'usernames', normalizedUsername), {
      userId: null,
      deleted: true,
      deletedAt: serverTimestamp(),
    })
  }

  batch.set(doc(db, 'deletedUsers', userId), {
    username: normalizedUsername || 'User',
    deletedAt: serverTimestamp(),
  })

  const affectedParticipants = new Set()

  for (const chatDoc of chatsSnap.docs) {
    const chatData = chatDoc.data()
    if (chatData.isSavedMessages) continue

    const chatUpdates = {
      opponentRemoved: true,
      [`removedUsers.${userId}`]: normalizedUsername || 'User',
      [`unreadCount.${userId}`]: 0,
    }

    if (chatData.lastMessage?.senderId === userId) {
      chatUpdates['lastMessage.read'] = true
      for (const participantId of chatData.participants || []) {
        if (participantId !== userId) {
          chatUpdates[`unreadCount.${participantId}`] = 0
        }
      }
    }

    batch.update(chatDoc.ref, chatUpdates)

    for (const participantId of chatData.participants || []) {
      if (participantId !== userId) affectedParticipants.add(participantId)
    }
  }

  for (const participantId of affectedParticipants) {
    batch.update(doc(db, 'users', participantId), {
      matches: arrayRemove(userId),
      previousMatches: arrayUnion(userId),
    })
  }

  await deleteAllUserStories(userId)
  await batch.commit()
  invalidateUser(userId)
}

export function setupPresence(userId) {
  const presenceRef = ref(rtdb, `presence/${userId}`)
  set(presenceRef, { online: true, lastSeen: Date.now() })
  onDisconnect(presenceRef).set({ online: false, lastSeen: Date.now() })
}

export function subscribePresence(userId, callback) {
  const presenceRef = ref(rtdb, `presence/${userId}`)
  onValue(presenceRef, (snap) => callback(snap.val()))
  return () => off(presenceRef)
}

export async function unblockUser(userId, targetId) {
  const matchId = [userId, targetId].sort().join('_')
  const batch = writeBatch(db)

  batch.update(doc(db, 'users', userId), {
    blocked: arrayRemove(targetId),
  })

  const chatRef = doc(db, 'chats', matchId)
  const chatSnap = await getDoc(chatRef)
  if (chatSnap.exists()) {
    const blockedBy = (chatSnap.data()?.blockedBy || []).filter((id) => id !== userId)
    batch.update(chatRef, { blockedBy })
  }

  await batch.commit()
  invalidateUser(userId)
  invalidateUser(targetId)
}

export async function resetAllMatchesForUser(userId) {
  const userRef = doc(db, 'users', userId)
  const userSnap = await getDoc(userRef)
  if (!userSnap.exists()) return

  const matches = userSnap.data()?.matches || []
  const batch = writeBatch(db)

  const userResetPayload = { matches: [] }
  if (matches.length > 0) {
    userResetPayload.previousMatches = arrayUnion(...matches)
  }
  batch.update(userRef, userResetPayload)

  for (const targetId of matches) {
    const otherRef = doc(db, 'users', targetId)
    batch.update(otherRef, {
      matches: arrayRemove(userId),
      previousMatches: arrayUnion(userId),
    })

    const matchId = [userId, targetId].sort().join('_')
    const messagesSnap = await getDocs(collection(db, 'chats', matchId, 'messages'))
    messagesSnap.docs.forEach((d) => batch.delete(d.ref))
    batch.delete(doc(db, 'chats', matchId))
  }

  await batch.commit()
  invalidateUser(userId)
}

export async function deleteAllAccountsData() {
  const usersSnap = await getDocs(collection(db, 'users'))
  const usernamesSnap = await getDocs(collection(db, 'usernames'))
  const chatsSnap = await getDocs(collection(db, 'chats'))

  const batch = writeBatch(db)

  for (const userDoc of usersSnap.docs) {
    const likesSnap = await getDocs(collection(db, 'users', userDoc.id, 'likesReceived'))
    likesSnap.docs.forEach((d) => batch.delete(d.ref))
    batch.delete(userDoc.ref)
  }

  usernamesSnap.docs.forEach((docSnap) => batch.delete(docSnap.ref))

  for (const chatDoc of chatsSnap.docs) {
    const messagesSnap = await getDocs(collection(db, 'chats', chatDoc.id, 'messages'))
    messagesSnap.docs.forEach((d) => batch.delete(d.ref))
    batch.delete(chatDoc.ref)
  }

  await batch.commit()

  // Clear Realtime Database app state.
  await set(ref(rtdb, 'presence'), null)
  await set(ref(rtdb, 'typing'), null)
}
