export const DEFAULT_GROUP_SETTINGS = {
  visibility: 'private',
  joinViaLink: true,
  joinViaButton: false,
}

/** Normalize join settings from visibility (private = link only, public = search + link). */
export function normalizeGroupJoinSettings(settings = {}) {
  const visibility = settings.visibility === 'public' ? 'public' : 'private'
  if (visibility === 'public') {
    return { ...settings, visibility: 'public', joinViaLink: true, joinViaButton: true }
  }
  return { ...settings, visibility: 'private', joinViaLink: true, joinViaButton: false }
}

export const DEFAULT_GROUP_PHOTO_URL =
  'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTW1giTnfMYo-a9fxSEp3dZ9ELIt0ymWnLBcg&s'

export function getGroupPhotoUrl(chatOrUrl) {
  if (typeof chatOrUrl === 'string') {
    return chatOrUrl.trim() || DEFAULT_GROUP_PHOTO_URL
  }
  return chatOrUrl?.photoUrl?.trim() || DEFAULT_GROUP_PHOTO_URL
}

export const DEFAULT_ADMIN_PERMISSIONS = {
  editGroupInfo: true,
  addMembers: true,
  removeMembers: false,
  manageAdmins: false,
  manageInviteSettings: false,
  deleteMessages: false,
}

export const OWNER_ADMIN_PERMISSIONS = {
  editGroupInfo: true,
  addMembers: true,
  removeMembers: true,
  manageAdmins: true,
  manageInviteSettings: true,
  deleteMessages: true,
}

export function isGroupChat(chatOrId) {
  if (typeof chatOrId === 'object' && chatOrId !== null) {
    return chatOrId.type === 'group'
  }
  return false
}

export function isDirectChat(chat) {
  return Boolean(chat && !chat.isSavedMessages && chat.type !== 'group')
}

export function getOtherParticipantIds(participants = [], userId) {
  return participants.filter((id) => id !== userId)
}

export function getDirectOtherId(chat, userId) {
  if (isGroupChat(chat)) return null
  if (chat?.participants?.length) {
    return chat.participants.find((id) => id !== userId) || null
  }
  if (typeof chat === 'string' || chat?.id) {
    const chatId = typeof chat === 'string' ? chat : chat.id
    return chatId.split('_').find((id) => id !== userId) || null
  }
  return null
}

export function isGroupAdmin(chat, userId) {
  if (!chat || !userId) return false
  if (chat.createdBy === userId) return true
  return chat.admins?.includes(userId) ?? false
}

export function isGroupOwner(chat, userId) {
  return Boolean(chat?.createdBy && chat.createdBy === userId)
}

export function getAdminPermissions(chat, userId) {
  if (!isGroupAdmin(chat, userId)) {
    return {
      editGroupInfo: false,
      addMembers: false,
      removeMembers: false,
      manageAdmins: false,
      manageInviteSettings: false,
    }
  }
  if (isGroupOwner(chat, userId)) return { ...OWNER_ADMIN_PERMISSIONS }
  const stored = chat.adminSettings?.[userId] || {}
  const { role: _role, ...permissions } = stored
  return { ...DEFAULT_ADMIN_PERMISSIONS, ...permissions }
}

export function getGroupMemberRole(chat, userId) {
  if (!chat || !userId) return 'member'
  if (isGroupOwner(chat, userId)) return 'owner'
  if (chat.admins?.includes(userId)) return 'admin'
  return 'member'
}

export function getGroupRoleLabel(role) {
  switch (role) {
    case 'owner':
      return 'Owner'
    case 'admin':
      return 'Admin'
    default:
      return 'Member'
  }
}

export function getAdminDisplayLabel(chat, userId) {
  if (!chat || !userId) return null
  const role = getGroupMemberRole(chat, userId)
  if (role === 'member') return null
  if (role === 'owner') return 'Owner'
  const customTag = chat.adminTags?.[userId]?.trim()
  return customTag || 'Admin'
}

export function canAdmin(chat, userId, permission) {
  return getAdminPermissions(chat, userId)[permission] === true
}

export function hasFullAdminPermissions(permissions) {
  if (!permissions) return false
  return Object.keys(OWNER_ADMIN_PERMISSIONS).every((key) => permissions[key] === true)
}

export function isGroupMember(chat, userId) {
  return chat?.participants?.includes(userId) ?? false
}

export function isGroupMemberMuted(chat, userId) {
  return Boolean(chat?.mutedMemberIds?.includes(userId))
}

export function getGroupDisplayName(chat) {
  return chat?.name?.trim() || 'Group chat'
}

export function getGroupUsername(chat) {
  return chat?.username?.trim() || null
}

export function getGroupUsernameUrl(username) {
  const handle = username?.trim()
  if (!handle) return null
  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  return `${origin}/join/${handle}`
}

export function getGroupJoinLink(chat) {
  const username = getGroupUsername(chat)
  if (username) return getGroupUsernameUrl(username)
  if (chat?.inviteCode) return getGroupInviteUrl(chat.inviteCode)
  return null
}

export function getGroupInviteUrl(inviteCode) {
  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  return `${origin}/join/${inviteCode}`
}

export function generateInviteCode() {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
  let code = ''
  for (let i = 0; i < 10; i++) {
    code += chars[Math.floor(Math.random() * chars.length)]
  }
  return code
}

export function getGroupMemberProfileIds(chat, messageSenderIds = []) {
  return [
    ...new Set([
      ...(chat?.participants || []),
      ...(chat?.memberHistory || []),
      ...messageSenderIds,
    ]),
  ]
}

export function formatGroupPreview(lastMessage, senderName) {
  if (!lastMessage?.text) return 'Start a conversation'
  if (senderName) return `${senderName}: ${lastMessage.text}`
  return lastMessage.text
}
