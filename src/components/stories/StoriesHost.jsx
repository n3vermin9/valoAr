import { useState, useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useAuth } from '../../contexts/AuthContext'
import { deleteExpiredStories } from '../../services/storyService'
import { getFirstUnseenStoryIndex } from '../../utils/storyHelpers'
import useStoriesFeed from '../../hooks/useStoriesFeed'
import { pageSwitchTransition } from '../../utils/designSystem'
import StoryBar from './StoryBar'
import StoryComposer from './StoryComposer'
import StoryViewer from './StoryViewer'

export default function StoriesHost({ profile, friendIds, showBar = true }) {
  const { user } = useAuth()
  const { feed, views, users, loaded } = useStoriesFeed(user?.uid, friendIds)
  const [composerOpen, setComposerOpen] = useState(false)
  const [viewerState, setViewerState] = useState(null)

  useEffect(() => {
    if (!user?.uid) return
    deleteExpiredStories(user.uid).catch(() => {})
  }, [user?.uid])

  if (!profile || !user?.uid) return null

  const openViewer = (userId, origin) => {
    const index = feed.findIndex((entry) => entry.userId === userId)
    if (index < 0) return
    const entry = feed[index]
    const storyIndex =
      userId === profile.id
        ? 0
        : getFirstUnseenStoryIndex(entry.stories, views[userId])
    setViewerState({ userIndex: index, storyIndex, origin: origin || null })
  }

  return (
    <>
      <AnimatePresence initial={false}>
        {showBar && (
          <motion.div
            key="story-bar"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={pageSwitchTransition}
            className="overflow-hidden shrink-0"
          >
            <StoryBar
              profile={profile}
              feed={feed}
              views={views}
              users={users}
              loaded={loaded}
              onCompose={() => setComposerOpen(true)}
              onOpenViewer={openViewer}
            />
          </motion.div>
        )}
      </AnimatePresence>

      <StoryComposer
        isOpen={composerOpen}
        onClose={() => setComposerOpen(false)}
        userId={user.uid}
      />

      {viewerState !== null && feed.length > 0 && (
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
        />
      )}
    </>
  )
}
