import {
  doc,
  collection,
  setDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  onSnapshot,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  getDoc,
  writeBatch,
  increment,
  deleteField,
  arrayUnion,
  arrayRemove,
} from 'firebase/firestore'
import { ref, set, remove, onValue, off } from 'firebase/database'
import { db, rtdb } from '../firebase/config'
import { getMatchId, getSavedMessagesChatId, formatMessagePreview } from '../utils/helpers'
import { isGroupChat, getDirectOtherId, getOtherParticipantIds, canAdmin, isGroupMemberMuted } from '../utils/groupChat'
import { getChatMuteMode, CHAT_MUTE_OFF, CHAT_MUTE_ALL } from '../utils/chatMute'
import { leaveGroupChat } from './groupChatService'
import { invalidateUser } from './userCache'

function getRecipientIds(chatData, matchId, senderId) {
  if (chatData?.isSavedMessages) return []
  if (isGroupChat(chatData)) {
    return getOtherParticipantIds(chatData.participants || [], senderId)
  }
  const otherId = getDirectOtherId(chatData, senderId) || matchId.split('_').find((id) => id !== senderId)
  return otherId ? [otherId] : []
}

export function getChatSortTime(chat, userId) {
  const lastMsgTime = chat.lastMessage?.createdAt?.toMillis?.()
  if (lastMsgTime) return lastMsgTime

  const openedAt = chat.lastOpenedAt?.[userId]
  const openedTime = openedAt?.toMillis?.() ?? (typeof openedAt === 'number' ? openedAt : 0)
  if (openedTime) return openedTime

  return chat.createdAt?.toMillis?.() ?? 0
}

export function getUnreadCount(chat, userId) {
  if (chat.isSavedMessages) return 0
  if (chat.opponentRemoved) return 0
  if (chat.unreadCount?.[userId] != null) return chat.unreadCount[userId]
  const lastMsg = chat.lastMessage
  if (!lastMsg || lastMsg.senderId === userId) return 0
  return 1
}

export async function syncRemovedOpponentChat(matchId, userId, otherUserId) {
  const otherSnap = await getDoc(doc(db, 'users', otherUserId))
  if (otherSnap.exists()) return null

  invalidateUser(otherUserId)

  const chatRef = doc(db, 'chats', matchId)
  const chatSnap = await getDoc(chatRef)
  if (!chatSnap.exists()) return null

  const data = chatSnap.data()
  const hasUnread =
    (data?.unreadCount?.[userId] ?? 0) > 0 ||
    (data?.lastMessage?.senderId === otherUserId && !data?.lastMessage?.read)

  if (!hasUnread && data?.opponentRemoved) return null

  let removedUsername = data?.removedUsers?.[otherUserId]
  if (!removedUsername) {
    const deletedSnap = await getDoc(doc(db, 'deletedUsers', otherUserId))
    removedUsername = deletedSnap.data()?.username || 'User'
  }

  const updates = {
    [`unreadCount.${userId}`]: 0,
    opponentRemoved: true,
    [`removedUsers.${otherUserId}`]: removedUsername,
  }
  if (data?.lastMessage?.senderId === otherUserId) {
    updates['lastMessage.read'] = true
  }
  await updateDoc(chatRef, updates)

  return {
    ...data,
    id: matchId,
    unreadCount: { ...data?.unreadCount, [userId]: 0 },
    opponentRemoved: true,
    removedUsers: { ...data?.removedUsers, [otherUserId]: removedUsername },
    lastMessage: data?.lastMessage?.senderId === otherUserId
      ? { ...data.lastMessage, read: true }
      : data?.lastMessage,
  }
}

