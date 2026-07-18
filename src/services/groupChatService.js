import {
  collection,
  doc,
  setDoc,
  updateDoc,
  getDoc,
  getDocs,
  query,
  where,
  limit,
  documentId,
  serverTimestamp,
  arrayUnion,
  arrayRemove,
  deleteField,
  runTransaction,
  deleteDoc,
  writeBatch,
  onSnapshot,
  orderBy,
} from 'firebase/firestore'
import { db } from '../firebase/config'
import {
  DEFAULT_GROUP_SETTINGS,
  DEFAULT_ADMIN_PERMISSIONS,
  DEFAULT_GROUP_PHOTO_URL,
  generateInviteCode,
  isGroupOwner,
  canAdmin,
  normalizeGroupJoinSettings,
} from '../utils/groupChat'
import { normalizeUsername, validateUsername } from '../utils/helpers'
import { pushInboxNotification } from './inboxService'
import { postSystemMessage, SYSTEM_EVENTS } from './systemChatMessage'

function normalizeGroupName(name) {
  return name.trim().slice(0, 64)
}

function normalizeGroupUsername(username) {
  return normalizeUsername(username)
}

/** Keep meetup docs / user activeMeetupId in sync when chat membership changes. */
async function stripMemberFromMeetup(chatData, memberId) {
  if (!chatData?.isMeetup || !chatData.meetupId || !memberId) return

  const meetupId = chatData.meetupId
  const meetupRef = doc(db, 'meetups', meetupId)
  await updateDoc(meetupRef, { participants: arrayRemove(memberId) }).catch(() => {})

  const userRef = doc(db, 'users', memberId)
  const userSnap = await getDoc(userRef).catch(() => null)
  if (userSnap?.exists() && userSnap.data()?.activeMeetupId === meetupId) {
    await updateDoc(userRef, { activeMeetupId: deleteField() }).catch(() => {})
  }

  const hostId = chatData.createdBy
  if (!hostId) return
  try {
    const storiesSnap = await getDocs(collection(db, 'users', hostId, 'stories'))
    const batch = writeBatch(db)
    let updates = 0
    storiesSnap.docs.forEach((storyDoc) => {
      const story = storyDoc.data()
      if (story.storyKind !== 'meetup' || story.meetupId !== meetupId) return
      const ids = story.meetupParticipantIds
      if (!Array.isArray(ids) || !ids.includes(memberId)) return
      const nextIds = ids.filter((id) => id !== memberId)
      const nextGenders = { ...(story.meetupParticipantGenders || {}) }
      delete nextGenders[memberId]
      batch.update(storyDoc.ref, {
        meetupParticipantIds: nextIds,
        meetupParticipantGenders: nextGenders,
      })
      updates += 1
    })
    if (updates > 0) await batch.commit()
  } catch {
    // Story rings fall back to live meetup participants.
  }
}

async function clearPendingJoinRequest(chatId, memberId) {
  if (!chatId || !memberId) return
  await deleteDoc(doc(db, 'chats', chatId, 'joinRequests', memberId)).catch(() => {})
}

function assertNotBanned(chatData, userId) {
  if (chatData?.bannedUserIds?.includes(userId)) {
    throw new Error(chatData.isMeetup ? 'You are banned from this meetup' : 'You are banned from this group')
  }
}

export async function getGroupUsernameAvailability(username, chatId = null) {
  const normalized = normalizeGroupUsername(username)
  if (!normalized) {
    return { available: false, error: 'Username is required' }
  }

  const validationError = validateUsername(normalized)
  if (validationError) {
    return { available: false, error: validationError }
  }

  const userSnap = await getDoc(doc(db, 'usernames', normalized))
  if (userSnap.exists() && userSnap.data()?.deleted !== true) {
    return { available: false, error: 'This username is not available' }
  }

  const groupSnap = await getDoc(doc(db, 'groupUsernames', normalized))
  if (!groupSnap.exists()) return { available: true }
  if (chatId && groupSnap.data()?.chatId === chatId) return { available: true }
  return { available: false, error: 'Username is taken' }
}

async function reserveGroupUsername(chatId, username, previousUsername = null) {
  const normalized = normalizeGroupUsername(username)
  const validationError = validateUsername(normalized)
  if (validationError) throw new Error(validationError)

  const prevNormalized = previousUsername ? normalizeGroupUsername(previousUsername) : null
  const usernameRef = doc(db, 'groupUsernames', normalized)

  await runTransaction(db, async (transaction) => {
    const userSnap = await transaction.get(doc(db, 'usernames', normalized))
    if (userSnap.exists() && userSnap.data()?.deleted !== true) {
      throw new Error('This username is not available')
    }

    const snap = await transaction.get(usernameRef)
    if (snap.exists() && snap.data()?.chatId !== chatId) {
      throw new Error('Username is already taken')
    }

    transaction.set(usernameRef, { chatId })
    if (prevNormalized && prevNormalized !== normalized) {
      transaction.delete(doc(db, 'groupUsernames', prevNormalized))
    }
  })
}

