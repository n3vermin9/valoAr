import { useNavigate, useParams, useLocation } from 'react-router-dom'
import { getGroupMemberRole, isGroupOwner } from '../../../utils/groupChat'
import { typoSubheadClass } from '../../../utils/designSystem'
import LoadingSpinner from '../../ui/LoadingSpinner'
import { useGroupSettingsChat } from './useGroupSettingsChat'
import GroupSettingsShell from './GroupSettingsShell'
import { SettingsSection } from '../../ui/SettingsUI'
import GroupMemberRow from '../GroupMemberRow'

export default function GroupSettingsAdmins() {
  const { chatId } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const { chat, members, loading, isMember, canManageAdmins, user } = useGroupSettingsChat(chatId)
  const settingsPath = `/groups/${chatId}/settings`

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <LoadingSpinner />
      </div>
    )
  }

  if (!chat || !isMember || !canManageAdmins) {
    return (
      <GroupSettingsShell title="Admins" backTo={settingsPath}>
        <p className={`${typoSubheadClass} text-center mt-12 px-6`}>You cannot manage admins</p>
      </GroupSettingsShell>
    )
  }

  const sortedParticipants = [...(chat.participants || [])].sort((a, b) => {
    const roleOrder = { owner: 0, admin: 1, member: 2 }
    const ra = roleOrder[getGroupMemberRole(chat, a)] ?? 2
    const rb = roleOrder[getGroupMemberRole(chat, b)] ?? 2
    if (ra !== rb) return ra - rb
    const na = members[a]?.username || ''
    const nb = members[b]?.username || ''
    return na.localeCompare(nb)
  })

  return (
    <GroupSettingsShell title="Admins" backTo={settingsPath}>
      <div className="pb-24">
        <SettingsSection>
          {sortedParticipants.map((memberId) => {
            const owner = isGroupOwner(chat, memberId)
            return (
              <GroupMemberRow
                key={memberId}
                chat={chat}
                chatId={chatId}
                memberId={memberId}
                member={members[memberId]}
                currentUserId={user?.uid}
                variant="settings"
                showChevron={!owner}
                onNavigateManage={
                  owner
                    ? undefined
                    : (id) =>
                        navigate(`/groups/${chatId}/settings/admins/${id}`, {
                          state: location.state,
                        })
                }
              />
            )
          })}
        </SettingsSection>
      </div>
    </GroupSettingsShell>
  )
}
