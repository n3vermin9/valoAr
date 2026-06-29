import { useParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import { IconCopy, IconLink } from '@tabler/icons-react'
import {
  updateGroupSettings,
  regenerateInviteCode,
} from '../../../services/groupChatService'
import { getGroupJoinLink } from '../../../utils/groupChat'
import { normalizeUsername } from '../../../utils/helpers'
import Button from '../../ui/Button'
import LoadingSpinner from '../../ui/LoadingSpinner'
import { useGroupSettingsChat } from './useGroupSettingsChat'
import GroupSettingsShell from './GroupSettingsShell'
import { SettingSwitch, SettingsSection } from '../../ui/SettingsUI'

export default function GroupSettingsJoin() {
  const { chatId } = useParams()
  const { chat, loading, isMember, canManageSettings, user } = useGroupSettingsChat(chatId)

  const isPublic = chat?.settings?.visibility === 'public'
  const normalizedUsername = normalizeUsername(chat?.username || '')

  const handleVisibilityChange = async (makePublic) => {
    if (makePublic) {
      if (!normalizedUsername) {
        toast.error('Set a group username before making the group public')
        return
      }
    }

    try {
      await updateGroupSettings(chatId, user.uid, { visibility: makePublic ? 'public' : 'private' })
      toast.success(makePublic ? 'Group is now public' : 'Group is now private')
    } catch (err) {
      toast.error(err.message || 'Failed to update settings')
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
      <div className="h-full flex items-center justify-center">
        <LoadingSpinner />
      </div>
    )
  }

  if (!chat || !isMember || !canManageSettings) {
    return (
      <GroupSettingsShell title="Join & invite" backTo={`/groups/${chatId}/settings`}>
        <p className="text-center text-white/60 mt-12 px-6">You cannot manage join settings</p>
      </GroupSettingsShell>
    )
  }

  return (
    <GroupSettingsShell title="Join & invite" backTo={`/groups/${chatId}/settings`}>
      <div className="space-y-6 px-2 pb-24">
        <SettingsSection title="Discovery">
          <SettingSwitch
            label="Public group"
            description={
              isPublic
                ? 'Discoverable in search — members can join from search or invite link'
                : 'Invite link only — hidden from search'
            }
            checked={isPublic}
            onChange={handleVisibilityChange}
          />
          <div className="px-4 py-4">
            <p className="text-sm text-white/50">
              {isPublic
                ? 'Anyone can find this group in Discover and join, or use the invite link below.'
                : 'Only people with the invite link can join this group.'}
            </p>
          </div>
        </SettingsSection>

        <SettingsSection title="Invite link">
          <div className="px-4 py-4">
            <div className="flex items-center gap-2 text-white/70 text-sm mb-2">
              <IconLink size={16} />
              Shareable link
            </div>
            <p className="text-xs text-white/45 break-all mb-3">
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
