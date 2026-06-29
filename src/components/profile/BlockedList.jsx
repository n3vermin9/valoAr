import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import { useAuth } from '../../contexts/AuthContext'
import { fetchUser, unblockUser, subscribeToUser } from '../../services/userService'
import LoadingSpinner from '../ui/LoadingSpinner'
import EmptyState from '../ui/EmptyState'
import UsernameLabel from '../ui/UsernameLabel'
import CachedAvatar from '../ui/CachedAvatar'
import { SettingsSection } from '../ui/SettingsUI'
import { btnSecondarySmClass, settingsRowClass, typoTitle3Class } from '../../utils/designSystem'
import { sad } from '../../assets'

export default function BlockedList() {
  const { user, refreshProfile } = useAuth()
  const [blockedUsers, setBlockedUsers] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user?.uid) return

    return subscribeToUser(user.uid, async (userProfile) => {
      const blockedIds = userProfile?.blocked || []
      const users = await Promise.all(blockedIds.map((id) => fetchUser(id)))
      setBlockedUsers(users.filter(Boolean))
      setLoading(false)
    })
  }, [user?.uid])

  const handleUnblock = async (targetId) => {
    try {
      await unblockUser(user.uid, targetId)
      await refreshProfile()
      toast.success('User unblocked')
    } catch {
      toast.error('Failed to unblock')
    }
  }

  return (
    <div className="pb-4">
      <h2 className={`${typoTitle3Class} px-[var(--ios-page-x-lg)] mb-4`}>Blocked Users</h2>
      {loading ? (
        <LoadingSpinner />
      ) : blockedUsers.length === 0 ? (
        <EmptyState message="No blocked users" />
      ) : (
        <SettingsSection>
          {blockedUsers.map((blockedUser) => (
            <div key={blockedUser.id} className={settingsRowClass}>
              <CachedAvatar
                src={blockedUser.photos?.[0]}
                fallback={sad}
                size={44}
                alt=""
                className="w-11 h-11 rounded-full object-cover shrink-0"
              />
              <div className="flex-1 min-w-0">
                <UsernameLabel username={blockedUser.username} badgeSize={14} />
              </div>
              <button
                type="button"
                onClick={() => handleUnblock(blockedUser.id)}
                className={btnSecondarySmClass}
              >
                Unblock
              </button>
            </div>
          ))}
        </SettingsSection>
      )}
    </div>
  )
}
