import {
  collection,
  doc,
  getDoc,
  serverTimestamp,
  writeBatch,
} from 'firebase/firestore'
import { db } from '../firebase/config'

export const SYSTEM_EVENTS = {
  CREATED: 'created',
  JOINED: 'joined',
  LEFT: 'left',
}

export function isSystemMessage(message) {
  return message?.type === 'system' || Boolean(message?.systemEvent)
}

export function formatSystemMessageText(event, { actorUsername = '', isMeetup = false } = {}) {
  const name = String(actorUsername || '').trim() || 'Someone'
  if (event === SYSTEM_EVENTS.CREATED) {
    return isMeetup ? 'Meetup created' : 'Group created'
  }
  if (event === SYSTEM_EVENTS.JOINED) return `${name} joined`
  if (event === SYSTEM_EVENTS.LEFT) return `${name} left`
  return ''
}

async function resolveUsername(userId, fallback = '') {
  if (fallback?.trim()) return fallback.trim()
  if (!userId) return ''
  try {
    const snap = await getDoc(doc(db, 'users', userId))
    return snap.exists() ? snap.data()?.username || '' : ''
  } catch {
    return ''
  }
}

/**
 * Persist a centered system chat event. Does not bump unread counts.
 */
export async function postSystemMessage(
  chatId,
  { event, actorId = null, actorUsername = '', isMeetup = false, text = null } = {}
) {
  if (!chatId || !event) return null

  const chatRef = doc(db, 'chats', chatId)
  const chatSnap = await getDoc(chatRef)
  if (!chatSnap.exists()) return null

  const chat = chatSnap.data()
  const meetup = isMeetup || chat.isMeetup === true
  const username = await resolveUsername(actorId, actorUsername)
  const body = text || formatSystemMessageText(event, { actorUsername: username, isMeetup: meetup })
  if (!body) return null

  const msgRef = doc(collection(db, 'chats', chatId, 'messages'))
  const messageData = {
    type: 'system',
    systemEvent: event,
    senderId: actorId || 'system',
    actorId: actorId || null,
    actorUsername: username || null,
    text: body,
    createdAt: serverTimestamp(),
    read: true,
  }

  const batch = writeBatch(db)
  batch.set(msgRef, messageData)
  batch.update(chatRef, {
    lastMessage: {
      text: body,
      senderId: actorId || 'system',
      createdAt: serverTimestamp(),
      read: true,
      messageId: msgRef.id,
      type: 'system',
    },
  })
  await batch.commit()
  return msgRef.id
}
