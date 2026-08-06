import toast from 'react-hot-toast'
import Modal from '../ui/Modal'
import { setChatMuteMode } from '../../services/chatService'
import {
  CHAT_MUTE_OFF,
  CHAT_MUTE_ALL,
  CHAT_MUTE_MENTIONS_REPLIES,
  getChatMuteMode,
} from '../../utils/chatMute'
import { listRowClass, typoTitle3Class } from '../../utils/designSystem'

const OPTIONS = [
  {
    id: CHAT_MUTE_OFF,
    label: 'All notifications',
    description: 'Receive every new message',
  },
  {
    id: CHAT_MUTE_MENTIONS_REPLIES,
    label: 'Mentions & replies only',
    description: 'Mute unless someone @mentions you or replies to you',
  },
  {
    id: CHAT_MUTE_ALL,
    label: 'Mute completely',
    description: 'No notifications from this chat',
  },
]

export default function MuteChatModal({ isOpen, onClose, chatId, chat, userId, title = 'Notifications' }) {
  const currentMode = getChatMuteMode(chat, userId)

  const handleSelect = async (mode) => {
    if (!chatId || !userId) return
    try {
      await setChatMuteMode(chatId, userId, mode)
      toast.success(
        mode === CHAT_MUTE_OFF
          ? 'Notifications enabled'
          : mode === CHAT_MUTE_ALL
            ? 'Chat muted'
            : 'Muted except mentions and replies'
      )
      onClose()
    } catch {
      toast.error('Failed to update notifications')
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} glass className="p-6">
      <h2 className={`${typoTitle3Class} mb-1`}>{title}</h2>
      <p className="text-sm text-[var(--ios-label-secondary)] mb-5">Choose what you want to be notified about.</p>
      <div className="space-y-2">
        {OPTIONS.map(({ id, label, description }) => (
          <button
            key={id}
            type="button"
            onClick={() => handleSelect(id)}
            className={`${listRowClass} w-full text-left ${currentMode === id ? 'ring-1 ring-blue-500/50' : ''}`}
          >
            <div>
              <p className="font-medium text-[var(--ios-label)]">{label}</p>
              <p className="text-xs text-[var(--ios-label-tertiary)] mt-0.5">{description}</p>
            </div>
          </button>
        ))}
      </div>
    </Modal>
  )
}