async function releaseGroupUsername(username) {
  const normalized = normalizeGroupUsername(username)
  if (!normalized) return
  try {
    await deleteDoc(doc(db, 'groupUsernames', normalized))
  } catch {
    // already released
  }
}

async function uniqueInviteCode() {
  for (let attempt = 0; attempt < 8; attempt++) {
    const code = generateInviteCode()
    const snap = await getDocs(
      query(collection(db, 'chats'), where('inviteCode', '==', code), limit(1))
    )
    if (snap.empty) return code
  }
  throw new Error('Could not generate invite code')
}

export async function createGroupChat(
  creatorId,
  { name, description = '', username = '', settings = {} } = {}
) {
  const trimmedName = normalizeGroupName(name)
  if (!trimmedName) throw new Error('Group name is required')

  const mergedSettings = normalizeGroupJoinSettings({ ...DEFAULT_GROUP_SETTINGS, ...settings })
  const isPublic = mergedSettings.visibility === 'public'
  const normalizedUsername = normalizeGroupUsername(username)

  if (isPublic) {
    if (!normalizedUsername) throw new Error('Group username is required for public groups')
    const { available, error } = await getGroupUsernameAvailability(normalizedUsername)
    if (!available) throw new Error(error || 'Username is not available')
  }

  const inviteCode = await uniqueInviteCode()
  const chatRef = doc(collection(db, 'chats'))

  const chatData = {
    type: 'group',
    name: trimmedName,
    nameLower: trimmedName.toLowerCase(),
    description: description.trim().slice(0, 280),
    photoUrl: DEFAULT_GROUP_PHOTO_URL,
    participants: [creatorId],
    admins: [creatorId],
    createdBy: creatorId,
    createdAt: serverTimestamp(),
    inviteCode,
    settings: mergedSettings,
    adminSettings: {},
    adminTags: {},
    bannedUserIds: [],
    mutedMemberIds: [],
    lastMessage: null,
    mutedBy: [],
    pinnedBy: [],
    hiddenFor: [],
    unreadCount: { [creatorId]: 0 },
    memberHistory: [creatorId],
  }

  if (isPublic) {
    chatData.username = normalizedUsername
    chatData.usernameLower = normalizedUsername
  }

  await setDoc(chatRef, chatData)

  if (isPublic) {
    await reserveGroupUsername(chatRef.id, normalizedUsername)
  }

  await postSystemMessage(chatRef.id, {
    event: SYSTEM_EVENTS.CREATED,
    actorId: creatorId,
    isMeetup: false,
  }).catch(() => {})

  return { id: chatRef.id, ...chatData }
}

export async function createMeetupGroupChat(
  creatorId,
  { name, description = '', memberLimit = 0, expiresAt = null, meetupId = null } = {}
) {
  const trimmedName = normalizeGroupName(name) || 'Meetup'
  const inviteCode = await uniqueInviteCode()
  const chatRef = doc(collection(db, 'chats'))

  const mergedSettings = normalizeGroupJoinSettings({
    ...DEFAULT_GROUP_SETTINGS,
    visibility: 'private',
    joinViaLink: true,
    requireApproval: false,
  })

  const chatData = {
    type: 'group',
    isMeetup: true,
    meetupId,
    expiresAt,
    memberLimit: memberLimit || 0,
    name: trimmedName,
    nameLower: trimmedName.toLowerCase(),
    description: description.trim().slice(0, 280),
    photoUrl: DEFAULT_GROUP_PHOTO_URL,
    participants: [creatorId],
    admins: [creatorId],
    createdBy: creatorId,
    createdAt: serverTimestamp(),
    inviteCode,
    settings: mergedSettings,
    adminSettings: {},
    adminTags: {},
    bannedUserIds: [],
    mutedMemberIds: [],
    lastMessage: null,
    mutedBy: [],
    pinnedBy: [],
    hiddenFor: [],
    unreadCount: { [creatorId]: 0 },
    memberHistory: [creatorId],
  }

  await setDoc(chatRef, chatData)
  await postSystemMessage(chatRef.id, {
    event: SYSTEM_EVENTS.CREATED,
    actorId: creatorId,
    isMeetup: true,
  }).catch(() => {})
  return { id: chatRef.id, ...chatData }
}

