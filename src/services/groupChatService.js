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
  serverTimestamp,
  arrayUnion,
  arrayRemove,
  deleteField,
} from 'firebase/firestore'
import { db } from '../firebase/config'
import {
  DEFAULT_GROUP_SETTINGS,
  DEFAULT_ADMIN_PERMISSIONS,
  generateInviteCode,
  isGroupAdmin,
  isGroupMember,
  isGroupOwner,
  canAdmin,
} from '../utils/groupChat'

function normalizeGroupName(name) {
  return name.trim().slice(0, 64)
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

export async function createGroupChat(creatorId, { name, description = '', settings = {} } = {}) {
  const trimmedName = normalizeGroupName(name)
  if (!trimmedName) throw new Error('Group name is required')

  const inviteCode = await uniqueInviteCode()
  const chatRef = doc(collection(db, 'chats'))
  const mergedSettings = { ...DEFAULT_GROUP_SETTINGS, ...settings }

  const chatData = {
    type: 'group',
    name: trimmedName,
    nameLower: trimmedName.toLowerCase(),
    description: description.trim().slice(0, 280),
    participants: [creatorId],
    admins: [creatorId],
    createdBy: creatorId,
    createdAt: serverTimestamp(),
    inviteCode,
    settings: mergedSettings,
    adminSettings: {},
    lastMessage: null,
    mutedBy: [],
    pinnedBy: [],
    hiddenFor: [],
    unreadCount: { [creatorId]: 0 },
  }

  await setDoc(chatRef, chatData)
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

export async function getGroupById(chatId) {
  const snap = await getDoc(doc(db, 'chats', chatId))
  if (!snap.exists() || snap.data()?.type !== 'group') return null
  return { id: snap.id, ...snap.data() }
}

export async function joinGroupChat(chatId, userId) {
  const chatRef = doc(db, 'chats', chatId)
  const snap = await getDoc(chatRef)
  if (!snap.exists() || snap.data()?.type !== 'group') {
    throw new Error('Group not found')
  }

  const data = snap.data()
  if (data.participants?.includes(userId)) {
    const hiddenFor = data.hiddenFor || []
    if (hiddenFor.includes(userId)) {
      await updateDoc(chatRef, {
        hiddenFor: hiddenFor.filter((id) => id !== userId),
        [`unreadCount.${userId}`]: 0,
      })
    }
    return { id: snap.id, ...data }
  }

  await updateDoc(chatRef, {
    participants: arrayUnion(userId),
    [`unreadCount.${userId}`]: 0,
    hiddenFor: arrayRemove(userId),
  })

  const updated = await getDoc(chatRef)
  return { id: updated.id, ...updated.data() }
}

export async function joinGroupByInviteCode(inviteCode, userId) {
  const group = await getGroupByInviteCode(inviteCode)
  if (!group) throw new Error('Invalid invite link')
  if (!group.settings?.joinViaLink) throw new Error('This group does not allow joining via link')
  return joinGroupChat(group.id, userId)
}

export async function joinGroupViaButton(chatId, userId) {
  const group = await getGroupById(chatId)
  if (!group) throw new Error('Group not found')
  if (!group.settings?.joinViaButton) throw new Error('This group does not allow joining from settings')
  return joinGroupChat(chatId, userId)
}

export async function leaveGroupChat(chatId, userId) {
  const chatRef = doc(db, 'chats', chatId)
  const snap = await getDoc(chatRef)
  if (!snap.exists() || snap.data()?.type !== 'group') {
    throw new Error('Group not found')
  }

  const data = snap.data()
  if (!data.participants?.includes(userId)) return

  const updates = {
    participants: arrayRemove(userId),
    admins: arrayRemove(userId),
    mutedBy: arrayRemove(userId),
    pinnedBy: arrayRemove(userId),
    hiddenFor: arrayUnion(userId),
    [`unreadCount.${userId}`]: deleteField(),
    [`adminSettings.${userId}`]: deleteField(),
  }

  await updateDoc(chatRef, updates)

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

export async function searchPublicGroups(searchQuery, { excludeChatIds = [] } = {}) {
  const normalized = searchQuery.trim().toLowerCase()
  if (normalized.length < 2) return []

  const snap = await getDocs(
    query(
      collection(db, 'chats'),
      where('type', '==', 'group'),
      where('settings.visibility', '==', 'public'),
      limit(80)
    )
  )

  const excluded = new Set(excludeChatIds)
  return snap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter((group) => {
      if (excluded.has(group.id)) return false
      const name = group.nameLower || group.name?.toLowerCase() || ''
      return name.includes(normalized)
    })
    .slice(0, 20)
}

export async function updateGroupInfo(chatId, userId, { name, description }) {
  const chatRef = doc(db, 'chats', chatId)
  const snap = await getDoc(chatRef)
  if (!snap.exists() || snap.data()?.type !== 'group') throw new Error('Group not found')
  if (!canAdmin(snap.data(), userId, 'editGroupInfo')) throw new Error('You do not have permission to edit this group')

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

  const current = snap.data().settings || {}
  const next = { ...current, ...settingsPatch }
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

export async function addGroupAdmin(chatId, actorId, targetUserId) {
  const chatRef = doc(db, 'chats', chatId)
  const snap = await getDoc(chatRef)
  if (!snap.exists() || snap.data()?.type !== 'group') throw new Error('Group not found')

  const data = snap.data()
  if (!canAdmin(data, actorId, 'manageAdmins')) throw new Error('You do not have permission to manage admins')
  if (!data.participants?.includes(targetUserId)) throw new Error('User is not a member')

  await updateDoc(chatRef, {
    admins: arrayUnion(targetUserId),
    [`adminSettings.${targetUserId}`]: data.adminSettings?.[targetUserId] || { ...DEFAULT_ADMIN_PERMISSIONS },
  })
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
  })
}

export async function addGroupMember(chatId, actorId, memberId) {
  const chatRef = doc(db, 'chats', chatId)
  const snap = await getDoc(chatRef)
  if (!snap.exists() || snap.data()?.type !== 'group') throw new Error('Group not found')
  if (!canAdmin(snap.data(), actorId, 'addMembers')) throw new Error('You do not have permission to add members')

  await updateDoc(chatRef, {
    participants: arrayUnion(memberId),
    [`unreadCount.${memberId}`]: 0,
    hiddenFor: arrayRemove(memberId),
  })
}

export async function removeGroupMember(chatId, actorId, memberId) {
  const chatRef = doc(db, 'chats', chatId)
  const snap = await getDoc(chatRef)
  if (!snap.exists() || snap.data()?.type !== 'group') throw new Error('Group not found')

  const data = snap.data()
  if (!canAdmin(data, actorId, 'removeMembers')) throw new Error('You do not have permission to remove members')
  if (memberId === data.createdBy) throw new Error('Cannot remove the group owner')

  await updateDoc(chatRef, {
    participants: arrayRemove(memberId),
    admins: arrayRemove(memberId),
    hiddenFor: arrayUnion(memberId),
    [`unreadCount.${memberId}`]: deleteField(),
    [`adminSettings.${memberId}`]: deleteField(),
  })
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
