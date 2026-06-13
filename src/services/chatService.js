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
} from 'firebase/firestore'
import { ref, set, onValue, off } from 'firebase/database'
import { db, rtdb } from '../firebase/config'
import { getMatchId, getSavedMessagesChatId, formatMessagePreview } from '../utils/helpers'
import { invalidateUser } from './userCache'

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
      if (chat.isSavedMessages) return chat

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

  const otherId = matchId.split('_').find((id) => id !== senderId)
  if (otherId && chatData?.blockedBy?.includes(otherId)) {
    throw new Error('You can no longer message this user')
  }
  if (otherId && chatData?.blockedBy?.includes(senderId)) {
    throw new Error('You can no longer message this user')
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
  const recipientId = isSaved ? null : matchId.split('_').find((id) => id !== senderId)
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
  if (recipientId) {
    updates[`unreadCount.${recipientId}`] = increment(1)
  }

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

export async function deleteMessage(matchId, messageId) {
  const messageRef = doc(db, 'chats', matchId, 'messages', messageId)
  const chatRef = doc(db, 'chats', matchId)

  const [messageSnap, chatSnap] = await Promise.all([getDoc(messageRef), getDoc(chatRef)])
  if (!messageSnap.exists()) return

  const deleted = messageSnap.data()
  const chatData = chatSnap.data() || {}
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
  void userId
  const chatRef = doc(db, 'chats', matchId)
  const chatSnap = await getDoc(chatRef)
  if (!chatSnap.exists()) return

  const participants = chatSnap.data()?.participants || matchId.split('_')
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
  const mutedBy = chatSnap.data()?.mutedBy || []
  const isMuted = mutedBy.includes(userId)
  await updateDoc(chatRef, {
    mutedBy: isMuted ? mutedBy.filter((id) => id !== userId) : [...mutedBy, userId],
  })
  return !isMuted
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
  set(ref(rtdb, `typing/${matchId}/${userId}`), isTyping)
}

export function subscribeTyping(matchId, userId, callback) {
  const otherParticipants = matchId.split('_').filter((id) => id !== userId)
  const otherId = otherParticipants[0]
  if (!otherId) return () => {}

  const typingRef = ref(rtdb, `typing/${matchId}/${otherId}`)
  onValue(typingRef, (snap) => callback(!!snap.val()))
  return () => off(typingRef)
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
      const otherId = chat.participants?.find((id) => id !== userId)
      if (!otherId) continue
      result[chat.id] = {
        typing: !!typingState[chat.id],
        presence: presenceState[otherId] || null,
      }
    }
    callback(result)
  }

  for (const chat of chats) {
    const chatId = chat.id
    if (chat.isSavedMessages || chatId?.startsWith('saved_')) continue
    const otherId = chat.participants?.find((id) => id !== userId)
    if (!otherId) continue

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
      typingState[chatId] = !!snap.val()
      emit()
    })
    cleanups.push(() => off(typingRef))
  }

  emit()
  return () => cleanups.forEach((fn) => fn())
}

export { getMatchId, getSavedMessagesChatId }
