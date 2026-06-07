import { useState, useEffect } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { fetchUser } from '../../services/userService'
import LoadingSpinner from '../ui/LoadingSpinner'
import EmptyState from '../ui/EmptyState'
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
    <div className="p-6">
      <h2 className="text-lg font-semibold mb-4">Friends</h2>
      {loading ? (
        <LoadingSpinner />
      ) : matches.length === 0 ? (
        <EmptyState message="No friends yet" />
      ) : (
        <div className="space-y-3">
          {matches.map((user) => (
            <button
              key={user.id}
              type="button"
              onClick={() => onSelectFriend?.(user.id)}
              className="w-full flex items-center gap-3 p-3 bg-white/5 hover:bg-white/10 rounded-2xl transition-colors text-left"
            >
              <img
                src={user.photos?.[0] || sad}
                alt=""
                className="w-12 h-12 rounded-full object-cover shrink-0"
              />
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{user.username}</p>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
