import { useState, useEffect, useMemo } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { subscribeUserStories, subscribeStoryViews } from '../../services/storyService'
import {
  filterStoriesForViewer,
  getStoryRingState,
  storyOpenOriginFromRect,
} from '../../utils/storyHelpers'
import StoryRing from './StoryRing'
import StoryViewer from './StoryViewer'

export default function StoryAvatarButton({
  userId,
  profile,
  photo,
  username,
  size = 56,
  isOwn = false,
  isFriend = false,
  friendIds: friendIdsProp,
  className = '',
  onNoStories,
  stopPropagation = false,
  nested = false,
}) {
  const { user, profile: myProfile } = useAuth()
  const [allStories, setAllStories] = useState([])
  const [views, setViews] = useState({})
  const [viewerSession, setViewerSession] = useState(null)

  const friendIds = useMemo(() => {
    const base = friendIdsProp ?? myProfile?.matches ?? []
    if (isFriend && userId && !base.includes(userId)) {
      return [...base, userId]
    }
    return base
  }, [friendIdsProp, myProfile?.matches, isFriend, userId])

  const displayPhoto = photo ?? profile?.photos?.[0]
  const displayName = username ?? profile?.username ?? 'User'

  useEffect(() => {
    if (!userId) return
    return subscribeUserStories(userId, setAllStories)
  }, [userId])

  useEffect(() => {
    if (!user?.uid) return
    return subscribeStoryViews(user.uid, setViews)
  }, [user?.uid])

  const stories = useMemo(
    () =>
      filterStoriesForViewer(allStories, {
        viewerId: user?.uid,
        ownerId: userId,
        friendIds,
      }),
    [allStories, user?.uid, userId, friendIds]
  )

  const { hasStories, unseen, seen } = getStoryRingState(stories, views[userId], { isOwn })

  const queue = useMemo(
    () => (viewerSession ? [{ userId, stories }] : []),
    [viewerSession, userId, stories]
  )

  const users = useMemo(
    () => ({
      [userId]: profile || { id: userId, photos: [displayPhoto], username: displayName },
    }),
    [userId, profile, displayPhoto, displayName]
  )

  const handleClick = (e) => {
    if (stopPropagation) {
      e.stopPropagation()
      e.preventDefault()
    }
    if (!hasStories) {
      onNoStories?.(e)
      return
    }
    const { initialStoryIndex } = getStoryRingState(stories, views[userId], { isOwn })
    setViewerSession({
      id: `${userId}-${Date.now()}`,
      storyIndex: initialStoryIndex,
      origin: storyOpenOriginFromRect(e.currentTarget.getBoundingClientRect()),
    })
  }

  const handlePointerDown = (e) => {
    if (!stopPropagation) return
    e.stopPropagation()
  }

  return (
    <>
      <StoryRing
        as={nested ? 'div' : 'button'}
        photo={displayPhoto}
        username={displayName}
        size={size}
        isOwn={isOwn}
        hasStories={hasStories}
        unseen={unseen}
        seen={seen || (isOwn && hasStories)}
        onClick={handleClick}
        onPointerDown={handlePointerDown}
        className={`no-tap-scale ${className}`}
      />

      {viewerSession && queue.length > 0 && (
        <StoryViewer
          key={viewerSession.id}
          queue={queue}
          startIndex={0}
          initialStoryIndex={viewerSession.storyIndex}
          openOrigin={viewerSession.origin}
          users={users}
          viewerId={user?.uid}
          viewerUsername={myProfile?.username}
          viewerPhoto={myProfile?.photos?.[0]}
          friendIds={friendIds}
          onClose={() => setViewerSession(null)}
        />
      )}
    </>
  )
}
