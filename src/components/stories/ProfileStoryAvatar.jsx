import { useState, useEffect, useMemo } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { subscribeUserStories, subscribeStoryViews } from '../../services/storyService'
import {
  filterStoriesForViewer,
  getStoryRingState,
  storyOpenOriginFromRect,
} from '../../utils/storyHelpers'
import StoryRing from './StoryRing'
import StoryComposer from './StoryComposer'
import StoryViewer from './StoryViewer'

export default function ProfileStoryAvatar({
  userId,
  profile,
  isOwn = false,
  isFriend = false,
  friendIds: friendIdsProp,
  viewerUsername: viewerUsernameProp,
  viewerPhoto: viewerPhotoProp,
  size = 128,
  onOpenGallery,
  onNavigateToProfile,
  suppressStoryViewer = false,
  onOpenStories,
}) {
  const { user, profile: myProfile } = useAuth()
  const [allStories, setAllStories] = useState([])
  const [views, setViews] = useState({})
  const [composerOpen, setComposerOpen] = useState(false)
  const [viewerSession, setViewerSession] = useState(null)

  const friendIds = useMemo(() => {
    const base = friendIdsProp ?? myProfile?.matches ?? []
    if (isFriend && userId && !base.includes(userId)) {
      return [...base, userId]
    }
    return base
  }, [friendIdsProp, myProfile?.matches, isFriend, userId])

  const viewerUsername = viewerUsernameProp ?? myProfile?.username ?? ''
  const viewerPhoto = viewerPhotoProp ?? myProfile?.photos?.[0] ?? null

  const stories = useMemo(
    () =>
      filterStoriesForViewer(allStories, {
        viewerId: user?.uid,
        ownerId: userId,
        friendIds,
      }),
    [allStories, user?.uid, userId, friendIds]
  )

  useEffect(() => {
    if (!userId) return
    return subscribeUserStories(userId, setAllStories)
  }, [userId])

  useEffect(() => {
    if (!user?.uid) return
    return subscribeStoryViews(user.uid, setViews)
  }, [user?.uid])

  const openViewer = (e) => {
    e.stopPropagation()
    e.preventDefault()
    if (!stories.length) return
    const { initialStoryIndex } = getStoryRingState(stories, views[userId], { isOwn })
    const session = {
      id: `${userId}-${Date.now()}`,
      queue: [{ userId, stories }],
      initialStoryIndex,
      origin: e ? storyOpenOriginFromRect(e.currentTarget.getBoundingClientRect()) : null,
      users: { [userId]: profile },
      friendIds,
      viewerId: user?.uid,
      viewerUsername,
      viewerPhoto,
    }
    if (onOpenStories) {
      onOpenStories(session)
      return
    }
    setViewerSession(session)
  }

  const handleClick = (e) => {
    if (isOwn) {
      if (stories.length > 0) {
        if (!suppressStoryViewer) openViewer(e)
        return
      }
      e.stopPropagation()
      setComposerOpen(true)
      return
    }
    if (suppressStoryViewer) return
    if (stories.length > 0) {
      openViewer(e)
      return
    }
    onOpenGallery?.()
  }

  if (!isOwn && stories.length === 0) {
    return (
      <button type="button" onClick={onOpenGallery} className="rounded-full">
        <StoryRing
          as="div"
          photo={profile?.photos?.[0]}
          username={profile?.username}
          size={size}
        />
      </button>
    )
  }

  const { hasStories, unseen, seen } = getStoryRingState(stories, views[userId], { isOwn })

  return (
    <>
      <StoryRing
        photo={profile?.photos?.[0]}
        username={profile?.username}
        size={size}
        isOwn={isOwn}
        hasStories={hasStories}
        unseen={unseen}
        seen={seen || (isOwn && hasStories)}
        showAddBadge={isOwn && hasStories}
        onAddClick={() => setComposerOpen(true)}
        onClick={handleClick}
        className={`${size >= 100 ? 'mx-auto' : ''}${suppressStoryViewer && stories.length > 0 ? ' cursor-default' : ''}`}
      />

      {isOwn && (
        <StoryComposer
          isOpen={composerOpen}
          onClose={() => setComposerOpen(false)}
          userId={userId}
        />
      )}

      {!onOpenStories && viewerSession && viewerSession.queue[0]?.stories?.length > 0 && (
        <StoryViewer
          key={viewerSession.id}
          queue={viewerSession.queue}
          startIndex={0}
          initialStoryIndex={viewerSession.initialStoryIndex}
          openOrigin={viewerSession.origin}
          users={viewerSession.users}
          viewerId={viewerSession.viewerId}
          viewerUsername={viewerSession.viewerUsername}
          viewerPhoto={viewerSession.viewerPhoto}
          friendIds={viewerSession.friendIds}
          onClose={() => setViewerSession(null)}
          onNavigateToProfile={onNavigateToProfile}
        />
      )}
    </>
  )
}
