import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { useAuth } from '../../contexts/AuthContext'
import { resolveGroupJoinSlug, joinGroupByInviteCode } from '../../services/groupChatService'
import { getGroupDisplayName, getGroupPhotoUrl, isGroupMember } from '../../utils/groupChat'
import GroupAvatar from './GroupAvatar'
import Button from '../ui/Button'
import LoadingSpinner from '../ui/LoadingSpinner'
import { typoTitle2Class } from '../../utils/designSystem'
import PhotoGallery from '../ui/PhotoGallery'

export default function GroupJoinPage() {
  const { inviteCode: joinSlug } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [group, setGroup] = useState(null)
  const [loading, setLoading] = useState(true)
  const [joining, setJoining] = useState(false)
  const [galleryOpen, setGalleryOpen] = useState(false)

  useEffect(() => {
    if (!joinSlug) return
    resolveGroupJoinSlug(joinSlug)
      .then((data) => setGroup(data))
      .finally(() => setLoading(false))
  }, [joinSlug])

  useEffect(() => {
    if (!group || !user?.uid) return
    if (isGroupMember(group, user.uid)) {
      navigate(`/chats/${group.id}`, { replace: true })
      return
    }
    if (group.settings?.visibility === 'public') {
      navigate(`/chats/${group.id}`, {
        replace: true,
        state: { groupPreview: true, joinSlug, previewReturnTo: '/chats' },
      })
    }
  }, [group, user?.uid, navigate, joinSlug])

  const handleJoin = async () => {
    if (!user?.uid || !joinSlug) return
    setJoining(true)
    try {
      const joined = await joinGroupByInviteCode(joinSlug, user.uid)
      toast.success('Joined group')
      navigate(`/chats/${joined.id}`, { replace: true })
    } catch (err) {
      toast.error(err.message || 'Failed to join group')
    } finally {
      setJoining(false)
    }
  }

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <LoadingSpinner />
      </div>
    )
  }

  if (!group) {
    return (
      <PageShell title="Join group">
        <div className="flex flex-col items-center justify-center flex-1 gap-4 text-center px-6">
          <p className="text-white/60">This invite link is invalid or has expired.</p>
          <Button onClick={() => navigate('/chats')}>Back to chats</Button>
        </div>
      </PageShell>
    )
  }

  const isPublic = group.settings?.visibility === 'public'

  if (isPublic) {
    return (
      <div className="h-full flex items-center justify-center">
        <LoadingSpinner />
      </div>
    )
  }

  return (
    <PageShell title="Join group">
      <div className="flex flex-col min-h-full pb-28">
        <div className="flex flex-col items-center px-6 pt-8 text-center">
          <button
            type="button"
            onClick={() => setGalleryOpen(true)}
            className="rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60"
            aria-label="View group photo"
          >
            <GroupAvatar photoUrl={group.photoUrl} size={128} className="border-4 border-white/10" />
          </button>
          <h2 className={`${typoTitle2Class} mt-4 text-center`}>{getGroupDisplayName(group)}</h2>
        </div>
      </div>

      <div className="fixed bottom-0 left-0 right-0 z-20 px-6 pb-[max(1.5rem,var(--ios-safe-bottom))] pt-4 bg-gradient-to-t from-black via-black/95 to-transparent">
        <Button fullWidth onClick={handleJoin} disabled={joining}>
          {joining ? 'Joining…' : 'Join chat'}
        </Button>
        <Button variant="plain" fullWidth className="mt-2" onClick={() => navigate('/chats')}>
          Cancel
        </Button>
      </div>

      {galleryOpen && (
        <PhotoGallery photos={[getGroupPhotoUrl(group)]} onClose={() => setGalleryOpen(false)} />
      )}
    </PageShell>
  )
}
