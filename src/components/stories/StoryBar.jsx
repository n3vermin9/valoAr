import { hasUnseenStories, storyOpenOriginFromRect } from '../../utils/storyHelpers'
import StoryRing from './StoryRing'
import UsernameLabel from '../ui/UsernameLabel'

export default function StoryBar({
  profile,
  feed,
  views,
  users,
  onCompose,
  onOpenViewer,
}) {
  if (!profile) return null

  const ownStories = feed.find((e) => e.userId === profile.id)?.stories || []
  const friendEntries = feed.filter((e) => e.userId !== profile.id)

  const sortedFriends = [...friendEntries].sort((a, b) => {
    const aUnseen = hasUnseenStories(a.stories, views[a.userId])
    const bUnseen = hasUnseenStories(b.stories, views[b.userId])
    if (aUnseen !== bUnseen) return aUnseen ? -1 : 1
    return 0
  })

  const handleOwnClick = (e) => {
    if (ownStories.length > 0) {
      onOpenViewer(profile.id, storyOpenOriginFromRect(e.currentTarget.getBoundingClientRect()))
    } else {
      onCompose()
    }
  }

  if (!ownStories.length && !sortedFriends.length) {
    return (
      <div className="px-[var(--ios-page-x-lg)] pb-3">
        <button
          type="button"
          onClick={onCompose}
          className="flex items-center gap-3 w-full px-4 py-3 rounded-[var(--ios-radius-xl)] bg-[var(--ios-fill-tertiary)] border border-[var(--ios-glass-border)] hover:bg-white/[0.08] transition-colors"
        >
          <StoryRing
            as="div"
            photo={profile.photos?.[0]}
            username={profile.username}
            size={48}
            isOwn
            hasStories={false}
          />
          <div className="text-left">
            <p className="font-semibold text-[15px]">Add a story</p>
            <p className="text-xs text-[var(--ios-label-secondary)]">Share a thought for 24 hours</p>
          </div>
        </button>
      </div>
    )
  }

  return (
    <div className="px-[var(--ios-page-x-lg)] pb-3 overflow-x-auto">
      <div className="flex gap-4">
        <div className="flex flex-col items-center gap-1.5 shrink-0 w-16">
          <StoryRing
            photo={profile.photos?.[0]}
            username={profile.username}
            size={64}
            isOwn
            hasStories={ownStories.length > 0}
            seen={ownStories.length > 0}
            showAddBadge
            onAddClick={onCompose}
            onClick={handleOwnClick}
          />
          <span className="text-xs text-[var(--ios-label-secondary)] truncate w-full text-center">
            You
          </span>
        </div>

        {sortedFriends.map((entry) => {
          const user = users[entry.userId]
          const unseen = hasUnseenStories(entry.stories, views[entry.userId])
          return (
            <div key={entry.userId} className="flex flex-col items-center gap-1.5 shrink-0 w-16">
              <StoryRing
                photo={user?.photos?.[0]}
                username={user?.username}
                size={64}
                hasStories
                unseen={unseen}
                seen={!unseen}
                onClick={(e) =>
                  onOpenViewer(
                    entry.userId,
                    storyOpenOriginFromRect(e.currentTarget.getBoundingClientRect())
                  )
                }
              />
              <UsernameLabel
                username={user?.username}
                className="text-xs text-[var(--ios-label-secondary)] truncate w-full justify-center"
                badgeSize={10}
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}
