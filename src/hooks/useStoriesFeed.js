import { useState, useEffect, useRef } from 'react'
import { subscribeStoriesFeed, subscribeStoryViews } from '../services/storyService'
import { fetchUser, subscribeToUser } from '../services/userService'
import {
  getStoriesFeedSnapshot,
  setStoriesFeedSnapshot,
} from '../services/storiesFeedCache'

/** Ignore empty live feeds briefly so Discover doesn't flash "Add a story". */
const EMPTY_FEED_TRUST_MS = 2000

export default function useStoriesFeed(userId, friendIdsProp = []) {
  const snapshot = userId ? getStoriesFeedSnapshot(userId) : null
  const [feed, setFeed] = useState(() => snapshot?.feed || [])
  const [views, setViews] = useState(() => snapshot?.views || {})
  const [users, setUsers] = useState(() => snapshot?.users || {})
  const [loaded, setLoaded] = useState(() => Boolean(snapshot))
  const [friendIds, setFriendIds] = useState(friendIdsProp)
  const feedUnsubRef = useRef(null)
  const feedRef = useRef(feed)
  const viewsRef = useRef(views)
  const usersRef = useRef(users)
  const mountAtRef = useRef(Date.now())
  const hadCachedStoriesRef = useRef((snapshot?.feed || []).length > 0)

  const friendKey = friendIds.join(',')

  useEffect(() => {
    feedRef.current = feed
  }, [feed])

  useEffect(() => {
    viewsRef.current = views
  }, [views])

  useEffect(() => {
    usersRef.current = users
  }, [users])

  useEffect(() => {
    setFriendIds(friendIdsProp)
  }, [friendIdsProp.join(',')])

  useEffect(() => {
    if (!userId) return

    const cached = getStoriesFeedSnapshot(userId)
    mountAtRef.current = Date.now()
    hadCachedStoriesRef.current = (cached?.feed || []).length > 0
    setFeed(cached?.feed || [])
    setViews(cached?.views || {})
    setUsers(cached?.users || {})
    setLoaded(Boolean(cached))
  }, [userId])

  useEffect(() => {
    if (!userId) return
    return subscribeToUser(userId, (profile) => {
      if (Array.isArray(profile?.matches)) {
        setFriendIds(profile.matches)
      }
    })
  }, [userId])

  useEffect(() => {
    if (!userId) return

    const applyFeed = (nextFeed) => {
      const age = Date.now() - mountAtRef.current
      const showingStories = feedRef.current.length > 0 || hadCachedStoriesRef.current

      if (nextFeed.length === 0 && age < EMPTY_FEED_TRUST_MS) {
        // Keep cached rings; otherwise stay on skeleton instead of "Add a story".
        if (showingStories) setLoaded(true)
        return
      }

      setFeed(nextFeed)
      setLoaded(true)
      setStoriesFeedSnapshot(userId, {
        feed: nextFeed,
        views: viewsRef.current,
        users: usersRef.current,
      })
    }

    const unsub = subscribeStoriesFeed(userId, friendIds, applyFeed)
    feedUnsubRef.current = unsub

    const trustEmptyTimer = window.setTimeout(() => {
      // After grace period, force persist whatever we currently show / live will send next.
      setStoriesFeedSnapshot(userId, {
        feed: feedRef.current,
        views: viewsRef.current,
        users: usersRef.current,
      })
      setLoaded(true)
    }, EMPTY_FEED_TRUST_MS)

    return () => {
      feedUnsubRef.current = null
      unsub()
      window.clearTimeout(trustEmptyTimer)
    }
  }, [userId])

  useEffect(() => {
    feedUnsubRef.current?.updateFriendIds?.(friendIds)
  }, [friendKey, userId])

  useEffect(() => {
    if (!userId) return
    return subscribeStoryViews(userId, (nextViews) => {
      setViews(nextViews)
      setStoriesFeedSnapshot(userId, {
        feed: feedRef.current,
        views: nextViews,
        users: usersRef.current,
      })
    })
  }, [userId])

  const feedIdsKey = feed.map((entry) => entry.userId).join(',')

  useEffect(() => {
    if (!feedIdsKey || !userId) return
    let cancelled = false

    ;(async () => {
      const ids = feedIdsKey.split(',')
      const next = {}
      await Promise.all(
        ids.map(async (id) => {
          const user = await fetchUser(id)
          if (user) next[id] = user
        })
      )
      if (cancelled) return
      setUsers((prev) => {
        const merged = { ...prev, ...next }
        setStoriesFeedSnapshot(userId, {
          feed: feedRef.current,
          views: viewsRef.current,
          users: merged,
        })
        return merged
      })
    })()

    return () => {
      cancelled = true
    }
  }, [feedIdsKey, userId])

  return { feed, views, users, loaded }
}
