import { useState, useEffect } from 'react'
import { IconUsers } from '@tabler/icons-react'
import { useAuth } from '../../contexts/AuthContext'
import { fetchUser } from '../../services/userService'
import { ListSkeleton } from '../ui/Skeleton'
import EmptyState from '../ui/EmptyState'
import UsernameLabel from '../ui/UsernameLabel'
import CachedAvatar from '../ui/CachedAvatar'
import { SettingsSection } from '../ui/SettingsUI'
import { settingsRowClass, typoTitle3Class } from '../../utils/designSystem'
import { sad } from '../../assets'

export default function MatchHistory({ onSelectFriend }) {
  const { profile } = useAuth()
  const [matches, setMatches] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const ids = profile?.matches || []
      const users = await Promise.all(ids.map((id) => fetchUser(id)))
      setMatches(users.filter(Boolean))
      setLoading(false)
    }
    load()
  }, [profile])

  return (
    <div className="pt-5 pb-5">
      <h2 className={`${typoTitle3Class} px-[var(--ios-page-x-lg)] mb-3`}>Friends</h2>
      {loading ? (
        <ListSkeleton rows={4} className="px-[var(--ios-page-x-lg)]" />
      ) : matches.length === 0 ? (
        <EmptyState
          icon={IconUsers}
          iconTone="blue"
          title="No friends yet"
          description="When you match with people, they’ll show up here."
        />
      ) : (
        <SettingsSection>
          {matches.map((user) => (
            <button
              key={user.id}
              type="button"
              onClick={() => onSelectFriend?.(user.id)}
              className={settingsRowClass}
            >
              <CachedAvatar
                src={user.photos?.[0]}
                fallback={sad}
                size={44}
                alt=""
                className="w-11 h-11 rounded-full object-cover shrink-0"
              />
              <div className="flex-1 min-w-0 text-left">
                <UsernameLabel username={user.username} badgeSize={14} />
              </div>
            </button>
          ))}
        </SettingsSection>
      )}
    </div>
  )
}