export async function getGroupByInviteCode(inviteCode) {
  const normalized = inviteCode?.trim().toLowerCase()
  if (!normalized) return null

  const snap = await getDocs(
    query(collection(db, 'chats'), where('type', '==', 'group'), where('inviteCode', '==', normalized), limit(1))
  )
  if (snap.empty) return null
  const docSnap = snap.docs[0]
  return { id: docSnap.id, ...docSnap.data() }
}

export async function getGroupByUsername(username) {
  const normalized = normalizeGroupUsername(username)
  if (!normalized) return null

  const handleSnap = await getDoc(doc(db, 'groupUsernames', normalized))
  if (handleSnap.exists()) {
    return getGroupById(handleSnap.data().chatId)
  }

  const snap = await getDocs(
    query(
      collection(db, 'chats'),
      where('type', '==', 'group'),
      where('usernameLower', '==', normalized),
      limit(1)
    )
  )
  if (snap.empty) {
    const fallback = await getDocs(
      query(collection(db, 'chats'), where('type', '==', 'group'), limit(200))
    )
    const match = fallback.docs.find((d) => {
      const data = d.data()
      return normalizeGroupUsername(data.username) === normalized
    })
    if (!match) return null
    return { id: match.id, ...match.data() }
  }
  const docSnap = snap.docs[0]
  return { id: docSnap.id, ...docSnap.data() }
}

export async function resolveGroupJoinSlug(slug) {
  const byCode = await getGroupByInviteCode(slug)
  if (byCode) return byCode
  return getGroupByUsername(slug)
}

export async function getGroupById(chatId) {
  const snap = await getDoc(doc(db, 'chats', chatId))
  if (!snap.exists() || snap.data()?.type !== 'group') return null
  return { id: snap.id, ...snap.data() }
}

function getGroupAdminIds(chat) {
  const ids = new Set([chat.createdBy, ...(chat.admins || [])].filter(Boolean))
  return [...ids]
}

async function notifyGroupAdmins(chat, payload) {
  const adminIds = getGroupAdminIds(chat)
  await Promise.all(
    adminIds.map((adminId) =>
      pushInboxNotification(adminId, payload).catch(() => {})
    )
  )
}

export function subscribeGroupJoinRequests(chatId, callback, onError) {
  if (!chatId) return () => {}

  const requestsRef = collection(db, 'chats', chatId, 'joinRequests')

  return onSnapshot(
    requestsRef,
    (snap) => {
      callback(
        snap.docs
          .map((d) => ({ id: d.id, ...d.data() }))
          .filter((req) => req.status === 'pending')
          .sort((a, b) => {
            const aTime = a.requestedAt?.toMillis?.() ?? a.requestedAt ?? 0
            const bTime = b.requestedAt?.toMillis?.() ?? b.requestedAt ?? 0
            return bTime - aTime
          })
      )
    },
    (err) => {
      onError?.(err)
      callback([])
    }
  )
}

export async function requestGroupJoin(chatId, userId, username = '') {
  const chatRef = doc(db, 'chats', chatId)
  const snap = await getDoc(chatRef)
  if (!snap.exists() || snap.data()?.type !== 'group') {
    throw new Error('Group not found')
  }

  const data = snap.data()
  if (data.bannedUserIds?.includes(userId)) {
    throw new Error('You are banned from this group')
  }
  if (data.participants?.includes(userId)) {
    return { status: 'joined', chat: { id: snap.id, ...data } }
  }

  const requestRef = doc(db, 'chats', chatId, 'joinRequests', userId)
  const existing = await getDoc(requestRef)
  if (existing.exists() && existing.data()?.status === 'pending') {
    return { status: 'pending' }
  }

  await setDoc(requestRef, {
    userId,
    username: username || 'User',
    status: 'pending',
    requestedAt: serverTimestamp(),
  })

  await notifyGroupAdmins(data, {
    type: 'group_join_request',
    chatId,
    actorId: userId,
    actorUsername: username || 'User',
    groupName: data.name || 'Group',
  })

  return { status: 'pending' }
}

