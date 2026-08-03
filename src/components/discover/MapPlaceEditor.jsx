import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { IconTrash, IconPlus, IconPhoto } from '@tabler/icons-react'
import Modal from '../ui/Modal'
import Button from '../ui/Button'
import TextField from '../ui/TextField'
import { allowAutofocus } from '../../utils/iosInput'
import { PLACE_TYPES, getPlaceTypeEmoji } from '../../utils/discoverMapData'
import { typoTitle3Class, fieldLabelClass } from '../../utils/designSystem'

let subId = 0
const nextSubId = () => `sub-${Date.now()}-${subId++}`

export default function MapPlaceEditor({ isOpen, place, onClose, onSave, onDelete }) {
  const [name, setName] = useState('')
  const [type, setType] = useState('other')
  const [emoji, setEmoji] = useState('📍')
  const [photoUrl, setPhotoUrl] = useState('')
  const [photoFailed, setPhotoFailed] = useState(false)
  const [subplaces, setSubplaces] = useState([])
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const isNew = !place?.id
  const trimmedPhoto = photoUrl.trim()

  useEffect(() => {
    if (!isOpen || !place) return
    setName(place.name || '')
    setType(place.type || 'other')
    setEmoji(place.emoji || getPlaceTypeEmoji(place.type || 'other'))
    setPhotoUrl(place.photoUrl || '')
    setPhotoFailed(false)
    setSubplaces(
      (place.subplaces || []).map((sub) => ({
        id: sub.id || nextSubId(),
        name: sub.name || '',
        emoji: sub.emoji || '📌',
      }))
    )
  }, [isOpen, place])

  useEffect(() => {
    setPhotoFailed(false)
  }, [photoUrl])

  const selectType = (nextType) => {
    setType(nextType)
    setEmoji(getPlaceTypeEmoji(nextType))
  }

  const addSubplace = () => {
    setSubplaces((prev) => [...prev, { id: nextSubId(), name: '', emoji: '📌' }])
  }

  const updateSubplace = (id, nextName) => {
    setSubplaces((prev) => prev.map((sub) => (sub.id === id ? { ...sub, name: nextName } : sub)))
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
        emoji,
        type,
        photoUrl: trimmedPhoto,
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
    <Modal isOpen={isOpen} onClose={onClose} className="p-5">
      <h3 className={`${typoTitle3Class} mb-4`}>{isNew ? 'New place' : 'Edit place'}</h3>

      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <div
            className="w-12 h-12 rounded-full bg-[var(--ios-fill-tertiary)] border border-white/10 flex items-center justify-center text-2xl shrink-0"
            aria-hidden
          >
            {emoji}
          </div>
          <div className="flex-1 min-w-0">
            <TextField
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Place name"
              maxLength={40}
              autoFocus={isNew && allowAutofocus()}
            />
          </div>
        </div>

        <div className="flex gap-1.5 overflow-x-auto touch-pan-x pb-0.5 -mx-0.5 px-0.5">
          {PLACE_TYPES.map((placeType) => {
            const selected = type === placeType.id
            return (
              <button
                key={placeType.id}
                type="button"
                onClick={() => selectType(placeType.id)}
                title={placeType.label}
                aria-label={placeType.label}
                aria-pressed={selected}
                className={`shrink-0 w-11 h-11 rounded-full text-lg flex items-center justify-center border transition-colors ${
                  selected
                    ? 'border-[var(--ios-blue)] bg-[var(--ios-blue)]/20'
                    : 'border-white/10 bg-white/[0.05] hover:bg-white/[0.08]'
                }`}
              >
                {placeType.emoji}
              </button>
            )
          })}
        </div>

        <div>
          <div className="flex items-center gap-2 rounded-full border border-[var(--ios-separator)] bg-[var(--ios-fill-tertiary)] px-3 h-12">
            <IconPhoto size={18} stroke={2} className="text-[var(--ios-label-tertiary)] shrink-0" />
            <input
              value={photoUrl}
              onChange={(e) => setPhotoUrl(e.target.value)}
              placeholder="Photo link"
              maxLength={1000}
              className="flex-1 min-w-0 bg-transparent text-[15px] text-[var(--ios-label)] placeholder:text-[var(--ios-label-tertiary)] outline-none"
              aria-label="Photo URL"
            />
            {trimmedPhoto ? (
              <button
                type="button"
                onClick={() => setPhotoUrl('')}
                className="text-[13px] text-[var(--ios-label-secondary)] shrink-0"
              >
                Clear
              </button>
            ) : null}
          </div>
          {trimmedPhoto && !photoFailed ? (
            <div className="mt-2 rounded-[var(--ios-radius-md)] overflow-hidden border border-white/10">
              <img
                src={trimmedPhoto}
                alt=""
                className="w-full aspect-[16/9] object-cover"
                onError={() => setPhotoFailed(true)}
              />
            </div>
          ) : null}
          {trimmedPhoto && photoFailed ? (
            <p className="mt-1.5 text-[12px] text-[var(--ios-red)]">Couldn’t load this image</p>
          ) : null}
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className={`${fieldLabelClass} mb-0`}>Spots</label>
            <button
              type="button"
              onClick={addSubplace}
              className="inline-flex items-center gap-1 text-[13px] text-[var(--ios-blue)]"
            >
              <IconPlus size={15} stroke={2} />
              Add
            </button>
          </div>
          {subplaces.length === 0 ? (
            <p className="text-[13px] text-[var(--ios-label-tertiary)]">Optional — floor, room, area…</p>
          ) : (
            <div className="space-y-2">
              {subplaces.map((sub) => (
                <div key={sub.id} className="flex items-center gap-2">
                  <input
                    value={sub.name}
                    onChange={(e) => updateSubplace(sub.id, e.target.value)}
                    placeholder="Spot name"
                    maxLength={40}
                    className="flex-1 min-w-0 px-3.5 h-10 bg-[var(--ios-fill-tertiary)] rounded-full border border-white/10 outline-none focus:border-[var(--ios-blue)] text-[15px] text-[var(--ios-label)] placeholder:text-[var(--ios-label-tertiary)]"
                  />
                  <button
                    type="button"
                    onClick={() => removeSubplace(sub.id)}
                    className="p-2 rounded-full text-[var(--ios-red)] hover:bg-red-500/10 shrink-0"
                    aria-label="Remove spot"
                  >
                    <IconTrash size={18} stroke={2} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="mt-5 flex flex-col gap-2">
        <Button variant="filled" fullWidth onClick={handleSave} disabled={saving || deleting}>
          {saving ? 'Saving…' : isNew ? 'Create place' : 'Save'}
        </Button>
        {!isNew && (
          <Button variant="danger" fullWidth onClick={handleDelete} disabled={saving || deleting}>
            {deleting ? 'Deleting…' : 'Delete'}
          </Button>
        )}
      </div>
    </Modal>
  )
}