async function buildChatPreviewFromMessages(matchId, participants) {
  const messagesRef = collection(db, 'chats', matchId, 'messages')
  const allSnap = await getDocs(query(messagesRef, orderBy('createdAt', 'asc')))

  const unreadCount = {}
  participants.forEach((uid) => {
    unreadCount[uid] = 0
  })

  allSnap.docs.forEach((d) => {
    const message = d.data()
    participants.forEach((uid) => {
      if (message.senderId !== uid && !message.read) unreadCount[uid]++
    })
  })

  if (allSnap.empty) {
    return { lastMessage: null, unreadCount }
  }

  const latestDoc = allSnap.docs[allSnap.docs.length - 1]
  const latest = latestDoc.data()
  return {
    lastMessage: {
      text: formatMessagePreview(latest),
      senderId: latest.senderId,
      createdAt: latest.createdAt,
      read: latest.read ?? false,
      messageId: latestDoc.id,
    },
    unreadCount,
  }
}

function previewMatches(cached, computed) {
  if (!cached && !computed) return true
  if (!cached || !computed) return false
  return cached.text === computed.text && cached.senderId === computed.senderId
}

function unreadCountsMatch(cached = {}, computed = {}, participants = []) {
  return participants.every((uid) => (cached[uid] ?? 0) === (computed[uid] ?? 0))
}

export async function syncChatPreviewFromMessages(matchId) {
  const chatRef = doc(db, 'chats', matchId)
  const chatSnap = await getDoc(chatRef)
  if (!chatSnap.exists()) return null

  const chatData = chatSnap.data()
  const participants = chatData.participants || matchId.split('_')
  const { lastMessage, unreadCount } = await buildChatPreviewFromMessages(matchId, participants)

  const lastMessageChanged = !previewMatches(chatData.lastMessage, lastMessage)
  const unreadChanged = !unreadCountsMatch(chatData.unreadCount, unreadCount, participants)

  if (!lastMessageChanged && !unreadChanged) return null

  await updateDoc(chatRef, { lastMessage, unreadCount })

  return {
    ...chatData,
    id: matchId,
    lastMessage,
    unreadCount,
  }
}

async function reconcileChatPreviewIfStale(matchId, chatData) {
  const participants = chatData.participants || matchId.split('_')
  const claimedUnread = participants.some((uid) => (chatData.unreadCount?.[uid] ?? 0) > 0)

  if (claimedUnread) {
    return syncChatPreviewFromMessages(matchId)
  }

  const messagesRef = collection(db, 'chats', matchId, 'messages')
  const latestSnap = await getDocs(query(messagesRef, orderBy('createdAt', 'desc'), limit(1)))
  const cached = chatData.lastMessage

  if (latestSnap.empty) {
    return cached ? syncChatPreviewFromMessages(matchId) : null
  }

  const latest = latestSnap.docs[0].data()
  const latestPreview = {
    text: formatMessagePreview(latest),
    senderId: latest.senderId,
  }
  const cachedPreview = cached
    ? { text: cached.text, senderId: cached.senderId }
    : null

  if (JSON.stringify(latestPreview) !== JSON.stringify(cachedPreview)) {
    return syncChatPreviewFromMessages(matchId)
  }

  return null
}

async function hydrateChatsForUser(userId, chats) {
  return Promise.all(
    chats.map(async (chat) => {
      if (chat.isSavedMessages || isGroupChat(chat)) return chat

      const otherId = chat.participants?.find((id) => id !== userId)
      if (!otherId) return chat

      let updated = chat

      const needsRemovedCheck =
        !chat.opponentRemoved &&
        (getUnreadCount(chat, userId) > 0 || !chat.lastMessage?.text)

      if (needsRemovedCheck) {
        const synced = await syncRemovedOpponentChat(chat.id, userId, otherId)
        if (synced) updated = synced
      }

      if (!updated.lastMessage?.text && !updated.lastMessage?.messageId) {
        const reconciled = await reconcileChatPreviewIfStale(chat.id, updated)
        if (reconciled) updated = reconciled
      }

      return updated
    })
  )
}

export async function ensureSavedMessagesChat(userId) {
  const chatId = getSavedMessagesChatId(userId)
  const chatRef = doc(db, 'chats', chatId)
  const snap = await getDoc(chatRef)

  if (snap.exists()) {
    const hiddenFor = snap.data()?.hiddenFor || []
    if (hiddenFor.includes(userId)) {
      await updateDoc(chatRef, { hiddenFor: hiddenFor.filter((id) => id !== userId) })
    }
    return chatId
  }

  await setDoc(chatRef, {
    participants: [userId],
    isSavedMessages: true,
    createdAt: serverTimestamp(),
    lastMessage: null,
    mutedBy: [],
    hiddenFor: [],
    unreadCount: { [userId]: 0 },
  })
  return chatId
}