export async function approveGroupJoinRequest(chatId, adminId, requestUserId) {
  const chatRef = doc(db, 'chats', chatId)
  const snap = await getDoc(chatRef)
  if (!snap.exists() || snap.data()?.type !== 'group') throw new Error('Group not found')

  const data = snap.data()
  if (!canAdmin(data, adminId, 'addMembers') && !isGroupOwner(data, adminId)) {
    throw new Error('You do not have permission to approve join requests')
  }
  assertNotBanned(data, requestUserId)

  const requestRef = doc(db, 'chats', chatId, 'joinRequests', requestUserId)
  const requestSnap = await getDoc(requestRef)
  if (!requestSnap.exists() || requestSnap.data()?.status !== 'pending') {
    throw new Error('Join request not found')
  }

  await updateDoc(chatRef, {
    participants: arrayUnion(requestUserId),
    memberHistory: arrayUnion(requestUserId),
    [`unreadCount.${requestUserId}`]: 0,
    hiddenFor: arrayRemove(requestUserId),
  })

  await deleteDoc(requestRef)

  await postSystemMessage(chatId, {
    event: SYSTEM_EVENTS.JOINED,
    actorId: requestUserId,
    actorUsername: requestSnap.data()?.username || '',
    isMeetup: data.isMeetup === true,
  }).catch(() => {})

  await pushInboxNotification(requestUserId, {
    type: 'group_join_approved',
    chatId,
    actorId: adminId,
    groupName: data.name || 'Group',
  })

  const updated = await getDoc(chatRef)
  return { id: updated.id, ...updated.data() }
}

export async function denyGroupJoinRequest(chatId, adminId, requestUserId) {
  const chatRef = doc(db, 'chats', chatId)
  const snap = await getDoc(chatRef)
  if (!snap.exists() || snap.data()?.type !== 'group') throw new Error('Group not found')

  const data = snap.data()
  if (!canAdmin(data, adminId, 'addMembers') && !isGroupOwner(data, adminId)) {
    throw new Error('You do not have permission to deny join requests')
  }

  const requestRef = doc(db, 'chats', chatId, 'joinRequests', requestUserId)
  const requestSnap = await getDoc(requestRef)
  if (!requestSnap.exists()) throw new Error('Join request not found')

  await deleteDoc(requestRef)

  await pushInboxNotification(requestUserId, {
    type: 'group_join_denied',
    chatId,
    actorId: adminId,
    groupName: data.name || 'Group',
  })
}

export async function joinGroupChat(chatId, userId, { username = '' } = {}) {
  const chatRef = doc(db, 'chats', chatId)
  const snap = await getDoc(chatRef)
  if (!snap.exists() || snap.data()?.type !== 'group') {
    throw new Error('Group not found')
  }

  const data = snap.data()
  const settings = normalizeGroupJoinSettings(data.settings)

  if (data.bannedUserIds?.includes(userId)) {
    throw new Error('You are banned from this group')
  }
  if (data.participants?.includes(userId)) {
    const hiddenFor = data.hiddenFor || []
    if (hiddenFor.includes(userId)) {
      await updateDoc(chatRef, {
        hiddenFor: hiddenFor.filter((id) => id !== userId),
        [`unreadCount.${userId}`]: 0,
      })
    }
    return { status: 'joined', chat: { id: snap.id, ...data } }
  }

  if (settings.requireApproval) {
    return requestGroupJoin(chatId, userId, username)
  }

  await updateDoc(chatRef, {
    participants: arrayUnion(userId),
    memberHistory: arrayUnion(userId),
    [`unreadCount.${userId}`]: 0,
    hiddenFor: arrayRemove(userId),
  })

  await postSystemMessage(chatId, {
    event: SYSTEM_EVENTS.JOINED,
    actorId: userId,
    actorUsername: username,
    isMeetup: data.isMeetup === true,
  }).catch(() => {})

  const updated = await getDoc(chatRef)
  return { status: 'joined', chat: { id: updated.id, ...updated.data() } }
}

export async function joinGroupByInviteCode(inviteCode, userId, username = '') {
  const group = await resolveGroupJoinSlug(inviteCode)
  if (!group) throw new Error('Invalid invite link')
  const settings = normalizeGroupJoinSettings(group.settings)
  if (!settings.joinViaLink) throw new Error('This group does not allow joining via link')
  return joinGroupChat(group.id, userId, { username })
}

export async function joinGroupViaButton(chatId, userId, username = '') {
  const group = await getGroupById(chatId)
  if (!group) throw new Error('Group not found')
  const settings = normalizeGroupJoinSettings(group.settings)
  if (settings.visibility !== 'public') {
    throw new Error('This group can only be joined via invite link')
  }
  return joinGroupChat(chatId, userId, { username })
}

