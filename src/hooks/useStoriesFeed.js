import { useState, useEffect, useRef } from 'react'
import { subscribeStoriesFeed, subscribeStoryViews } from '../services/storyService'
import { fetchUser, subscribeToUser } from '../services/userService'

export default function useStoriesFeed(userId, friendIdsProp = []) {
  const [feed, setFeed] = useState([])
  const [views, setViews] = useState({})
  const [users, setUsers] = useState({})
  const [friendIds, setFriendIds] = useState(friendIdsProp)
  const feedUnsubRef = useRef(null)

  const friendKey = friendIds.join(',')

  useEffect(() => {
    setFriendIds(friendIdsProp)
  }, [friendIdsProp.join(',')])

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

    const unsub = subscribeStoriesFeed(userId, friendIds, setFeed)
    feedUnsubRef.current = unsub
    return () => {
      feedUnsubRef.current = null
      unsub()
    }
  }, [userId])

  useEffect(() => {
    feedUnsubRef.current?.updateFriendIds?.(friendIds)
  }, [friendKey, userId])

  useEffect(() => {
    if (!userId) return
    return subscribeStoryViews(userId, setViews)
  }, [userId])

  useEffect(() => {
    if (!feed.length) return
    let cancelled = false

    ;(async () => {
      const ids = feed.map((entry) => entry.userId)
      const next = {}
      await Promise.all(
        ids.map(async (id) => {
          const user = await fetchUser(id)
          if (user) next[id] = user
        })
      )
      if (!cancelled) setUsers((prev) => ({ ...prev, ...next }))
    })()

    return () => {
      cancelled = true
    }
  }, [feed])

  return { feed, views, users }
}
