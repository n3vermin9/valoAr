import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { IconCheck } from '@tabler/icons-react'
import { useAuth } from '../../contexts/AuthContext'
import { createGroupChat } from '../../services/groupChatService'
import { normalizeUsername } from '../../utils/helpers'
import {
  createSanitizedChangeHandler,
  focusInputRefAtEnd,
  handleInputFocusCursor,
} from '../../utils/inputHelpers'
import { useGroupUsernameCheck } from '../../hooks/useGroupUsernameCheck'
import SubpageShell from '../layout/SubpageShell'
import { SettingsSection } from '../ui/SettingsUI'
import Button from '../ui/Button'
import {
  compactInputClass,
  compactInputAffixClass,
  compactInputInnerClass,
  fieldLabelClass,
  typoSubheadClass,
  typoHeadlineClass,
} from '../../utils/designSystem'

function EditFieldSection({ children }) {
  return (
    <SettingsSection>
      <div className="px-4 py-4">{children}</div>
    </SettingsSection>
  )
}

export default function CreateGroupPage() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [name, setName] = useState('')
  const [username, setUsername] = useState('')
  const [description, setDescription] = useState('')
  const [visibility, setVisibility] = useState('private')
  const [loading, setLoading] = useState(false)
  const usernameRef = useRef(null)

  const isPublic = visibility === 'public'
  const normalizedUsername = normalizeUsername(username)
  const { status: usernameStatus, error: usernameError } = useGroupUsernameCheck(
    username,
    null,
    isPublic
  )

  const usernameValid =
    !isPublic || (normalizedUsername.length >= 4 && usernameStatus === 'available')

  const usernameBorder = !isPublic
    ? 'border-white/10'
    : usernameStatus === 'available'
      ? 'border-green-500'
      : usernameStatus === 'taken' || usernameStatus === 'invalid'
        ? 'border-red-500'
        : 'border-white/10'

  const handleBack = () => navigate('/chats')

  const handleSelectPublic = () => {
    if (!normalizedUsername) {
      toast.error('Choose a group username before making the group public')
      if (usernameRef.current) focusInputRefAtEnd(usernameRef)
      return
    }
    if (usernameStatus !== 'available') {
      toast.error(usernameError || 'Choose a valid available username')
      return
    }
    setVisibility('public')
  }

  const handleCreate = async () => {
    if (!user?.uid) return
    if (isPublic && !usernameValid) {
      toast.error('Set a valid group username for public groups')
      return
    }

    setLoading(true)
    try {
      const group = await createGroupChat(user.uid, {
        name,
        username: isPublic ? normalizedUsername : '',
        description,
        settings: { visibility },
      })
      toast.success('Group created')
      navigate(`/chats/${group.id}`, { replace: true })
    } catch (err) {
      toast.error(err.message || 'Failed to create group')
      setLoading(false)
    }
  }

  const canSubmit = Boolean(name.trim()) && !loading && usernameValid

  return (
    <SubpageShell
      title="New group"
      onBack={handleBack}
      footer={
        <Button fullWidth onClick={handleCreate} disabled={!canSubmit}>
          {loading ? 'Creating…' : 'Create group'}
        </Button>
      }
    >
      <div className="space-y-4 pt-1">
        <EditFieldSection>
          <label className={fieldLabelClass}>Group name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onFocus={handleInputFocusCursor}
            placeholder="e.g. Weekend crew"
            maxLength={64}
            autoFocus
            className={compactInputClass}
          />

          <label className={`${fieldLabelClass} mt-4`}>Description (optional)</label>
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onFocus={handleInputFocusCursor}
            placeholder="What's this group about?"
            maxLength={280}
            className={compactInputClass}
          />
        </EditFieldSection>

        <EditFieldSection>
          <label className={fieldLabelClass}>
            Group username {isPublic ? '(required)' : '(required for public)'}
          </label>
          <div className={`${compactInputAffixClass} border ${usernameBorder}`}>
            <span className="pl-4 pr-1 text-[var(--ios-label-secondary)] text-[15px] leading-none">
              @
            </span>
            <input
              ref={usernameRef}
              value={username}
              onChange={createSanitizedChangeHandler(setUsername, normalizeUsername)}
              onFocus={handleInputFocusCursor}
              placeholder="groupname"
              maxLength={20}
              className={compactInputInnerClass}
            />
          </div>
          {isPublic && usernameError && (
            <p className="text-red-400 text-[13px] mt-1.5">{usernameError}</p>
          )}
          {isPublic && !usernameError && usernameStatus === 'available' && normalizedUsername && (
            <p className="text-green-400 text-[13px] mt-1.5">Available</p>
          )}
          {isPublic && usernameStatus === 'checking' && (
            <p className={`${typoSubheadClass} mt-1.5`}>Checking…</p>
          )}
        </EditFieldSection>

        <div>
          <p className={`${fieldLabelClass} px-4`}>Visibility</p>
          <SettingsSection>
            <button
              type="button"
              onClick={() => setVisibility('private')}
              className="w-full flex items-center gap-3 px-4 py-3.5 text-left border-b border-white/10"
            >
              <div className="flex-1 min-w-0">
                <p className={typoHeadlineClass}>Private</p>
                <p className={`${typoSubheadClass} mt-0.5`}>Invite link only — hidden from search</p>
              </div>
              {!isPublic && <IconCheck size={20} className="text-blue-400 shrink-0" stroke={2.25} />}
            </button>
            <button
              type="button"
              onClick={handleSelectPublic}
              className="w-full flex items-center gap-3 px-4 py-3.5 text-left"
            >
              <div className="flex-1 min-w-0">
                <p className={typoHeadlineClass}>Public</p>
                <p className={`${typoSubheadClass} mt-0.5`}>Find in search or join via invite link</p>
              </div>
              {isPublic && <IconCheck size={20} className="text-blue-400 shrink-0" stroke={2.25} />}
            </button>
          </SettingsSection>
        </div>
      </div>
    </SubpageShell>
  )
}
