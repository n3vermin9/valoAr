import { useState } from 'react'
import toast from 'react-hot-toast'
import Modal from '../ui/Modal'
import TextField from '../ui/TextField'
import Button from '../ui/Button'
import { createGroupChat } from '../../services/groupChatService'
import { listRowClass } from '../../utils/designSystem'

export default function CreateGroupModal({ isOpen, onClose, userId, onCreated }) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [visibility, setVisibility] = useState('private')
  const [loading, setLoading] = useState(false)

  const handleClose = () => {
    if (loading) return
    setName('')
    setDescription('')
    setVisibility('private')
    onClose()
  }

  const handleCreate = async () => {
    if (!userId) return
    setLoading(true)
    try {
      const group = await createGroupChat(userId, {
        name,
        description,
        settings: { visibility },
      })
      toast.success('Group created')
      handleClose()
      onCreated?.(group)
    } catch (err) {
      toast.error(err.message || 'Failed to create group')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={handleClose} glass className="p-6">
      <h2 className="text-xl font-semibold text-white mb-1">New group chat</h2>
      <p className="text-sm text-white/55 mb-5">Create a group and invite people with a link.</p>

      <div className="space-y-4">
        <div>
          <label className="block text-sm text-white/70 mb-1.5">Group name</label>
          <TextField
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Weekend crew"
            maxLength={64}
            autoFocus
          />
        </div>

        <div>
          <label className="block text-sm text-white/70 mb-1.5">Description (optional)</label>
          <TextField
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What's this group about?"
            maxLength={280}
          />
        </div>

        <div>
          <p className="text-sm text-white/70 mb-2">Visibility</p>
          <button
            type="button"
            onClick={() => setVisibility('private')}
            className={`${listRowClass} w-full text-left ${visibility === 'private' ? 'ring-1 ring-blue-500/50' : ''}`}
          >
            <div>
              <p className="font-medium text-white">Private</p>
              <p className="text-xs text-white/50 mt-0.5">Only join via invite link or button</p>
            </div>
          </button>
          <button
            type="button"
            onClick={() => setVisibility('public')}
            className={`${listRowClass} w-full text-left mt-2 ${visibility === 'public' ? 'ring-1 ring-blue-500/50' : ''}`}
          >
            <div>
              <p className="font-medium text-white">Public</p>
              <p className="text-xs text-white/50 mt-0.5">Discoverable in group search</p>
            </div>
          </button>
        </div>
      </div>

      <div className="flex gap-3 mt-6">
        <Button variant="bordered" fullWidth onClick={handleClose} disabled={loading}>
          Cancel
        </Button>
        <Button fullWidth onClick={handleCreate} disabled={loading || !name.trim()}>
          {loading ? 'Creating…' : 'Create group'}
        </Button>
      </div>
    </Modal>
  )
}
