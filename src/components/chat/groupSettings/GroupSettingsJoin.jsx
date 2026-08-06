import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import { IconCopy, IconLink, IconCheck, IconX } from '@tabler/icons-react'
import {
  updateGroupSettings,
  regenerateInviteCode,
  subscribeGroupJoinRequests,
  approveGroupJoinRequest,
  denyGroupJoinRequest,
} from '../../../services/groupChatService'
import { fetchUser } from '../../../services/userService'
import { getGroupJoinLink } from '../../../utils/groupChat'
import { normalizeUsername } from '../../../utils/helpers'
import Button from '../../ui/Button'
import { FormSkeleton } from '../../ui/Skeleton'
import { useGroupSettingsChat } from './useGroupSettingsChat'
import GroupSettingsShell from './GroupSettingsShell'
import { SettingSwitch, SettingsSection } from '../../ui/SettingsUI'
import { typoSubheadClass } from '../../../utils/designSystem'

export default function GroupSettingsJoin() {
  const { chatId } = useParams()
  const { chat, loading, isMember, canManageSettings, user } = useGroupSettingsChat(chatId)
  const [joinRequests, setJoinRequests] = useState([])
  const [requestProfiles, setRequestProfiles] = useState({})
  const [actingOn, setActingOn] = useState(null)

  const isPublic = chat?.settings?.visibility === 'public'
  const requireApproval = chat?.settings?.requireApproval === true
  const normalizedUsername = normalizeUsername(chat?.username || '')

  useEffect(() => {
    if (!chatId || !canManageSettings) return
    return subscribeGroupJoinRequests(chatId, setJoinRequests)
  }, [chatId, canManageSettings])

  useEffect(() => {
    if (!joinRequests.length) {
      setRequestProfiles({})
      return
    }
    let cancelled = false
    ;(async () => {
      const profiles = {}
      await Promise.all(
        joinRequests.map(async (req) => {
          profiles[req.userId] = (await fetchUser(req.userId)) || { username: req.username }
        })
      )
      if (!cancelled) setRequestProfiles(profiles)
    })()
    return () => {
      cancelled = true
    }
  }, [joinRequests])

  const handleVisibilityChange = async (makePublic) => {
    if (makePublic && !normalizedUsername) {
      toast.error('Set a group username before making the group public')
      return
    }

    try {
      await updateGroupSettings(chatId, user.uid, { visibility: makePublic ? 'public' : 'private' })
      toast.success(makePublic ? 'Group is now public' : 'Group is now private')
    } catch (err) {
      toast.error(err.message || 'Failed to update settings')
    }
  }

  const handleRequireApprovalChange = async (checked) => {
    try {
      await updateGroupSettings(chatId, user.uid, { requireApproval: checked })
      toast.success(checked ? 'Join requests require approval' : 'Members can join instantly')
    } catch (err) {
      toast.error(err.message || 'Failed to update settings')
    }
  }

  const handleApprove = async (requestUserId) => {
    setActingOn(requestUserId)
    try {
      await approveGroupJoinRequest(chatId, user.uid, requestUserId)
      toast.success('Member approved')
    } catch (err) {
      toast.error(err.message || 'Failed to approve request')
    } finally {
      setActingOn(null)
    }
  }

  const handleDeny = async (requestUserId) => {
    setActingOn(requestUserId)
    try {
      await denyGroupJoinRequest(chatId, user.uid, requestUserId)
      toast.success('Request declined')
    } catch (err) {
      toast.error(err.message || 'Failed to decline request')
    } finally {
      setActingOn(null)
    }
  }

  const handleCopyLink = async () => {
    const link = getGroupJoinLink(chat)
    if (!link) return
    try {
      await navigator.clipboard.writeText(link)
      toast.success('Group link copied')
    } catch {
      toast.error('Failed to copy link')
    }
  }

  const handleRegenerateLink = async () => {
    try {
      await regenerateInviteCode(chatId, user.uid)
      toast.success('New invite link generated')
    } catch (err) {
      toast.error(err.message || 'Failed to regenerate link')
    }
  }

  if (loading) {
    return (
      <div className="h-full overflow-y-auto">
        <FormSkeleton />
      </div>
    )
  }

  if (!chat || !isMember || !canManageSettings) {
    return (
      <GroupSettingsShell title="Join & invite" backTo={`/groups/${chatId}/settings`}>
        <p className="text-center text-[var(--ios-label-secondary)] mt-12 px-6">You cannot manage join settings</p>
      </GroupSettingsShell>
    )
  }

  return (
    <GroupSettingsShell title="Join & invite" backTo={`/groups/${chatId}/settings`}>
      <div className="space-y-6 px-2 pb-24">
        <SettingsSection title="Discovery">
          <SettingSwitch
            label="Show in Discover"
            checked={isPublic}
            onChange={handleVisibilityChange}
          />
          <SettingSwitch
            label="Require admin approval"
            checked={requireApproval}
            onChange={handleRequireApprovalChange}
          />
        </SettingsSection>

        {joinRequests.length > 0 && (
          <SettingsSection title="Pending requests">
            {joinRequests.map((req) => {
              const profile = requestProfiles[req.userId]
              const name = profile?.username || req.username || 'User'
              return (
                <div key={req.id} className="px-4 py-3 flex items-center gap-3 border-b border-[var(--ios-hairline)] last:border-b-0">
                  <div className="min-w-0 flex-1">
                    <p className="text-[15px] font-medium text-[var(--ios-label)] truncate">{name}</p>
                    <p className={`${typoSubheadClass} mt-0.5`}>Wants to join</p>
                  </div>
                  <button
                    type="button"
                    disabled={actingOn === req.userId}
                    onClick={() => handleDeny(req.userId)}
                    className="h-9 w-9 rounded-full bg-[var(--ios-fill-tertiary)] flex items-center justify-center"
                    aria-label={`Decline ${name}`}
                  >
                    <IconX size={18} className="text-[var(--ios-label-secondary)]" />
                  </button>
                  <button
                    type="button"
                    disabled={actingOn === req.userId}
                    onClick={() => handleApprove(req.userId)}
                    className="h-9 w-9 rounded-full bg-[var(--ios-blue)] flex items-center justify-center"
                    aria-label={`Approve ${name}`}
                  >
                    <IconCheck size={18} className="text-white" />
                  </button>
                </div>
              )
            })}
          </SettingsSection>
        )}

        <SettingsSection title="Invite link">
          <div className="px-4 py-4">
            <div className="flex items-center gap-2 text-[var(--ios-label-secondary)] text-sm mb-2">
              <IconLink size={16} />
              Shareable link
            </div>
            <p className="text-xs text-[var(--ios-label-tertiary)] break-all mb-3">
              {getGroupJoinLink(chat) || 'Set a group username in Group info to get a shareable link'}
            </p>
            <div className="flex gap-2">
              <Button type="button" variant="bordered" className="flex-1" onClick={handleCopyLink}>
                <IconCopy size={16} className="inline mr-1.5 -mt-0.5" />
                Copy
              </Button>
              <Button type="button" variant="bordered" className="flex-1" onClick={handleRegenerateLink}>
                Regenerate
              </Button>
            </div>
          </div>
        </SettingsSection>
      </div>
    </GroupSettingsShell>
  )
}