export function subscribeChats(userId, callback) {
  ensureSavedMessagesChat(userId).catch(() => {})

  let hydrateGeneration = 0

  const chatsQuery = query(
    collection(db, 'chats'),
    where('participants', 'array-contains', userId)
  )

  return onSnapshot(chatsQuery, (snap) => {
    const chats = snap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .filter((c) => !c.hiddenFor?.includes(userId))
      .sort((a, b) => {
        const aPinned = a.pinnedBy?.includes(userId)
        const bPinned = b.pinnedBy?.includes(userId)
        if (aPinned !== bPinned) return aPinned ? -1 : 1
        return getChatSortTime(b, userId) - getChatSortTime(a, userId)
      })

    callback(chats)

    const generation = ++hydrateGeneration
    hydrateChatsForUser(userId, chats).then((hydrated) => {
      if (generation !== hydrateGeneration) return
      callback(hydrated)
    })
  })
}

export function subscribeMessages(matchId, callback) {
  const q = query(collection(db, 'chats', matchId, 'messages'), orderBy('createdAt', 'asc'))
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
  })
}

export async function sendMessage(
  matchId,
  senderId,
  { text, imageUrl, audioUrl, replyTo, storyReply },
  { chatData: cachedChatData, skipEnsureVisible = false } = {}
) {
  const chatRef = doc(db, 'chats', matchId)
  let chatData = cachedChatData

  if (!chatData) {
    if (skipEnsureVisible) {
      const chatSnap = await getDoc(chatRef)
      chatData = chatSnap.exists() ? { id: chatSnap.id, ...chatSnap.data() } : null
      if (!chatData) {
        chatData = await ensureChatVisible(matchId)
      }
    } else {
      chatData = await ensureChatVisible(matchId)
    }
  }

  const isSaved = chatData?.isSavedMessages === true

  if (!isSaved && chatData?.unfriended === true) {
    throw new Error('You can no longer message this user')
  }
  if (!isSaved && chatData?.opponentRemoved === true) {
    throw new Error('This account has been deleted')
  }

  if (!isGroupChat(chatData)) {
    const otherId = getDirectOtherId(chatData, senderId) || matchId.split('_').find((id) => id !== senderId)
    if (otherId && chatData?.blockedBy?.includes(otherId)) {
      throw new Error('You can no longer message this user')
    }
    if (otherId && chatData?.blockedBy?.includes(senderId)) {
      throw new Error('You can no longer message this user')
    }
  } else if (isGroupMemberMuted(chatData, senderId)) {
    throw new Error('You are muted in this group')
  }

  const messageData = {
    senderId,
    text: text || null,
    imageUrl: imageUrl || null,
    audioUrl: audioUrl || null,
    createdAt: serverTimestamp(),
    read: isSaved,
  }

  if (replyTo?.id) {
    messageData.replyTo = {
      id: replyTo.id,
      senderId: replyTo.senderId,
      text: replyTo.text || null,
      imageUrl: replyTo.imageUrl || null,
      audioUrl: replyTo.audioUrl || null,
    }
  }

  if (storyReply?.storyId) {
    messageData.storyReply = {
      storyId: storyReply.storyId,
      text: storyReply.text || null,
      color: storyReply.color || null,
      ownerId: storyReply.ownerId || null,
      ownerUsername: storyReply.ownerUsername || null,
    }
  }

  const msgRef = doc(collection(db, 'chats', matchId, 'messages'))
  const recipientIds = isSaved ? [] : getRecipientIds(chatData, matchId, senderId)
  const preview = formatMessagePreview({ text, imageUrl, audioUrl, storyReply })
  const lastMessage = {
    text: preview,
    senderId,
    createdAt: serverTimestamp(),
    read: isSaved,
    messageId: msgRef.id,
  }
  if (storyReply?.storyId) {
    lastMessage.storyReply = messageData.storyReply
  }
  const updates = {
    lastMessage,
  }
  recipientIds.forEach((recipientId) => {
    updates[`unreadCount.${recipientId}`] = increment(1)
  })

  const batch = writeBatch(db)
  batch.set(msgRef, messageData)
  batch.update(chatRef, updates)
  await batch.commit()

  return msgRef.id
}