export async function leaveGroupChat(chatId, userId) {
  const chatRef = doc(db, 'chats', chatId)
  const snap = await getDoc(chatRef)
  if (!snap.exists() || snap.data()?.type !== 'group') {
    throw new Error('Group not found')
  }

  const data = snap.data()
  if (!data.participants?.includes(userId)) return

  await postSystemMessage(chatId, {
    event: SYSTEM_EVENTS.LEFT,
    actorId: userId,
    isMeetup: data.isMeetup === true,
  }).catch(() => {})

  const updates = {
    participants: arrayRemove(userId),
    admins: arrayRemove(userId),
    mutedBy: arrayRemove(userId),
    pinnedBy: arrayRemove(userId),
    mutedMemberIds: arrayRemove(userId),
    hiddenFor: arrayUnion(userId),
    [`unreadCount.${userId}`]: deleteField(),
    [`adminSettings.${userId}`]: deleteField(),
    [`adminTags.${userId}`]: deleteField(),
  }

  await updateDoc(chatRef, updates)
  await stripMemberFromMeetup(data, userId)
  await clearPendingJoinRequest(chatId, userId)

  const remaining = (data.participants || []).filter((id) => id !== userId)
  if (remaining.length === 0) {
    await updateDoc(chatRef, { hiddenFor: data.participants || [] })
  } else if (data.createdBy === userId && remaining.length > 0) {
    const nextOwner = data.admins?.find((id) => id !== userId && remaining.includes(id)) || remaining[0]
    await updateDoc(chatRef, {
      createdBy: nextOwner,
      admins: arrayUnion(nextOwner),
    })
  }
}

export async function searchPublicGroups(
  searchQuery,
  { excludeChatIds = [], userId = null, handlesOnly = false } = {}
) {
  const normalized = normalizeGroupUsername(searchQuery)
  if (normalized.length < 2) return []

  const excluded = new Set(excludeChatIds)
  const results = new Map()

  const addGroup = (group, { skipTextMatch = false } = {}) => {
    if (!group?.id || excluded.has(group.id)) return
    const isPublic = group.settings?.visibility === 'public'
    const isMember = Boolean(userId && group.participants?.includes(userId))
    if (!isPublic && !isMember) return

    if (!skipTextMatch) {
      const name = group.nameLower || group.name?.toLowerCase() || ''
      const handle = group.usernameLower || normalizeGroupUsername(group.username) || ''
      if (
        !name.includes(normalized) &&
        !handle.includes(normalized) &&
        handle !== normalized &&
        name !== normalized
      ) {
        return
      }
    }

    results.set(group.id, group)
  }

  try {
    const exactByUsername = await getGroupByUsername(normalized)
    if (exactByUsername) addGroup(exactByUsername, { skipTextMatch: true })
  } catch {
    // ignore
  }

  const handleDocs = await listGroupUsernameDocsForSearch(normalized)
  await Promise.all(
    handleDocs.map(async (handleDoc) => {
      const chatId = handleDoc.data()?.chatId
      if (!chatId) return
      try {
        addGroup(await getGroupById(chatId), { skipTextMatch: true })
      } catch {
        // ignore
      }
    })
  )

  // Live typeahead skips full public-group scans — those are expensive.
  if (!handlesOnly) {
    try {
      const publicGroups = await listPublicGroupsForSearch()
      publicGroups.forEach((group) => addGroup(group))
    } catch {
      // ignore
    }

    if (userId) {
      try {
        const memberSnap = await getDocs(
          query(
            collection(db, 'chats'),
            where('type', '==', 'group'),
            where('participants', 'array-contains', userId),
            limit(30)
          )
        )
        memberSnap.docs.forEach((d) => addGroup({ id: d.id, ...d.data() }))
      } catch {
        try {
          const allSnap = await getDocs(
            query(collection(db, 'chats'), where('type', '==', 'group'), limit(100))
          )
          allSnap.docs.forEach((d) => {
            const data = d.data()
            if (data.participants?.includes(userId)) {
              addGroup({ id: d.id, ...data })
            }
          })
        } catch {
          // ignore
        }
      }
    }
  }

  return Array.from(results.values()).slice(0, 20)
}

async function listGroupUsernameDocsForSearch(normalized) {
  const docs = new Map()

  try {
    const exactSnap = await getDoc(doc(db, 'groupUsernames', normalized))
    if (exactSnap.exists()) docs.set(exactSnap.id, exactSnap)
  } catch {
    // ignore
  }

  try {
    const prefixSnap = await getDocs(
      query(
        collection(db, 'groupUsernames'),
        where(documentId(), '>=', normalized),
        where(documentId(), '<=', normalized + '\uf8ff'),
        limit(20)
      )
    )
    prefixSnap.docs.forEach((d) => docs.set(d.id, d))
  } catch {
    try {
      const allSnap = await getDocs(collection(db, 'groupUsernames'))
      allSnap.docs.forEach((d) => {
        if (d.id.includes(normalized)) docs.set(d.id, d)
      })
    } catch {
      // ignore
    }
  }

  return Array.from(docs.values())
}

