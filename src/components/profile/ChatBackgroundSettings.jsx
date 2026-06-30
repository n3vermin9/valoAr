import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import { useAuth } from '../../contexts/AuthContext'
import { updateUserSettings } from '../../services/userService'
import { setProfileEditorOpen } from '../../utils/profileOverlay'
import { SubpageHeaderBar } from '../layout/SubpageShell'
import { pageBottomClearanceClass } from '../../utils/designSystem'
import { CHAT_BACKGROUNDS, resolveChatBackgroundId } from '../../utils/chatBackgrounds'
import { ChatBackgroundPreview } from '../chat/ChatBackground'

export default function ChatBackgroundSettings({ onBack }) {
  const { user, profile, setProfile } = useAuth()
  const [selectedId, setSelectedId] = useState(() => resolveChatBackgroundId(profile))
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setProfileEditorOpen(true)
    return () => setProfileEditorOpen(false)
  }, [])

  const handleSelect = async (backgroundId) => {
    if (!user?.uid || saving || backgroundId === selectedId) return
    const previousId = selectedId
    setSelectedId(backgroundId)
    setSaving(true)
    try {
      await updateUserSettings(user.uid, { chatBackgroundId: backgroundId })
      setProfile((prev) => (prev ? { ...prev, chatBackgroundId: backgroundId } : prev))
      toast.success('Chat background updated')
    } catch {
      setSelectedId(previousId)
      toast.error('Failed to update background')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[85] bg-black flex flex-col">
      <SubpageHeaderBar title="Chat background" onBack={onBack} />

      <div className={`flex-1 overflow-y-auto px-[var(--ios-page-x-lg)] ${pageBottomClearanceClass}`}>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {CHAT_BACKGROUNDS.map((background) => (
            <ChatBackgroundPreview
              key={background.id}
              backgroundId={background.id}
              selected={selectedId === background.id}
              onClick={() => handleSelect(background.id)}
              className={saving ? 'opacity-70 pointer-events-none' : ''}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
