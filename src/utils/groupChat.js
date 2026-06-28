export const DEFAULT_GROUP_SETTINGS = {
  visibility: 'private',
  joinViaLink: true,
  joinViaButton: true,
}

export const DEFAULT_ADMIN_PERMISSIONS = {
  editGroupInfo: true,
  addMembers: true,
  removeMembers: false,
  manageAdmins: false,
  manageInviteSettings: false,
}

export const OWNER_ADMIN_PERMISSIONS = {
  editGroupInfo: true,
  addMembers: true,
  removeMembers: true,
  manageAdmins: true,
  manageInviteSettings: true,
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
  return { ...DEFAULT_ADMIN_PERMISSIONS, ...(chat.adminSettings?.[userId] || {}) }
}

export function canAdmin(chat, userId, permission) {
  return getAdminPermissions(chat, userId)[permission] === true
}

export function isGroupMember(chat, userId) {
  return chat?.participants?.includes(userId) ?? false
}

export function getGroupDisplayName(chat) {
  return chat?.name?.trim() || 'Group chat'
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

export function formatGroupPreview(lastMessage, senderName) {
  if (!lastMessage?.text) return 'Start a conversation'
  if (senderName) return `${senderName}: ${lastMessage.text}`
  return lastMessage.text
}
