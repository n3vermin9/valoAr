import { useState, useEffect } from 'react'
import { useAuth } from '../../../contexts/AuthContext'
import { subscribeChat } from '../../../services/chatService'
import { fetchUsersMap } from '../../../services/userService'
import { canAdmin, isGroupMember, isGroupOwner } from '../../../utils/groupChat'

export function useGroupSettingsChat(chatId) {
  const { user } = useAuth()
  const [chat, setChat] = useState(null)
  const [members, setMembers] = useState({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!chatId) return
    return subscribeChat(chatId, (data) => {
      if (data?.type !== 'group') {
        setChat(null)
        setLoading(false)
        return
      }
      setChat(data)
      setLoading(false)
    })
  }, [chatId])

  useEffect(() => {
    if (!chat?.participants?.length) return
    fetchUsersMap(chat.participants).then(setMembers)
  }, [chat?.participants?.join(',')])

  const isMember = isGroupMember(chat, user?.uid)
  const canEditInfo = canAdmin(chat, user?.uid, 'editGroupInfo')
  const canManageSettings = canAdmin(chat, user?.uid, 'manageInviteSettings')
  const canManageAdmins = canAdmin(chat, user?.uid, 'manageAdmins')
  const isOwner = isGroupOwner(chat, user?.uid)

  return {
    chat,
    members,
    loading,
    user,
    isMember,
    canEditInfo,
    canManageSettings,
    canManageAdmins,
    isOwner,
  }
}