async function listPublicGroupsForSearch() {
  try {
    const snap = await getDocs(
      query(
        collection(db, 'chats'),
        where('type', '==', 'group'),
        where('settings.visibility', '==', 'public'),
        limit(80)
      )
    )
    return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
  } catch {
    const snap = await getDocs(
      query(collection(db, 'chats'), where('type', '==', 'group'), limit(120))
    )
    return snap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .filter((g) => g.settings?.visibility === 'public')
  }
}

export async function updateGroupInfo(chatId, userId, { name, description, photoUrl, username } = {}) {
  const chatRef = doc(db, 'chats', chatId)
  const snap = await getDoc(chatRef)
  if (!snap.exists() || snap.data()?.type !== 'group') throw new Error('Group not found')
  if (!canAdmin(snap.data(), userId, 'editGroupInfo')) throw new Error('You do not have permission to edit this group')

  const data = snap.data()
  const updates = {}
  if (name != null) {
    const trimmed = normalizeGroupName(name)
    if (!trimmed) throw new Error('Group name is required')
    updates.name = trimmed
    updates.nameLower = trimmed.toLowerCase()
  }
  if (description != null) {
    updates.description = description.trim().slice(0, 280)
  }
  if (photoUrl != null) {
    const trimmed = photoUrl.trim()
    updates.photoUrl = trimmed ? trimmed.slice(0, 500) : deleteField()
  }
  if (username != null) {
    const isPublic = data.settings?.visibility === 'public'
    const normalized = normalizeGroupUsername(username)
    if (isPublic) {
      if (!normalized) throw new Error('Group username is required for public groups')
      const { available, error } = await getGroupUsernameAvailability(normalized, chatId)
      if (!available) throw new Error(error || 'Username is not available')
      await reserveGroupUsername(chatId, normalized, data.username)
      updates.username = normalized
      updates.usernameLower = normalized
    } else if (normalized) {
      updates.username = normalized
      updates.usernameLower = normalized
    }
  }

  if (Object.keys(updates).length === 0) return
  await updateDoc(chatRef, updates)
}

export async function updateGroupSettings(chatId, userId, settingsPatch) {
  const chatRef = doc(db, 'chats', chatId)
  const snap = await getDoc(chatRef)
  if (!snap.exists() || snap.data()?.type !== 'group') throw new Error('Group not found')
  if (!canAdmin(snap.data(), userId, 'manageInviteSettings')) {
    throw new Error('You do not have permission to change group settings')
  }

  const data = snap.data()
  const current = normalizeGroupJoinSettings(data.settings || {})
  const next = normalizeGroupJoinSettings({ ...current, ...settingsPatch })

  if (next.visibility === 'public' && current.visibility !== 'public') {
    const normalized = data.usernameLower || normalizeGroupUsername(data.username)
    if (!normalized) {
      throw new Error('Set a group username before making the group public')
    }
    const { available, error } = await getGroupUsernameAvailability(normalized, chatId)
    if (!available) throw new Error(error || 'Username is not available')
    await reserveGroupUsername(chatId, normalized, data.username)
    await updateDoc(chatRef, {
      settings: next,
      username: normalized,
      usernameLower: normalized,
    })
    return
  }

  if (next.visibility === 'private' && current.visibility === 'public' && data.username) {
    await releaseGroupUsername(data.username)
    await updateDoc(chatRef, {
      settings: next,
      username: deleteField(),
      usernameLower: deleteField(),
    })
    return
  }

  await updateDoc(chatRef, { settings: next })
}

export async function updateAdminPermissions(chatId, actorId, targetUserId, permissions) {
  const chatRef = doc(db, 'chats', chatId)
  const snap = await getDoc(chatRef)
  if (!snap.exists() || snap.data()?.type !== 'group') throw new Error('Group not found')

  const data = snap.data()
  if (!isGroupOwner(data, actorId)) throw new Error('Only the group owner can manage admin permissions')
  if (targetUserId === data.createdBy) throw new Error('Cannot change owner permissions')
  if (!data.admins?.includes(targetUserId)) throw new Error('User is not an admin')

  await updateDoc(chatRef, {
    [`adminSettings.${targetUserId}`]: {
      ...DEFAULT_ADMIN_PERMISSIONS,
      ...permissions,
    },
  })
}

export async function setAdminTag(chatId, actorId, targetUserId, tag) {
  const chatRef = doc(db, 'chats', chatId)
  const snap = await getDoc(chatRef)
  if (!snap.exists() || snap.data()?.type !== 'group') throw new Error('Group not found')

  const data = snap.data()
  if (!isGroupOwner(data, actorId)) throw new Error('Only the group owner can set admin tags')
  if (targetUserId === data.createdBy) throw new Error('Cannot tag the group owner')
  if (!data.admins?.includes(targetUserId)) throw new Error('User is not an admin')

  const trimmed = tag?.trim().slice(0, 32) || ''
  if (trimmed) {
    await updateDoc(chatRef, { [`adminTags.${targetUserId}`]: trimmed })
  } else {
    await updateDoc(chatRef, { [`adminTags.${targetUserId}`]: deleteField() })
  }
}

