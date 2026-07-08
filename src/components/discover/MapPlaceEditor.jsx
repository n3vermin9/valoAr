import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { IconTrash, IconPlus } from '@tabler/icons-react'
import Modal from '../ui/Modal'
import Button from '../ui/Button'
import TextField from '../ui/TextField'
import { PLACE_TYPES, getPlaceTypeEmoji } from '../../utils/discoverMapData'
import { typoTitle3Class, fieldLabelClass } from '../../utils/designSystem'

let subId = 0
const nextSubId = () => `sub-${Date.now()}-${subId++}`

export default function MapPlaceEditor({ isOpen, place, onClose, onSave, onDelete }) {
  const [name, setName] = useState('')
  const [emoji, setEmoji] = useState('📍')
  const [type, setType] = useState('other')
  const [subplaces, setSubplaces] = useState([])
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const isNew = !place?.id

  useEffect(() => {
    if (!isOpen || !place) return
    setName(place.name || '')
    setEmoji(place.emoji || getPlaceTypeEmoji(place.type || 'other'))
    setType(place.type || 'other')
    setSubplaces(
      (place.subplaces || []).map((sub) => ({
        id: sub.id || nextSubId(),
        name: sub.name || '',
        emoji: sub.emoji || '📌',
      }))
    )
  }, [isOpen, place])

  const handleTypeChange = (nextType) => {
    setType(nextType)
    const previousDefault = getPlaceTypeEmoji(type)
    if (!emoji || emoji === previousDefault) {
      setEmoji(getPlaceTypeEmoji(nextType))
    }
  }

  const addSubplace = () => {
    setSubplaces((prev) => [...prev, { id: nextSubId(), name: '', emoji: '📌' }])
  }

  const updateSubplace = (id, patch) => {
    setSubplaces((prev) => prev.map((sub) => (sub.id === id ? { ...sub, ...patch } : sub)))
  }

  const removeSubplace = (id) => {
    setSubplaces((prev) => prev.filter((sub) => sub.id !== id))
  }

  const handleSave = async () => {
    const trimmedName = name.trim()
    if (!trimmedName) {
      toast.error('Enter a place name')
      return
    }
    const cleanedSubs = subplaces
      .map((sub) => ({
        id: sub.id,
        name: sub.name.trim(),
        emoji: (sub.emoji || '📌').trim() || '📌',
      }))
      .filter((sub) => sub.name)

    setSaving(true)
    try {
      await onSave({
        name: trimmedName,
        emoji: emoji.trim() || getPlaceTypeEmoji(type),
        type,
        subplaces: cleanedSubs,
      })
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    setDeleting(true)
    try {
      await onDelete()
    } finally {
      setDeleting(false)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} className="p-6">
      <h3 className={`${typoTitle3Class} mb-5`}>{isNew ? 'New place' : 'Edit place'}</h3>

      <div className="space-y-5">
        <div>
          <label className={fieldLabelClass}>Name</label>
          <TextField
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Place name"
            maxLength={40}
          />
        </div>

        <div>
          <label className={fieldLabelClass}>Icon</label>
          <TextField
            value={emoji}
            onChange={(e) => setEmoji(e.target.value.slice(0, 4))}
            placeholder="Emoji"
            className="text-center text-2xl"
          />
        </div>

        <div>
          <label className={fieldLabelClass}>Type</label>
          <div className="grid grid-cols-4 gap-2">
            {PLACE_TYPES.map((placeType) => (
              <button
                key={placeType.id}
                type="button"
                onClick={() => handleTypeChange(placeType.id)}
                className={`flex flex-col items-center gap-1 py-2 rounded-[var(--ios-radius-md)] border transition-colors ${
                  type === placeType.id
                    ? 'border-[var(--ios-blue)] bg-[var(--ios-blue)]/15 text-[var(--ios-label)]'
                    : 'border-white/10 bg-white/[0.05] text-[var(--ios-label-secondary)]'
                }`}
              >
                <span className="text-lg">{placeType.emoji}</span>
                <span className="text-[11px]">{placeType.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className={`${fieldLabelClass} mb-0`}>Subplaces</label>
            <button
              type="button"
              onClick={addSubplace}
              className="inline-flex items-center gap-1 text-sm text-[var(--ios-blue)]"
            >
              <IconPlus size={16} stroke={2} />
              Add
            </button>
          </div>
          {subplaces.length === 0 ? (
            <p className="text-[13px] text-[var(--ios-label-secondary)]">
              e.g. Food court, Second floor, Cinema
            </p>
          ) : (
            <div className="space-y-2">
              {subplaces.map((sub) => (
                <div key={sub.id} className="flex items-center gap-2">
                  <input
                    value={sub.emoji}
                    onChange={(e) => updateSubplace(sub.id, { emoji: e.target.value.slice(0, 4) })}
                    className="w-12 shrink-0 text-center text-lg py-2 bg-[var(--ios-fill-tertiary)] rounded-[var(--ios-radius-md)] border border-white/10 outline-none focus:border-[var(--ios-blue)]"
                  />
                  <input
                    value={sub.name}
                    onChange={(e) => updateSubplace(sub.id, { name: e.target.value })}
                    placeholder="Subplace name"
                    maxLength={40}
                    className="flex-1 min-w-0 px-3 py-2 bg-[var(--ios-fill-tertiary)] rounded-[var(--ios-radius-md)] border border-white/10 outline-none focus:border-[var(--ios-blue)] text-[15px] text-[var(--ios-label)] placeholder:text-[var(--ios-label-tertiary)]"
                  />
                  <button
                    type="button"
                    onClick={() => removeSubplace(sub.id)}
                    className="p-2 rounded-full text-[var(--ios-red)] hover:bg-red-500/10 shrink-0"
                    aria-label="Remove subplace"
                  >
                    <IconTrash size={18} stroke={2} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="mt-6 flex flex-col gap-3">
        <Button variant="filled" fullWidth onClick={handleSave} disabled={saving || deleting}>
          {saving ? 'Saving…' : isNew ? 'Create place' : 'Save changes'}
        </Button>
        {!isNew && (
          <Button variant="danger" fullWidth onClick={handleDelete} disabled={saving || deleting}>
            {deleting ? 'Deleting…' : 'Delete place'}
          </Button>
        )}
        <Button variant="plain" fullWidth onClick={onClose} disabled={saving || deleting}>
          Cancel
        </Button>
      </div>
    </Modal>
  )
}
