import { useState, useEffect } from 'react'
import { subscribeStoriesFeed, subscribeStoryViews } from '../services/storyService'
import { fetchUser } from '../services/userService'

export default function useStoriesFeed(userId, friendIds = []) {
  const [feed, setFeed] = useState([])
  const [views, setViews] = useState({})
  const [users, setUsers] = useState({})

  const friendKey = friendIds.join(',')

  useEffect(() => {
    if (!userId) return
    return subscribeStoriesFeed(userId, friendIds, setFeed)
  }, [userId, friendKey])

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