export async function setGroupMemberRole(chatId, actorId, targetUserId, role) {
  const chatRef = doc(db, 'chats', chatId)
  const snap = await getDoc(chatRef)
  if (!snap.exists() || snap.data()?.type !== 'group') throw new Error('Group not found')

  const data = snap.data()
  if (targetUserId === data.createdBy) throw new Error('Cannot change the group owner role')
  if (!canAdmin(data, actorId, 'manageAdmins') && !isGroupOwner(data, actorId)) {
    throw new Error('You do not have permission to manage admins')
  }
  if (!data.participants?.includes(targetUserId)) throw new Error('User is not a member')

  if (role === 'member') {
    await updateDoc(chatRef, {
      admins: arrayRemove(targetUserId),
      [`adminSettings.${targetUserId}`]: deleteField(),
      [`adminTags.${targetUserId}`]: deleteField(),
    })
    return
  }

  if (role !== 'admin') throw new Error('Invalid role')

  await updateDoc(chatRef, {
    admins: arrayUnion(targetUserId),
    [`adminSettings.${targetUserId}`]: { ...DEFAULT_ADMIN_PERMISSIONS },
  })
}

export async function addGroupAdmin(chatId, actorId, targetUserId) {
  return setGroupMemberRole(chatId, actorId, targetUserId, 'admin')
}

export async function removeGroupAdmin(chatId, actorId, targetUserId) {
  const chatRef = doc(db, 'chats', chatId)
  const snap = await getDoc(chatRef)
  if (!snap.exists() || snap.data()?.type !== 'group') throw new Error('Group not found')

  const data = snap.data()
  if (!canAdmin(data, actorId, 'manageAdmins')) throw new Error('You do not have permission to manage admins')
  if (targetUserId === data.createdBy) throw new Error('Cannot remove the group owner')

  await updateDoc(chatRef, {
    admins: arrayRemove(targetUserId),
    [`adminSettings.${targetUserId}`]: deleteField(),
    [`adminTags.${targetUserId}`]: deleteField(),
  })
}

export async function transferGroupOwnership(chatId, actorId, newOwnerId) {
  const chatRef = doc(db, 'chats', chatId)
  const snap = await getDoc(chatRef)
  if (!snap.exists() || snap.data()?.type !== 'group') throw new Error('Group not found')

  const data = snap.data()
  if (!isGroupOwner(data, actorId)) throw new Error('Only the group owner can transfer ownership')
  if (!data.participants?.includes(newOwnerId)) throw new Error('User is not a member')
  if (newOwnerId === actorId) throw new Error('Cannot transfer ownership to yourself')
  if (!data.admins?.includes(newOwnerId)) throw new Error('Only an admin can become owner')

  await updateDoc(chatRef, {
    createdBy: newOwnerId,
    admins: arrayUnion(newOwnerId),
    [`adminSettings.${newOwnerId}`]: deleteField(),
    [`adminTags.${newOwnerId}`]: deleteField(),
  })
}

export async function addGroupMember(chatId, actorId, memberId) {
  const chatRef = doc(db, 'chats', chatId)
  const snap = await getDoc(chatRef)
  if (!snap.exists() || snap.data()?.type !== 'group') throw new Error('Group not found')
  if (!canAdmin(snap.data(), actorId, 'addMembers')) throw new Error('You do not have permission to add members')

  const data = snap.data()
  assertNotBanned(data, memberId)
  const alreadyMember = data.participants?.includes(memberId)

  await updateDoc(chatRef, {
    participants: arrayUnion(memberId),
    memberHistory: arrayUnion(memberId),
    [`unreadCount.${memberId}`]: 0,
    hiddenFor: arrayRemove(memberId),
  })

  if (data.isMeetup && data.meetupId && !alreadyMember) {
    await updateDoc(doc(db, 'meetups', data.meetupId), {
      participants: arrayUnion(memberId),
    }).catch(() => {})
  }

  if (!alreadyMember) {
    await postSystemMessage(chatId, {
      event: SYSTEM_EVENTS.JOINED,
      actorId: memberId,
      isMeetup: data.isMeetup === true,
    }).catch(() => {})
  }
}

