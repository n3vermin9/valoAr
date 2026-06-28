import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { IconUsers } from '@tabler/icons-react'
import { useAuth } from '../../contexts/AuthContext'
import { getGroupByInviteCode, joinGroupByInviteCode } from '../../services/groupChatService'
import { getGroupDisplayName, isGroupMember } from '../../utils/groupChat'
import Button from '../ui/Button'
import LoadingSpinner from '../ui/LoadingSpinner'
import PageShell from '../layout/PageShell'

export default function GroupJoinPage() {
  const { inviteCode } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [group, setGroup] = useState(null)
  const [loading, setLoading] = useState(true)
  const [joining, setJoining] = useState(false)

  useEffect(() => {
    if (!inviteCode) return
    getGroupByInviteCode(inviteCode)
      .then((data) => setGroup(data))
      .finally(() => setLoading(false))
  }, [inviteCode])

  useEffect(() => {
    if (!group || !user?.uid) return
    if (isGroupMember(group, user.uid)) {
      navigate(`/groups/${group.id}`, { replace: true })
    }
  }, [group, user?.uid, navigate])

  const handleJoin = async () => {
    if (!user?.uid || !inviteCode) return
    setJoining(true)
    try {
      const joined = await joinGroupByInviteCode(inviteCode, user.uid)
      toast.success('Joined group')
      navigate(`/groups/${joined.id}`, { replace: true })
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

  const memberCount = group.participants?.length || 0

  return (
    <PageShell title="Join group">
      <div className="flex flex-col items-center text-center px-4 pt-8">
        <div className="w-24 h-24 rounded-full bg-blue-500/20 border border-blue-500/30 flex items-center justify-center mb-4">
          <IconUsers size={44} className="text-blue-400" stroke={1.5} />
        </div>
        <h2 className="text-2xl font-semibold text-white">{getGroupDisplayName(group)}</h2>
        {group.description && (
          <p className="text-white/60 text-sm mt-2 max-w-sm">{group.description}</p>
        )}
        <p className="text-white/45 text-sm mt-3">
          {memberCount} member{memberCount === 1 ? '' : 's'}
        </p>

        {!group.settings?.joinViaLink ? (
          <p className="text-white/50 text-sm mt-8">This group is not accepting link invites right now.</p>
        ) : (
          <Button fullWidth className="mt-8 max-w-sm" onClick={handleJoin} disabled={joining}>
            {joining ? 'Joining…' : 'Join group chat'}
          </Button>
        )}

        <Button variant="plain" className="mt-4" onClick={() => navigate('/chats')}>
          Cancel
        </Button>
      </div>
    </PageShell>
  )
}
