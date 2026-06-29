import { useState, useEffect } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { fetchUser } from '../../services/userService'
import LoadingSpinner from '../ui/LoadingSpinner'
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
    <div className="pb-4">
      <h2 className={`${typoTitle3Class} px-[var(--ios-page-x-lg)] mb-4`}>Friends</h2>
      {loading ? (
        <LoadingSpinner />
      ) : matches.length === 0 ? (
        <EmptyState message="No friends yet" />
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
