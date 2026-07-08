import { useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import { IconCircleCheck } from '@tabler/icons-react'
import Modal from '../ui/Modal'
import Button from '../ui/Button'
import TextField from '../ui/TextField'
import AgeSlider from '../profile/AgeSlider'
import { createMeetup } from '../../services/meetupService'
import { postMeetupStory } from '../../services/storyService'
import { STORY_PRIVACY } from '../../utils/storyHelpers'
import {
  typoTitle3Class,
  typoHeadlineClass,
  typoSubheadClass,
  segmentedControlClass,
  segmentedItemClass,
  segmentedItemActiveClass,
} from '../../utils/designSystem'

const DEFAULT_DURATION_HOURS = 2

const CHIP =
  'px-2.5 py-1 rounded-full text-[12px] border transition-colors'
const CHIP_ON = 'border-[var(--ios-blue)] bg-[var(--ios-blue)]/15 text-[var(--ios-label)]'
const CHIP_OFF = 'border-white/10 bg-white/[0.06] text-[var(--ios-label-secondary)]'

const compactLabel = 'text-[14px] text-[var(--ios-label-secondary)] mb-2 block'

function atHour(daysAhead, hour) {
  const d = new Date()
  d.setDate(d.getDate() + daysAhead)
  d.setHours(hour, 0, 0, 0)
  return d.getTime()
}

function buildTimePresets() {
  const now = Date.now()
  const tonight = atHour(0, 20)
  return [
    { id: 'in1', label: '1h', value: now + 60 * 60 * 1000 },
    { id: 'in2', label: '2h', value: now + 2 * 60 * 60 * 1000 },
    { id: 'tonight', label: 'Tonight', value: tonight > now ? tonight : atHour(1, 20) },
    { id: 'tomorrow', label: 'Tomorrow', value: atHour(1, 18) },
  ]
}

function toLocalInput(ms) {
  const d = new Date(ms)
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function formatShort(ms) {
  if (!ms) return ''
  return new Date(ms).toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function CreateMeetupModal({ isOpen, place, subplace, userId, username, onClose, onCreated }) {
  const presets = useMemo(buildTimePresets, [isOpen])
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [startMs, setStartMs] = useState(presets[0].value)
  const [presetId, setPresetId] = useState('in1')
  const [showCustom, setShowCustom] = useState(false)
  const [privacy, setPrivacy] = useState('public')
  const [maxMembers, setMaxMembers] = useState(10)
  const [selectedSubId, setSelectedSubId] = useState(null)
  const [saving, setSaving] = useState(false)
  const [createdMeetup, setCreatedMeetup] = useState(null)
  const [storyAdded, setStoryAdded] = useState(false)
  const [addingStory, setAddingStory] = useState(false)

  const subplaces = place?.subplaces || []

  useEffect(() => {
    if (!isOpen) return
    const fresh = buildTimePresets()
    setTitle('')
    setDescription('')
    setStartMs(fresh[0].value)
    setPresetId('in1')
    setShowCustom(false)
    setPrivacy('public')
    setMaxMembers(10)
    setSelectedSubId(subplace?.id || null)
    setCreatedMeetup(null)
    setStoryAdded(false)
    setAddingStory(false)
  }, [isOpen, subplace?.id])

  const selectedSub = subplaces.find((s) => s.id === selectedSubId) || null

  const handlePreset = (preset) => {
    setPresetId(preset.id)
    setStartMs(preset.value)
    setShowCustom(false)
  }

  const handleCustomChange = (value) => {
    const ms = new Date(value).getTime()
    if (ms) {
      setStartMs(ms)
      setPresetId('custom')
    }
  }

  const handleCreate = async () => {
    if (!startMs) {
      toast.error('Pick a start time')
      return
    }
    const endMs = startMs + DEFAULT_DURATION_HOURS * 60 * 60 * 1000
    setSaving(true)
    try {
      const meetup = await createMeetup({
        placeId: place.id,
        placeName: place.name,
        subplaceName: selectedSub?.name || '',
        creatorId: userId,
        creatorUsername: username,
        title,
        description,
        startAt: startMs,
        endAt: endMs,
        privacy,
        maxMembers,
      })
      setCreatedMeetup({ ...meetup, privacy })
      toast.success('Meetup created!')
    } catch (err) {
      toast.error(err.message || 'Failed to create meetup')
    } finally {
      setSaving(false)
    }
  }

  const handleAddToStory = async () => {
    if (!createdMeetup || storyAdded) return
    setAddingStory(true)
    try {
      await postMeetupStory(userId, {
        meetupId: createdMeetup.id,
        chatId: createdMeetup.chatId,
        title: createdMeetup.title,
        placeName: createdMeetup.placeName,
        subplaceName: createdMeetup.subplaceName,
        description: createdMeetup.description,
        startAt: createdMeetup.startAt,
        expiresAt: createdMeetup.expiresAt,
        privacy: createdMeetup.privacy === 'friends' ? STORY_PRIVACY.FRIENDS : STORY_PRIVACY.ALL,
      })
      setStoryAdded(true)
      toast.success('Added to your story')
    } catch (err) {
      toast.error(err.message || 'Could not add to story')
    } finally {
      setAddingStory(false)
    }
  }

  const handleDone = () => {
    if (createdMeetup) onCreated?.(createdMeetup)
    onClose()
  }

  if (!place) return null

  const activePlaceLabel = selectedSub ? `${place.name} · ${selectedSub.name}` : place.name

  if (createdMeetup) {
    return (
      <Modal
        isOpen={isOpen}
        onClose={handleDone}
        className="p-0 !overflow-hidden max-h-[min(78vh,750px)] flex flex-col"
      >
        <div className="px-5 pt-8 pb-6 flex flex-col items-center text-center">
          <div className="w-14 h-14 rounded-full bg-[var(--ios-green)]/15 flex items-center justify-center mb-4">
            <IconCircleCheck size={32} stroke={2} className="text-[var(--ios-green)]" />
          </div>
          <h3 className={typoTitle3Class}>Meetup created</h3>
          <p className={`${typoHeadlineClass} mt-2`}>{createdMeetup.title}</p>
          <p className={`${typoSubheadClass} mt-1`}>
            {createdMeetup.placeName}
            {createdMeetup.subplaceName ? ` · ${createdMeetup.subplaceName}` : ''}
          </p>
          <p className={`${typoSubheadClass} mt-1`}>{formatShort(createdMeetup.startAt)}</p>
        </div>

        <div className="shrink-0 px-5 py-4 border-t border-white/10 flex flex-col gap-3">
          <Button
            variant="filled"
            fullWidth
            onClick={handleAddToStory}
            disabled={storyAdded || addingStory}
          >
            {storyAdded ? 'Added to story' : addingStory ? 'Adding…' : 'Add to story'}
          </Button>
          <Button variant="bordered" fullWidth onClick={handleDone}>
            Open group chat
          </Button>
        </div>
      </Modal>
    )
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      className="p-0 !overflow-hidden max-h-[min(78vh,750px)] flex flex-col"
    >
      <div className="px-5 pt-5 pb-3 shrink-0 border-b border-white/10">
        <h3 className={typoTitle3Class}>New meetup</h3>
        <p className="text-[13px] text-[var(--ios-label-secondary)] truncate mt-1">{activePlaceLabel}</p>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4 space-y-5">
        {subplaces.length > 0 && (
          <div>
            <label className={compactLabel}>Spot</label>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setSelectedSubId(null)}
                className={`${CHIP} ${!selectedSub ? CHIP_ON : CHIP_OFF}`}
              >
                {place.emoji} Whole place
              </button>
              {subplaces.map((sub) => (
                <button
                  key={sub.id}
                  type="button"
                  onClick={() => setSelectedSubId(sub.id)}
                  className={`${CHIP} ${selectedSubId === sub.id ? CHIP_ON : CHIP_OFF}`}
                >
                  {sub.emoji} {sub.name}
                </button>
              ))}
            </div>
          </div>
        )}

        <div>
          <label className={compactLabel}>Title</label>
          <TextField
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={`Meetup at ${place.name}`}
            maxLength={60}
            className="!min-h-[40px] !py-2 !text-[15px]"
          />
        </div>

        <div>
          <label className={compactLabel}>Description</label>
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What's the plan?"
            maxLength={280}
            className="w-full px-4 py-2 min-h-[40px] bg-[var(--ios-fill-tertiary)] rounded-full border border-white/10 outline-none focus:border-[var(--ios-blue)] text-[15px] text-[var(--ios-label)] placeholder:text-[var(--ios-label-tertiary)]"
          />
        </div>

        <div>
          <div className="flex items-baseline justify-between gap-2 mb-2">
            <label className={`${compactLabel} mb-0`}>When</label>
            <span className="text-[12px] text-[var(--ios-blue)] truncate">{formatShort(startMs)}</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {presets.map((preset) => (
              <button
                key={preset.id}
                type="button"
                onClick={() => handlePreset(preset)}
                className={`${CHIP} ${presetId === preset.id ? CHIP_ON : CHIP_OFF}`}
              >
                {preset.label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setShowCustom((v) => !v)}
              className={`${CHIP} ${presetId === 'custom' ? CHIP_ON : CHIP_OFF}`}
            >
              Custom
            </button>
          </div>
          {showCustom && (
            <input
              type="datetime-local"
              value={toLocalInput(startMs)}
              onChange={(e) => handleCustomChange(e.target.value)}
              className="mt-2 w-full px-3 py-2.5 bg-[var(--ios-fill-tertiary)] rounded-[var(--ios-radius-md)] border border-white/10 outline-none focus:border-[var(--ios-blue)] text-[14px] text-[var(--ios-label)] [color-scheme:dark]"
            />
          )}
        </div>

        <div>
          <label className={compactLabel}>Privacy</label>
          <div className={segmentedControlClass}>
            {[
              { id: 'public', label: 'Public' },
              { id: 'friends', label: 'Friends only' },
            ].map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => setPrivacy(option.id)}
                className={privacy === option.id ? segmentedItemActiveClass : segmentedItemClass}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className={compactLabel}>Max members</label>
          <AgeSlider value={maxMembers} onChange={setMaxMembers} min={2} max={10} compact />
        </div>
      </div>

      <div className="shrink-0 px-5 py-4 border-t border-white/10 flex gap-3">
        <Button variant="bordered" className="flex-1 !min-h-[44px]" onClick={onClose} disabled={saving}>
          Cancel
        </Button>
        <Button variant="filled" className="flex-[1.4] !min-h-[44px]" onClick={handleCreate} disabled={saving}>
          {saving ? 'Creating…' : 'Create'}
        </Button>
      </div>
    </Modal>
  )
}
