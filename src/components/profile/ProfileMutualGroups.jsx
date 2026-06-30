import { useState, useEffect } from 'react'
import { subscribeChats } from '../../services/chatService'
import { isGroupChat, getGroupDisplayName } from '../../utils/groupChat'
import { SettingsSection } from '../ui/SettingsUI'
import GroupAvatar from '../chat/GroupAvatar'
import { typoHeadlineClass, typoSubheadClass } from '../../utils/designSystem'

export default function ProfileMutualGroups({ viewerId, profileUserId, onOpenGroup }) {
  const [groups, setGroups] = useState([])

  useEffect(() => {
    if (!viewerId || !profileUserId || viewerId === profileUserId) {
      setGroups([])
      return
    }
    return subscribeChats(viewerId, (chats) => {
      setGroups(
        chats.filter((c) => isGroupChat(c) && c.participants?.includes(profileUserId))
      )
    })
  }, [viewerId, profileUserId])

  if (!groups.length) return null

  return (
    <div className="mt-4">
      <SettingsSection title="Mutual groups">
        {groups.map((group) => (
          <button
            key={group.id}
            type="button"
            onClick={() => onOpenGroup?.(group.id)}
            className="w-full flex items-center gap-3 px-4 py-3.5 border-b border-white/10 last:border-b-0 text-left hover:bg-white/[0.05] active:bg-white/[0.08] transition-colors min-h-[60px]"
          >
            <GroupAvatar photoUrl={group.photoUrl} size={40} className="ring-1 ring-white/20" />
            <div className="min-w-0 flex-1">
              <p className={`${typoHeadlineClass} truncate`}>{getGroupDisplayName(group)}</p>
              <p className={`${typoSubheadClass} truncate`}>
                {group.participants?.length || 0} members
              </p>
            </div>
          </button>
        ))}
      </SettingsSection>
    </div>
  )
}
