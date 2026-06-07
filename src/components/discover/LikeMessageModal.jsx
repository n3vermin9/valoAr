import { useState } from 'react'
import Modal from '../ui/Modal'

export default function LikeMessageModal({ isOpen, onClose, onSend }) {
  const [message, setMessage] = useState('')

  const handleSend = () => {
    onSend(message.trim())
    setMessage('')
    onClose()
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <div className="p-6">
        <h3 className="text-lg font-semibold mb-4">Send a friend request with message</h3>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Say something nice..."
          className="w-full px-4 py-3 bg-white/10 rounded-2xl border border-white/10 outline-none focus:border-blue-500 resize-none h-24 mb-4"
          maxLength={200}
        />
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-3 bg-white/10 rounded-full">
            Cancel
          </button>
          <button onClick={handleSend} className="flex-1 py-3 bg-blue-500 rounded-full">
            Send Request
          </button>
        </div>
      </div>
    </Modal>
  )
}
