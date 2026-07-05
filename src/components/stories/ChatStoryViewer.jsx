import { useState, useEffect, useMemo } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { subscribeUserStories, subscribeStoryViews } from '../../services/storyService'
import { fetchUser } from '../../services/userService'
import {
  filterStoriesForViewer,
  getFirstUnseenStoryIndex,
} from '../../utils/storyHelpers'
import StoryViewer from './StoryViewer'
import StoryUnavailableViewer from './StoryUnavailableViewer'

function computeStartIndex(stories, storyId, ownerId, viewerId, viewedAtMs) {
  if (!stories.length) return 0
  if (storyId) {
    const found = stories.findIndex((s) => s.id === storyId)
    if (found >= 0) return found
  }
  if (ownerId !== viewerId) {
    return getFirstUnseenStoryIndex(stories, viewedAtMs)
  }
  return 0
}

export default function ChatStoryViewer({ ownerId, storyId, onClose }) {
  const { user, profile } = useAuth()
  const [allStories, setAllStories] = useState([])
  const [storiesLoaded, setStoriesLoaded] = useState(false)
  const [views, setViews] = useState({})
  const [owner, setOwner] = useState(null)
  const [viewerSession, setViewerSession] = useState(null)

  const friendIds = profile?.matches || []

  const stories = useMemo(
    () =>
      filterStoriesForViewer(allStories, {
        viewerId: user?.uid,
        ownerId,
        friendIds,
      }),
    [allStories, user?.uid, ownerId, friendIds]
  )

  useEffect(() => {
    setViewerSession(null)
    setStoriesLoaded(false)
  }, [ownerId, storyId])

  useEffect(() => {
    if (!ownerId) return
    setStoriesLoaded(false)
    return subscribeUserStories(ownerId, (nextStories) => {
      setAllStories(nextStories)
      setStoriesLoaded(true)
    })
  }, [ownerId])

  useEffect(() => {
    if (!ownerId || !user?.uid || !storiesLoaded) return

    if (storyId && !stories.some((s) => s.id === storyId)) {
      setViewerSession(null)
      return
    }

    if (!stories.length) {
      setViewerSession(null)
      return
    }

    setViewerSession({
      storyIndex: computeStartIndex(stories, storyId, ownerId, user.uid, views[ownerId]),
    })
  }, [ownerId, storyId, stories, storiesLoaded, user?.uid, views])

  useEffect(() => {
    if (!user?.uid) return
    return subscribeStoryViews(user.uid, setViews)
  }, [user?.uid])

  useEffect(() => {
    if (!ownerId) return
    let cancelled = false
    fetchUser(ownerId).then((p) => {
      if (!cancelled) setOwner(p)
    })
    return () => {
      cancelled = true
    }
  }, [ownerId])

  const queue = useMemo(
    () => (viewerSession ? [{ userId: ownerId, stories }] : []),
    [viewerSession, ownerId, stories]
  )

  const users = useMemo(() => ({ [ownerId]: owner }), [ownerId, owner])

  if (!ownerId || !user?.uid) return null

  if (storiesLoaded && storyId && !stories.some((s) => s.id === storyId)) {
    return <StoryUnavailableViewer onClose={onClose} />
  }

  if (storiesLoaded && !stories.length && storyId) {
    return <StoryUnavailableViewer onClose={onClose} />
  }

  if (!viewerSession || !queue.length) return null

  return (
    <StoryViewer
      key={`${ownerId}-${storyId || 'all'}-${viewerSession.storyIndex}`}
      queue={queue}
      startIndex={0}
      initialStoryIndex={viewerSession.storyIndex}
      users={users}
      viewerId={user.uid}
      viewerUsername={profile?.username}
      viewerPhoto={profile?.photos?.[0]}
      friendIds={friendIds}
      onClose={onClose}
    />
  )
}
