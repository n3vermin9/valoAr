import { useState, useEffect, useMemo } from 'react'
import toast from 'react-hot-toast'
import { IconHeart, IconX } from '@tabler/icons-react'
import { useAuth } from '../../contexts/AuthContext'
import {
  subscribeLikesReceived,
  acceptLike,
  declineLike,
  markLikeAsRead,
  fetchUser,
  fetchDeletedUser,
  getOutgoingRequestIds,
  cancelFriendRequest,
} from '../../services/userService'
import { sad, star } from '../../assets'
import { APP_NAME } from '../../utils/helpers'
import EmptyState from '../ui/EmptyState'
import LoadingSpinner from '../ui/LoadingSpinner'
import Modal from '../ui/Modal'
import { PublicProfileView } from '../profile/ProfileView'

export default function LikedYou() {
  const { user, profile, refreshProfile } = useAuth()
  const [likes, setLikes] = useState([])
  const [profiles, setProfiles] = useState({})
  const [loading, setLoading] = useState(true)
  const [viewProfile, setViewProfile] = useState(null)
  const [showOutgoing, setShowOutgoing] = useState(false)
  const [outgoingProfiles, setOutgoingProfiles] = useState({})
  const [outgoingLoading, setOutgoingLoading] = useState(false)
  const [cancelingId, setCancelingId] = useState(null)

  const outgoingIds = useMemo(() => getOutgoingRequestIds(profile), [profile])

  useEffect(() => {
    if (!user?.uid) return

    const unsub = subscribeLikesReceived(user.uid, async (receivedLikes) => {
      setLikes(receivedLikes)

      const profileMap = {}
      for (const like of receivedLikes) {
        const fromId = like.fromUserId || like.id
        profileMap[fromId] = (await fetchUser(fromId)) || (await fetchDeletedUser(fromId))
      }
      setProfiles(profileMap)
      setLoading(false)

      if (document.hidden && receivedLikes.some((l) => !l.read)) {
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification(APP_NAME, {
            body: 'Someone wants to be your friend!',
            icon: star,
          })
        }
      }
    })

    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission()
    }

    return unsub
  }, [user?.uid])

  useEffect(() => {
    likes.forEach((like) => {
      if (!like.read) {
        markLikeAsRead(user.uid, like.fromUserId || like.id)
      }
    })
  }, [likes, user?.uid])

  useEffect(() => {
    if (!showOutgoing) return
    let cancelled = false

    async function loadOutgoing() {
      setOutgoingLoading(true)
      const profileMap = {}
      for (const id of outgoingIds) {
        profileMap[id] = (await fetchUser(id)) || (await fetchDeletedUser(id))
      }
      if (!cancelled) {
        setOutgoingProfiles(profileMap)
        setOutgoingLoading(false)
      }
    }

    loadOutgoing()
    return () => {
      cancelled = true
    }
  }, [showOutgoing, outgoingIds])

  const handleAccept = async (fromUserId) => {
    try {
      await acceptLike(user.uid, fromUserId)
      await refreshProfile()
      toast.success("You're now friends!")
    } catch {
      toast.error('Failed to accept')
    }
  }

  const handleDecline = async (fromUserId) => {
    try {
      await declineLike(user.uid, fromUserId)
      toast.success('Declined')
    } catch {
      toast.error('Failed to decline')
    }
  }

  const handleCancelRequest = async (targetId) => {
    setCancelingId(targetId)
    try {
      await cancelFriendRequest(user.uid, targetId)
      await refreshProfile()
      toast.success('Request cancelled')
    } catch {
      toast.error('Failed to cancel request')
    } finally {
      setCancelingId(null)
    }
  }

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <LoadingSpinner />
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col pb-24">
      <div className="flex items-center justify-between px-6 pt-6 gap-3">
        <h1 className="text-xl font-bold">Friend Requests</h1>
        <button
          onClick={() => setShowOutgoing(true)}
          className="text-sm text-blue-400 hover:text-blue-300 transition-colors shrink-0"
        >
          Requests{outgoingIds.length > 0 ? ` (${outgoingIds.length})` : ''}
        </button>
      </div>

      {likes.length === 0 ? (
        <EmptyState message="No friend requests yet. Keep discovering!" className="flex-1" />
      ) : (
        <div className="px-4 mt-4 space-y-4 overflow-y-auto">
          {likes.map((like) => {
            const fromId = like.fromUserId || like.id
            const p = profiles[fromId]
            if (!p) return null
            const isDeleted = p.deleted === true

            return (
              <div key={fromId} className="p-4 bg-white/5 rounded-2xl border border-white/10">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setViewProfile(fromId)}
                    className="flex items-center gap-4 flex-1 min-w-0 text-left"
                  >
                    <img
                      src={isDeleted ? sad : p.photos?.[0] || sad}
                      alt=""
                      className="w-16 h-16 rounded-full object-cover shrink-0"
                    />
                    <div className="min-w-0">
                      <p className="font-semibold truncate">{p.username}</p>
                      <p className="text-sm text-white/50">
                        {isDeleted ? 'Account deleted' : `${p.age} years old`}
                      </p>
                    </div>
                  </button>
                  <div className="flex gap-2 shrink-0">
                    <button
                      onClick={() => handleDecline(fromId)}
                      className="w-12 h-12 rounded-full bg-white/10 hover:bg-red-500/20 flex items-center justify-center border border-white/10"
                      aria-label="Decline"
                    >
                      <IconX size={22} className="text-red-400" />
                    </button>
                    {!isDeleted && (
                      <button
                        onClick={() => handleAccept(fromId)}
                        className="w-12 h-12 rounded-full bg-white/10 hover:bg-green-500/20 flex items-center justify-center border border-white/10"
                        aria-label="Accept"
                      >
                        <IconHeart size={22} className="text-green-400" />
                      </button>
                    )}
                  </div>
                </div>

                {like.message && (
                  <div className="mt-3 flex justify-start">
                    <div className="bg-blue-500/20 px-4 py-2 rounded-2xl rounded-bl-sm max-w-[80%]">
                      <p className="text-sm">{like.message}</p>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      <Modal isOpen={!!viewProfile} onClose={() => setViewProfile(null)}>
        {viewProfile && (
          <PublicProfileView userId={viewProfile} onClose={() => setViewProfile(null)} />
        )}
      </Modal>

      <Modal isOpen={showOutgoing} onClose={() => setShowOutgoing(false)} className="max-w-lg">
        <div className="p-6">
          <h2 className="text-lg font-semibold mb-4">Requests</h2>
          {outgoingLoading ? (
            <LoadingSpinner />
          ) : outgoingIds.length === 0 ? (
            <EmptyState message="No pending requests" />
          ) : (
            <div className="space-y-3">
              {outgoingIds.map((targetId) => {
                const p = outgoingProfiles[targetId]
                if (!p) return null
                const isDeleted = p.deleted === true
                return (
                  <div
                    key={targetId}
                    className="flex items-center gap-3 p-3 bg-white/5 rounded-2xl border border-white/10"
                  >
                    <button
                      onClick={() => {
                        setShowOutgoing(false)
                        setViewProfile(targetId)
                      }}
                      className="flex items-center gap-3 flex-1 min-w-0 text-left"
                    >
                      <img
                        src={isDeleted ? sad : p.photos?.[0] || sad}
                        alt=""
                        className="w-12 h-12 rounded-full object-cover shrink-0"
                      />
                      <div className="min-w-0">
                        <p className="font-medium truncate">{p.username}</p>
                        <p className="text-xs text-white/50">
                          {isDeleted ? 'Account deleted' : 'Pending'}
                        </p>
                      </div>
                    </button>
                    <button
                      onClick={() => handleCancelRequest(targetId)}
                      disabled={cancelingId === targetId}
                      className="px-3 py-2 text-sm text-red-400 hover:bg-red-500/10 rounded-full border border-red-500/30 disabled:opacity-50 shrink-0"
                    >
                      {cancelingId === targetId ? '...' : 'Cancel'}
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </Modal>
    </div>
  )
}
