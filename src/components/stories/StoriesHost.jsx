import { useState, useEffect, useMemo, useCallback } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { deleteExpiredStories } from '../../services/storyService'
import { getFirstUnseenStoryIndex, hasUnseenStories } from '../../utils/storyHelpers'
import useStoriesFeed from '../../hooks/useStoriesFeed'
import StoryBar from './StoryBar'
import StoryComposer from './StoryComposer'
import StoryViewer from './StoryViewer'

export default function StoriesHost({
  profile,
  friendIds,
  showBar = true,
  renderBar,
  onOverlayChange,
  onUnseenStoriesChange,
}) {
  const { user } = useAuth()
  const { feed, views, users, loaded } = useStoriesFeed(user?.uid, friendIds)
  const [composerOpen, setComposerOpen] = useState(false)
  const [viewerState, setViewerState] = useState(null)
  const [optimisticViews, setOptimisticViews] = useState({})

  const overlayOpen = composerOpen || viewerState !== null

  const effectiveViews = useMemo(() => {
    const merged = { ...views }
    for (const [id, ms] of Object.entries(optimisticViews)) {
      merged[id] = Math.max(merged[id] || 0, ms)
    }
    return merged
  }, [views, optimisticViews])

  const hasUnseenFriendStories = feed.some(
    (entry) =>
      entry.userId !== profile?.id &&
      hasUnseenStories(entry.stories, effectiveViews[entry.userId] || 0)
  )

  useEffect(() => {
    if (!user?.uid) return
    deleteExpiredStories(user.uid).catch(() => {})
  }, [user?.uid])

  useEffect(() => {
    onOverlayChange?.(overlayOpen)
  }, [overlayOpen, onOverlayChange])

  useEffect(() => {
    onUnseenStoriesChange?.(hasUnseenFriendStories)
  }, [hasUnseenFriendStories, onUnseenStoriesChange])

  // Drop optimistic marks once live views catch up.
  useEffect(() => {
    setOptimisticViews((prev) => {
      const entries = Object.entries(prev)
      if (!entries.length) return prev
      let changed = false
      const next = { ...prev }
      for (const [id, ms] of entries) {
        if ((views[id] || 0) >= ms) {
          delete next[id]
          changed = true
        }
      }
      return changed ? next : prev
    })
  }, [views])

  const handleStoryViewed = useCallback((ownerId, viewedAtMs) => {
    if (!ownerId || !viewedAtMs) return
    setOptimisticViews((prev) => ({
      ...prev,
      [ownerId]: Math.max(prev[ownerId] || 0, viewedAtMs),
    }))
  }, [])

  if (!profile || !user?.uid) return null

  const openViewer = (userId, origin) => {
    deleteExpiredStories(user.uid).catch(() => {})
    const index = feed.findIndex((entry) => entry.userId === userId)
    if (index < 0) return
    const entry = feed[index]
    const storyIndex =
      userId === profile.id
        ? 0
        : getFirstUnseenStoryIndex(entry.stories, effectiveViews[userId] || 0)
    setViewerState({ userIndex: index, storyIndex, origin: origin || null })
  }

  const bar = showBar ? (
    <div className="overflow-hidden shrink-0">
      <StoryBar
        profile={profile}
        feed={feed}
        views={effectiveViews}
        users={users}
        loaded={loaded}
        onCompose={() => setComposerOpen(true)}
        onOpenViewer={openViewer}
      />
    </div>
  ) : null

  return (
    <>
      {bar ? (renderBar ? renderBar(bar) : bar) : null}

      <StoryComposer
        isOpen={composerOpen}
        onClose={() => setComposerOpen(false)}
        userId={user.uid}
      />

      {viewerState !== null ? (
        <StoryViewer
          queue={feed}
          startIndex={viewerState.userIndex}
          initialStoryIndex={viewerState.storyIndex}
          openOrigin={viewerState.origin}
          users={users}
          viewerId={user.uid}
          viewerUsername={profile.username}
          viewerPhoto={profile.photos?.[0]}
          friendIds={friendIds || []}
          onClose={() => setViewerState(null)}
          onStoryViewed={handleStoryViewed}
        />
      ) : null}
    </>
  )
}