export async function removeGroupMember(chatId, actorId, memberId) {
  const chatRef = doc(db, 'chats', chatId)
  const snap = await getDoc(chatRef)
  if (!snap.exists() || snap.data()?.type !== 'group') throw new Error('Group not found')

  const data = snap.data()
  if (!canAdmin(data, actorId, 'removeMembers')) throw new Error('You do not have permission to remove members')
  if (memberId === data.createdBy) throw new Error('Cannot remove the group owner')

  await postSystemMessage(chatId, {
    event: SYSTEM_EVENTS.LEFT,
    actorId: memberId,
    isMeetup: data.isMeetup === true,
  }).catch(() => {})

  await updateDoc(chatRef, {
    participants: arrayRemove(memberId),
    admins: arrayRemove(memberId),
    mutedBy: arrayRemove(memberId),
    pinnedBy: arrayRemove(memberId),
    hiddenFor: arrayUnion(memberId),
    mutedMemberIds: arrayRemove(memberId),
    [`unreadCount.${memberId}`]: deleteField(),
    [`adminSettings.${memberId}`]: deleteField(),
    [`adminTags.${memberId}`]: deleteField(),
  })

  await stripMemberFromMeetup(data, memberId)
  await clearPendingJoinRequest(chatId, memberId)
}

export async function muteGroupMember(chatId, actorId, memberId) {
  const chatRef = doc(db, 'chats', chatId)
  const snap = await getDoc(chatRef)
  if (!snap.exists() || snap.data()?.type !== 'group') throw new Error('Group not found')

  const data = snap.data()
  if (!canAdmin(data, actorId, 'removeMembers')) {
    throw new Error('You do not have permission to mute members')
  }
  if (memberId === data.createdBy) throw new Error('Cannot mute the group owner')
  if (!data.participants?.includes(memberId)) throw new Error('Member not found')

  await updateDoc(chatRef, { mutedMemberIds: arrayUnion(memberId) })
}

export async function unmuteGroupMember(chatId, actorId, memberId) {
  const chatRef = doc(db, 'chats', chatId)
  const snap = await getDoc(chatRef)
  if (!snap.exists() || snap.data()?.type !== 'group') throw new Error('Group not found')

  const data = snap.data()
  if (!canAdmin(data, actorId, 'removeMembers')) {
    throw new Error('You do not have permission to unmute members')
  }

  await updateDoc(chatRef, { mutedMemberIds: arrayRemove(memberId) })
}

export async function banGroupMember(chatId, actorId, memberId) {
  const chatRef = doc(db, 'chats', chatId)
  const snap = await getDoc(chatRef)
  if (!snap.exists() || snap.data()?.type !== 'group') throw new Error('Group not found')

  const data = snap.data()
  if (!canAdmin(data, actorId, 'removeMembers')) {
    throw new Error('You do not have permission to ban members')
  }
  if (memberId === data.createdBy) throw new Error('Cannot ban the group owner')
  if (memberId === actorId) throw new Error('Cannot ban yourself')

  await updateDoc(chatRef, {
    participants: arrayRemove(memberId),
    admins: arrayRemove(memberId),
    mutedBy: arrayRemove(memberId),
    pinnedBy: arrayRemove(memberId),
    hiddenFor: arrayUnion(memberId),
    bannedUserIds: arrayUnion(memberId),
    mutedMemberIds: arrayRemove(memberId),
    [`unreadCount.${memberId}`]: deleteField(),
    [`adminSettings.${memberId}`]: deleteField(),
    [`adminTags.${memberId}`]: deleteField(),
  })

  await stripMemberFromMeetup(data, memberId)
  await clearPendingJoinRequest(chatId, memberId)
}

export async function regenerateInviteCode(chatId, userId) {
  const chatRef = doc(db, 'chats', chatId)
  const snap = await getDoc(chatRef)
  if (!snap.exists() || snap.data()?.type !== 'group') throw new Error('Group not found')
  if (!canAdmin(snap.data(), userId, 'manageInviteSettings')) {
    throw new Error('You do not have permission to manage invite links')
  }

  const inviteCode = await uniqueInviteCode()
  await updateDoc(chatRef, { inviteCode })
  return inviteCode
}

export async function deleteGroupChat(chatId, userId) {
  const chatRef = doc(db, 'chats', chatId)
  const snap = await getDoc(chatRef)
  if (!snap.exists() || snap.data()?.type !== 'group') throw new Error('Group not found')
  if (!isGroupOwner(snap.data(), userId)) throw new Error('Only the group owner can delete the group')

  const data = snap.data()
  if (data.username) {
    await releaseGroupUsername(data.username)
  }

  const messagesSnap = await getDocs(collection(db, 'chats', chatId, 'messages'))
  const batch = writeBatch(db)
  messagesSnap.docs.forEach((messageDoc) => batch.delete(messageDoc.ref))
  batch.delete(chatRef)
  await batch.commit()
}
