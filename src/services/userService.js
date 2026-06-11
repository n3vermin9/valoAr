import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  deleteField,
  collection,
  getDocs,
  query,
  where,
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
import { buildUsernameBase, normalizeUsername } from '../utils/helpers'
import { normalizeSocials, sanitizeProfileSocials, stripSocials } from '../utils/socialLinks'
import { removeChatForUser } from './chatService'
import { deleteAllUserStories } from './storyService'

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

export function subscribeToUser(userId, callback) {
  return onSnapshot(doc(db, 'users', userId), (snap) => {
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
      callback(data)
    } else {
      invalidateUser(userId)
      callback(null)
    }
  })
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
  return matchId
}

export function subscribeLikesReceived(userId, callback) {
  return onSnapshot(collection(db, 'users', userId, 'likesReceived'), (snap) => {
    const likes = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
    callback(likes)
  })
}

export async function acceptLike(userId, fromUserId) {
  await createMatch(userId, fromUserId)
}

export async function declineLike(userId, fromUserId) {
  await deleteDoc(doc(db, 'users', userId, 'likesReceived', fromUserId))
  await updateDoc(doc(db, 'users', userId), {
    [`swipes.${fromUserId}`]: 'pass',
  })
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

export function subscribeIncomingRequest(userId, fromUserId, callback) {
  return onSnapshot(doc(db, 'users', userId, 'likesReceived', fromUserId), (snap) => {
    callback(snap.exists() ? { id: snap.id, ...snap.data() } : null)
  })
}

export async function markLikeAsRead(userId, fromUserId) {
  await updateDoc(doc(db, 'users', userId, 'likesReceived', fromUserId), { read: true })
}

export async function getDiscoverProfiles(currentUser) {
  const usersSnap = await getDocs(collection(db, 'users'))
  const profiles = []

  for (const userDoc of usersSnap.docs) {
    const profile = { id: userDoc.id, ...userDoc.data() }
    if (profile.id === currentUser.id) continue
    if (currentUser.blocked?.includes(profile.id)) continue
    if (profile.blocked?.includes(currentUser.id)) continue
    if (currentUser.matches?.includes(profile.id)) continue
    if (currentUser.swipes?.[profile.id]) continue

    const likedMe = await getDoc(doc(db, 'users', currentUser.id, 'likesReceived', profile.id))
    if (likedMe.exists()) continue

    if (!genderMatchesPreference(profile.gender, currentUser.interestedIn)) continue
    if (!genderMatchesPreference(currentUser.gender, profile.interestedIn)) continue
    if (!ageInRange(currentUser.age, profile.age)) continue

    profiles.push(stripSocials(profile))
  }
  return profiles
}

export async function searchUsersByUsername(queryText, currentUser = null) {
  const normalized = normalizeUsername(queryText)
  if (!normalized) return []

  const usersSnap = await getDocs(collection(db, 'users'))
  const results = usersSnap.docs
    .map((userDoc) => ({ id: userDoc.id, ...userDoc.data() }))
    .filter((profile) => profile.username?.toLowerCase().includes(normalized))
    .sort((a, b) => {
      const aStarts = a.username?.toLowerCase().startsWith(normalized) ? 0 : 1
      const bStarts = b.username?.toLowerCase().startsWith(normalized) ? 0 : 1
      if (aStarts !== bStarts) return aStarts - bStarts
      return (a.username || '').localeCompare(b.username || '')
    })

  return results
    .slice(0, 50)
    .map((profile) => sanitizeProfileSocials(profile, currentUser))
}

function genderMatchesPreference(userGender, interestedIn) {
  if (interestedIn === 'both') return true
  if (interestedIn === 'men') return userGender === 'male'
  if (interestedIn === 'women') return userGender === 'female'
  return true
}

function ageInRange(userAge, targetAge, gap = 5) {
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