export async function markMessagesRead(matchId, readerId) {
  const chatRef = doc(db, 'chats', matchId)
  const chatSnap = await getDoc(chatRef)
  if (!chatSnap.exists()) return

  const messagesRef = collection(db, 'chats', matchId, 'messages')
  const snap = await getDocs(query(messagesRef, orderBy('createdAt', 'asc')))

  const batch = writeBatch(db)
  let markedAny = false
  snap.docs.forEach((d) => {
    if (d.data().senderId !== readerId && !d.data().read) {
      batch.update(d.ref, { read: true })
      markedAny = true
    }
  })

  if (markedAny) {
    await batch.commit()
  }

  const lastMsg = chatSnap.data()?.lastMessage
  const updates = { [`unreadCount.${readerId}`]: 0 }
  if (lastMsg?.senderId && lastMsg.senderId !== readerId) {
    updates['lastMessage.read'] = true
  }
  await updateDoc(chatRef, updates)
}

export async function deleteMessage(matchId, messageId, actorId = null) {
  const messageRef = doc(db, 'chats', matchId, 'messages', messageId)
  const chatRef = doc(db, 'chats', matchId)

  const [messageSnap, chatSnap] = await Promise.all([getDoc(messageRef), getDoc(chatRef)])
  if (!messageSnap.exists()) return

  const deleted = messageSnap.data()
  const chatData = chatSnap.data() || {}

  if (actorId && deleted.senderId !== actorId) {
    if (isGroupChat(chatData)) {
      if (!canAdmin(chatData, actorId, 'deleteMessages')) {
        throw new Error('You do not have permission to delete this message')
      }
    } else {
      throw new Error('You can only delete your own messages')
    }
  }

  const participants = chatData.participants || matchId.split('_')

  await deleteDoc(messageRef)

  const updates = {}

  if (!deleted.read) {
    participants.forEach((uid) => {
      if (uid !== deleted.senderId && (chatData.unreadCount?.[uid] ?? 0) > 0) {
        updates[`unreadCount.${uid}`] = increment(-1)
      }
    })
  }

  const latestSnap = await getDocs(
    query(collection(db, 'chats', matchId, 'messages'), orderBy('createdAt', 'desc'), limit(1))
  )

  if (latestSnap.empty) {
    updates.lastMessage = null
  } else {
    const latestDoc = latestSnap.docs[0]
    const latest = latestDoc.data()
    updates.lastMessage = {
      text: formatMessagePreview(latest),
      senderId: latest.senderId,
      createdAt: latest.createdAt,
      read: latest.read ?? false,
      messageId: latestDoc.id,
    }
  }

  await updateDoc(chatRef, updates)
}

export async function deleteChat(matchId) {
  const messagesSnap = await onSnapshotOnce(collection(db, 'chats', matchId, 'messages'))
  const batch = writeBatch(db)
  messagesSnap.forEach((d) => batch.delete(d.ref))
  batch.delete(doc(db, 'chats', matchId))
  await batch.commit()
}

export async function removeChatForUser(matchId, userId) {
  const chatRef = doc(db, 'chats', matchId)
  const chatSnap = await getDoc(chatRef)
  if (!chatSnap.exists()) return

  const chatData = chatSnap.data()
  if (isGroupChat(chatData)) {
    await leaveGroupChat(matchId, userId)
    return
  }

  const participants = chatData?.participants || matchId.split('_')
  const messagesSnap = await getDocs(collection(db, 'chats', matchId, 'messages'))

  const batch = writeBatch(db)
  messagesSnap.docs.forEach((d) => batch.delete(d.ref))

  const unreadCount = {}
  participants.forEach((uid) => {
    unreadCount[uid] = 0
  })

  batch.update(chatRef, {
    hiddenFor: participants,
    lastMessage: null,
    unreadCount,
  })

  await batch.commit()
}

