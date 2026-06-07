import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import { useAuth } from '../../contexts/AuthContext'
import { fetchUser, unblockUser, subscribeToUser } from '../../services/userService'
import LoadingSpinner from '../ui/LoadingSpinner'
import EmptyState from '../ui/EmptyState'
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
    <div className="p-6">
      <h2 className="text-lg font-semibold mb-4">Blocked Users</h2>
      {loading ? (
        <LoadingSpinner />
      ) : blockedUsers.length === 0 ? (
        <EmptyState message="No blocked users" />
      ) : (
        <div className="space-y-3">
          {blockedUsers.map((blockedUser) => (
            <div key={blockedUser.id} className="flex items-center gap-3 p-3 bg-white/5 rounded-2xl">
              <img
                src={blockedUser.photos?.[0] || sad}
                alt=""
                className="w-12 h-12 rounded-full object-cover"
              />
              <div className="flex-1">
                <p className="font-medium">{blockedUser.username}</p>
              </div>
              <button
                onClick={() => handleUnblock(blockedUser.id)}
                className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-full text-sm"
              >
                Unblock
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
