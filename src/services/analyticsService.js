import {
  collection,
  getDocs,
  query,
  where,
  limit,
  orderBy,
} from 'firebase/firestore'
import { db } from '../firebase/config'
import { toTimestampMs } from '../utils/storyHelpers'

const DAY_MS = 24 * 60 * 60 * 1000

function countRecent(docs, field = 'createdAt', withinMs = 7 * DAY_MS) {
  const cutoff = Date.now() - withinMs
  return docs.filter((doc) => toTimestampMs(doc.data()?.[field]) >= cutoff).length
}

export async function fetchAppAnalytics() {
  const now = Date.now()
  const dayAgo = now - DAY_MS
  const weekAgo = now - 7 * DAY_MS

  const [usersSnap, chatsSnap, groupsSnap, inboxSnap] = await Promise.all([
    getDocs(query(collection(db, 'users'), limit(500))),
    getDocs(query(collection(db, 'chats'), limit(500))),
    getDocs(query(collection(db, 'chats'), where('type', '==', 'group'), limit(200))),
    getDocs(query(collection(db, 'users'), limit(1))),
  ])

  const users = usersSnap.docs.map((d) => ({ id: d.id, ...d.data() }))
  const chats = chatsSnap.docs.map((d) => ({ id: d.id, ...d.data() }))
  const groups = groupsSnap.docs.map((d) => ({ id: d.id, ...d.data() }))

  const activeUsers24h = users.filter((u) => {
    const lastSeen = u.lastSeen?.toMillis?.() ?? u.lastSeen ?? 0
    return lastSeen >= dayAgo
  }).length

  const newUsers7d = users.filter((u) => toTimestampMs(u.createdAt) >= weekAgo).length
  const directChats = chats.filter((c) => c.type !== 'group' && !c.isSavedMessages).length
  const savedChats = chats.filter((c) => c.isSavedMessages).length
  const publicGroups = groups.filter((g) => g.settings?.visibility === 'public').length
  const privateGroups = groups.length - publicGroups
  const totalFriends = users.reduce((sum, u) => sum + (u.matches?.length || 0), 0)
  const avgFriends = users.length ? (totalFriends / users.length).toFixed(1) : '0'

  let storyCount = 0
  let storiesLast24h = 0
  const storySample = users.slice(0, 40)
  await Promise.all(
    storySample.map(async (u) => {
      try {
        const snap = await getDocs(
          query(collection(db, 'users', u.id, 'stories'), orderBy('createdAt', 'desc'), limit(5))
        )
        storyCount += snap.size
        snap.docs.forEach((d) => {
          if (toTimestampMs(d.data()?.createdAt) >= dayAgo) storiesLast24h += 1
        })
      } catch {
        // ignore per-user story read failures
      }
    })
  )

  return {
    fetchedAt: now,
    users: {
      total: users.length,
      capped: usersSnap.size >= 500,
      active24h: activeUsers24h,
      new7d: newUsers7d,
      avgFriends,
    },
    chats: {
      total: chats.length,
      capped: chatsSnap.size >= 500,
      direct: directChats,
      saved: savedChats,
    },
    groups: {
      total: groups.length,
      capped: groupsSnap.size >= 200,
      public: publicGroups,
      private: privateGroups,
    },
    stories: {
      sampledUsers: storySample.length,
      sampledTotal: storyCount,
      last24hSample: storiesLast24h,
    },
    inboxUsersSampled: inboxSnap.size,
  }
}
