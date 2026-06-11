import { useState, useEffect, useMemo } from 'react'
import { subscribeUserStories, subscribeStoryViews } from '../services/storyService'
import {
  filterStoriesForViewer,
  getStoryRingState,
} from '../utils/storyHelpers'

export function useStoryViews(viewerId) {
  const [views, setViews] = useState({})

  useEffect(() => {
    if (!viewerId) return
    return subscribeStoryViews(viewerId, setViews)
  }, [viewerId])

  return views
}

export default function useParticipantStories(viewerId, ownerIds = [], friendIds = []) {
  const [storiesByUser, setStoriesByUser] = useState({})
  const views = useStoryViews(viewerId)

  const ownerKey = ownerIds.join(',')

  useEffect(() => {
    if (!ownerIds.length) return

    const unsubs = ownerIds.map((ownerId) =>
      subscribeUserStories(ownerId, (stories) => {
        setStoriesByUser((prev) => ({ ...prev, [ownerId]: stories }))
      })
    )

    return () => unsubs.forEach((unsub) => unsub())
  }, [ownerKey])

  const ringStateByUser = useMemo(() => {
    const result = {}
    for (const ownerId of ownerIds) {
      const allStories = storiesByUser[ownerId] || []
      const stories = filterStoriesForViewer(allStories, {
        viewerId,
        ownerId,
        friendIds,
      })
      result[ownerId] = {
        stories,
        ...getStoryRingState(stories, views[ownerId]),
      }
    }
    return result
  }, [ownerIds, storiesByUser, viewerId, friendIds, views])

  return { ringStateByUser, views }
}