async function ensureChatVisible(matchId) {
  const chatRef = doc(db, 'chats', matchId)
  const chatSnap = await getDoc(chatRef)

  if (matchId.startsWith('saved_')) {
    if (!chatSnap.exists()) return null
    const data = chatSnap.data()
    const userId = matchId.slice('saved_'.length)
    const hiddenFor = data?.hiddenFor || []
    if (hiddenFor.includes(userId)) {
      const nextHiddenFor = hiddenFor.filter((id) => id !== userId)
      await updateDoc(chatRef, { hiddenFor: nextHiddenFor })
      return { id: chatSnap.id, ...data, hiddenFor: nextHiddenFor }
    }
    return { id: chatSnap.id, ...data }
  }

  const participants = matchId.split('_')

  if (!chatSnap.exists()) {
    const unreadCount = {}
    participants.forEach((uid) => {
      unreadCount[uid] = 0
    })
    const created = {
      participants,
      createdAt: serverTimestamp(),
      lastMessage: null,
      mutedBy: [],
      hiddenFor: [],
      unreadCount,
    }
    await setDoc(chatRef, created)
    return { id: matchId, ...created }
  }

  const data = chatSnap.data()
  const hiddenFor = data?.hiddenFor || []
  if (hiddenFor.length > 0) {
    await updateDoc(chatRef, { hiddenFor: [] })
    return { id: chatSnap.id, ...data, hiddenFor: [] }
  }

  return { id: chatSnap.id, ...data }
}

export async function restoreChat(matchId) {
  const chatRef = doc(db, 'chats', matchId)
  const chatSnap = await getDoc(chatRef)
  if (!chatSnap.exists()) return false
  await updateDoc(chatRef, { hiddenFor: [] })
  return true
}

/** Bump empty chats to the top of the list when starting a conversation. */
export async function touchChatActivity(matchId, userId) {
  if (!matchId || !userId || matchId.startsWith('saved_')) return

  await ensureChatVisible(matchId)

  const chatRef = doc(db, 'chats', matchId)
  const chatSnap = await getDoc(chatRef)
  if (!chatSnap.exists() || chatSnap.data()?.lastMessage) return

  await updateDoc(chatRef, {
    [`lastOpenedAt.${userId}`]: serverTimestamp(),
  })
}

export function subscribeChat(matchId, callback) {
  return onSnapshot(doc(db, 'chats', matchId), (snap) => {
    callback(snap.exists() ? { id: snap.id, ...snap.data() } : null)
  })
}

function onSnapshotOnce(colRef) {
  return new Promise((resolve) => {
    const unsub = onSnapshot(colRef, (snap) => {
      unsub()
      resolve(snap.docs)
    })
  })
}

export async function toggleMuteChat(matchId, userId) {
  const chatRef = doc(db, 'chats', matchId)
  const chatSnap = await getDoc(chatRef)
  const chatData = chatSnap.data() || {}
  const mode = getChatMuteMode(chatData, userId)
  const next = mode === CHAT_MUTE_OFF ? CHAT_MUTE_ALL : CHAT_MUTE_OFF
  return setChatMuteMode(matchId, userId, next)
}

export async function setChatMuteMode(matchId, userId, mode) {
  const chatRef = doc(db, 'chats', matchId)
  const updates = {}

  if (mode === 'off') {
    updates[`muteSettings.${userId}`] = deleteField()
    updates.mutedBy = arrayRemove(userId)
  } else {
    updates[`muteSettings.${userId}`] = mode
    if (mode === 'all') {
      updates.mutedBy = arrayUnion(userId)
    } else {
      updates.mutedBy = arrayRemove(userId)
    }
  }

  await updateDoc(chatRef, updates)
  return mode
}

export async function togglePinChat(matchId, userId) {
  const chatRef = doc(db, 'chats', matchId)
  const chatSnap = await getDoc(chatRef)
  const pinnedBy = chatSnap.data()?.pinnedBy || []
  const isPinned = pinnedBy.includes(userId)
  await updateDoc(chatRef, {
    pinnedBy: isPinned ? pinnedBy.filter((id) => id !== userId) : [...pinnedBy, userId],
  })
  return !isPinned
}

