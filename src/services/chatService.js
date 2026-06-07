import {
  doc,
  collection,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  onSnapshot,
  query,
  orderBy,
  limit,
  serverTimestamp,
  getDoc,
  writeBatch,
  increment,
} from 'firebase/firestore'
import { ref, set, onValue, off } from 'firebase/database'
import { db, rtdb } from '../firebase/config'
import { getMatchId, getSavedMessagesChatId, formatMessagePreview } from '../utils/helpers'
import { invalidateUser } from './userCache'

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

  const updates = {
    [`unreadCount.${userId}`]: 0,
    opponentRemoved: true,
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

  const latest = allSnap.docs[allSnap.docs.length - 1].data()
  return {
    lastMessage: {
      text: formatMessagePreview(latest),
      senderId: latest.senderId,
      createdAt: latest.createdAt,
      read: latest.read ?? false,
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
      let updated = chat

      if (otherId) {
        const synced = await syncRemovedOpponentChat(chat.id, userId, otherId)
        if (synced) updated = synced
      }

      const reconciled = await reconcileChatPreviewIfStale(chat.id, updated)
      if (reconciled) updated = reconciled

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

  return onSnapshot(collection(db, 'chats'), (snap) => {
    const chats = snap.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .filter((c) => c.participants?.includes(userId) && !c.hiddenFor?.includes(userId))
      .sort((a, b) => {
        const aTime = a.lastMessage?.createdAt?.toMillis?.() || 0
        const bTime = b.lastMessage?.createdAt?.toMillis?.() || 0
        return bTime - aTime
      })

    hydrateChatsForUser(userId, chats).then(callback)
  })
}

export function subscribeMessages(matchId, callback) {
  const q = query(collection(db, 'chats', matchId, 'messages'), orderBy('createdAt', 'asc'))
  return onSnapshot(q, (snap) => {
    callback(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
  })
}

export async function sendMessage(matchId, senderId, { text, imageUrl, audioUrl }) {
  await ensureChatVisible(matchId)

  const chatRef = doc(db, 'chats', matchId)
  const chatSnap = await getDoc(chatRef)
  const isSaved = chatSnap.data()?.isSavedMessages === true

  const msgRef = await addDoc(collection(db, 'chats', matchId, 'messages'), {
    senderId,
    text: text || null,
    imageUrl: imageUrl || null,
    audioUrl: audioUrl || null,
    createdAt: serverTimestamp(),
    read: isSaved,
  })

  const recipientId = isSaved ? null : matchId.split('_').find((id) => id !== senderId)
  const preview = formatMessagePreview({ text, imageUrl, audioUrl })
  const updates = {
    lastMessage: {
      text: preview,
      senderId,
      createdAt: serverTimestamp(),
      read: isSaved,
      messageId: msgRef.id,
    },
  }
  if (recipientId) {
    updates[`unreadCount.${recipientId}`] = increment(1)
  }
  await updateDoc(chatRef, updates)

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

export async function restoreChat(matchId) {
  const chatRef = doc(db, 'chats', matchId)
  const chatSnap = await getDoc(chatRef)
  if (!chatSnap.exists()) return false
  await updateDoc(chatRef, { hiddenFor: [] })
  return true
}

async function ensureChatVisible(matchId) {
  const chatRef = doc(db, 'chats', matchId)
  const chatSnap = await getDoc(chatRef)

  if (matchId.startsWith('saved_')) {
    if (!chatSnap.exists()) return
    const userId = matchId.slice('saved_'.length)
    const hiddenFor = chatSnap.data()?.hiddenFor || []
    if (hiddenFor.includes(userId)) {
      await updateDoc(chatRef, { hiddenFor: hiddenFor.filter((id) => id !== userId) })
    }
    return
  }

  const participants = matchId.split('_')

  if (!chatSnap.exists()) {
    const unreadCount = {}
    participants.forEach((uid) => {
      unreadCount[uid] = 0
    })
    await setDoc(chatRef, {
      participants,
      createdAt: serverTimestamp(),
      lastMessage: null,
      mutedBy: [],
      hiddenFor: [],
      unreadCount,
    })
    return
  }

  const hiddenFor = chatSnap.data()?.hiddenFor || []
  if (hiddenFor.length > 0) {
    await updateDoc(chatRef, { hiddenFor: [] })
  }
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

export { getMatchId, getSavedMessagesChatId }