export async function setMessageReaction(matchId, messageId, userId, emoji) {
  const messageRef = doc(db, 'chats', matchId, 'messages', messageId)
  const snap = await getDoc(messageRef)
  if (!snap.exists()) return null

  const reactions = { ...(snap.data().reactions || {}) }
  if (reactions[userId] === emoji) {
    delete reactions[userId]
  } else {
    reactions[userId] = emoji
  }

  await updateDoc(messageRef, {
    reactions: Object.keys(reactions).length ? reactions : deleteField(),
  })

  return reactions[userId] || null
}

export function setTyping(matchId, userId, isTyping) {
  const typingRef = ref(rtdb, `typing/${matchId}/${userId}`)
  if (isTyping) {
    set(typingRef, true)
  } else {
    remove(typingRef)
  }
}

export function subscribeTyping(matchId, userId, callback, { participantIds = null } = {}) {
  const others = participantIds?.length
    ? participantIds.filter((id) => id !== userId)
    : matchId.split('_').filter((id) => id !== userId)

  if (!others.length) {
    callback(false, [])
    return () => {}
  }

  const typingState = {}
  const cleanups = []

  const emit = () => {
    const typingIds = others.filter((id) => typingState[id])
    callback(typingIds.length > 0, typingIds)
  }

  others.forEach((otherId) => {
    const typingRef = ref(rtdb, `typing/${matchId}/${otherId}`)
    onValue(typingRef, (snap) => {
      typingState[otherId] = !!snap.val()
      emit()
    })
    cleanups.push(() => off(typingRef))
  })

  emit()
  return () => cleanups.forEach((fn) => fn())
}

export function subscribeChatListActivity(userId, chats, callback) {
  const typingState = {}
  const presenceState = {}
  const cleanups = []
  const presenceSubscribed = new Set()

  const emit = () => {
    const result = {}
    for (const chat of chats) {
      if (chat.isSavedMessages || chat.id?.startsWith('saved_')) continue
      const isGroup = isGroupChat(chat)
      const otherIds = isGroup
        ? getOtherParticipantIds(chat.participants || [], userId)
        : [chat.participants?.find((id) => id !== userId)].filter(Boolean)
      if (!otherIds.length) continue

      const typingValue = typingState[chat.id]
      const isTyping = isGroup
        ? Object.values(typingValue || {}).some(Boolean)
        : !!typingValue

      result[chat.id] = {
        typing: isTyping,
        presence: isGroup ? null : presenceState[otherIds[0]] || null,
        onlineCount: isGroup
          ? otherIds.filter((id) => presenceState[id]?.online).length
          : undefined,
      }
    }
    callback(result)
  }

  for (const chat of chats) {
    const chatId = chat.id
    if (chat.isSavedMessages || chatId?.startsWith('saved_')) continue

    const isGroup = isGroupChat(chat)
    const otherIds = isGroup
      ? getOtherParticipantIds(chat.participants || [], userId)
      : [chat.participants?.find((id) => id !== userId)].filter(Boolean)

    if (!otherIds.length) continue

    otherIds.forEach((otherId) => {
      if (!presenceSubscribed.has(otherId)) {
        presenceSubscribed.add(otherId)
        const presenceRef = ref(rtdb, `presence/${otherId}`)
        onValue(presenceRef, (snap) => {
          presenceState[otherId] = snap.val()
          emit()
        })
        cleanups.push(() => off(presenceRef))
      }

      const typingRef = ref(rtdb, `typing/${chatId}/${otherId}`)
      onValue(typingRef, (snap) => {
        if (isGroup) {
          typingState[chatId] = typingState[chatId] || {}
          typingState[chatId][otherId] = !!snap.val()
        } else {
          typingState[chatId] = !!snap.val()
        }
        emit()
      })
      cleanups.push(() => off(typingRef))
    })
  }

  emit()
  return () => cleanups.forEach((fn) => fn())
}

export { getMatchId, getSavedMessagesChatId }
