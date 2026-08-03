import { useEffect, useMemo, useState } from 'react'
import toast from 'react-hot-toast'
import {
  IconCircleCheck,
  IconUsers,
  IconWorld,
  IconMinus,
  IconPlus,
  IconChevronLeft,
} from '@tabler/icons-react'
import Modal from '../ui/Modal'
import Button from '../ui/Button'
import TextField from '../ui/TextField'
import { allowAutofocus } from '../../utils/iosInput'
import { createMeetup } from '../../services/meetupService'
import { postMeetupStory } from '../../services/storyService'
import { STORY_PRIVACY } from '../../utils/storyHelpers'
import { typoTitle3Class, typoHeadlineClass, typoSubheadClass } from '../../utils/designSystem'

const DEFAULT_DURATION_HOURS = 2
const MEMBERS_CAP = 10
const DEFAULT_MAX_MEMBERS = 2

const CHIP =
  'shrink-0 px-3 h-9 rounded-full text-[13px] border transition-colors'
const CHIP_ON = 'border-[var(--ios-blue)] bg-[var(--ios-blue)]/15 text-[var(--ios-label)]'
const CHIP_OFF = 'border-white/10 bg-white/[0.06] text-[var(--ios-label-secondary)]'

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
    hour12: false,
  })
}

export default function CreateMeetupModal({
  isOpen,
  place,
  subplace,
  userId,
  username,
  creatorGender = '',
  onClose,
  onCreated,
}) {
  const presets = useMemo(buildTimePresets, [isOpen])
  const [step, setStep] = useState('details')
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [startMs, setStartMs] = useState(presets[0].value)
  const [presetId, setPresetId] = useState('in1')
  const [showCustom, setShowCustom] = useState(false)
  const [privacy, setPrivacy] = useState('public')
  const [maxMembers, setMaxMembers] = useState(DEFAULT_MAX_MEMBERS)
  const [selectedSubId, setSelectedSubId] = useState(null)
  const [saving, setSaving] = useState(false)
  const [createdMeetup, setCreatedMeetup] = useState(null)
  const [storyAdded, setStoryAdded] = useState(false)
  const [addingStory, setAddingStory] = useState(false)

  const subplaces = place?.subplaces || []

  useEffect(() => {
    if (!isOpen) return
    const fresh = buildTimePresets()
    setStep('details')
    setTitle('')
    setDescription('')
    setStartMs(fresh[0].value)
    setPresetId('in1')
    setShowCustom(false)
    setPrivacy('public')
    setMaxMembers(DEFAULT_MAX_MEMBERS)
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
        placeLat: place.lat,
        placeLng: place.lng,
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
        placeId: place.id,
        placeLat: place.lat,
        placeLng: place.lng,
        placeEmoji: place.emoji,
        placePhotoUrl: place.photoUrl,
        maxMembers: createdMeetup.maxMembers,
        participantIds: createdMeetup.participants || [userId],
        participantGenders: creatorGender ? { [userId]: creatorGender } : {},
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

  if (createdMeetup) {
    return (
      <Modal isOpen={isOpen} onClose={handleDone} className="p-5">
        <div className="flex flex-col items-center text-center pt-2 pb-1">
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

        <div className="mt-5 flex flex-col gap-2">
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

  const PrivacyIcon = privacy === 'public' ? IconWorld : IconUsers
  const placeSubtitle = selectedSub ? `${place.name} · ${selectedSub.name}` : place.name

  return (
    <Modal isOpen={isOpen} onClose={onClose} className="p-5">
      <div className="flex items-center gap-3 mb-4">
        {step === 'when' ? (
          <button
            type="button"
            onClick={() => setStep('details')}
            className="w-11 h-11 rounded-full border border-white/10 bg-white/[0.06] flex items-center justify-center text-[var(--ios-label)] shrink-0"
            aria-label="Back"
          >
            <IconChevronLeft size={22} stroke={2} />
          </button>
        ) : (
          <div className="w-11 h-11 rounded-full bg-[var(--ios-fill-tertiary)] border border-white/10 flex items-center justify-center text-xl shrink-0">
            {place.emoji}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <h3 className={typoTitle3Class}>{step === 'when' ? 'When?' : 'New meetup'}</h3>
          <p className="text-[13px] text-[var(--ios-label-secondary)] truncate">
            {step === 'when' ? title.trim() || `Meetup at ${place.name}` : placeSubtitle}
          </p>
        </div>
      </div>

      {step === 'details' ? (
        <>
          <div className="space-y-4">
            {subplaces.length > 0 ? (
              <div className="flex gap-1.5 overflow-x-auto touch-pan-x pb-0.5 -mx-0.5 px-0.5">
                <button
                  type="button"
                  onClick={() => setSelectedSubId(null)}
                  className={`${CHIP} ${!selectedSub ? CHIP_ON : CHIP_OFF}`}
                >
                  Whole place
                </button>
                {subplaces.map((sub) => (
                  <button
                    key={sub.id}
                    type="button"
                    onClick={() => setSelectedSubId(sub.id)}
                    className={`${CHIP} ${selectedSubId === sub.id ? CHIP_ON : CHIP_OFF}`}
                  >
                    {sub.name}
                  </button>
                ))}
              </div>
            ) : null}

            <TextField
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={`Meetup at ${place.name}`}
              maxLength={60}
              autoFocus={allowAutofocus()}
            />

            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description"
              maxLength={280}
              className="w-full px-4 h-11 bg-[var(--ios-fill-tertiary)] rounded-full border border-white/10 outline-none focus:border-[var(--ios-blue)] text-[15px] text-[var(--ios-label)] placeholder:text-[var(--ios-label-tertiary)]"
            />

            <div className="flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => setPrivacy((p) => (p === 'public' ? 'friends' : 'public'))}
                className="inline-flex items-center gap-2 h-11 px-3.5 rounded-full border border-white/10 bg-white/[0.06] text-[14px] text-[var(--ios-label)]"
                aria-label={`Privacy: ${privacy === 'public' ? 'Public' : 'Friends only'}. Click to switch.`}
              >
                <PrivacyIcon size={16} stroke={2} className="text-[var(--ios-blue)]" />
                {privacy === 'public' ? 'Public' : 'Friends'}
              </button>

              <div className="inline-flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setMaxMembers((n) => Math.max(2, n - 1))}
                  className="w-9 h-9 rounded-full border border-white/10 bg-white/[0.06] flex items-center justify-center text-[var(--ios-label)] disabled:opacity-40"
                  disabled={maxMembers <= 2}
                  aria-label="Fewer members"
                >
                  <IconMinus size={16} stroke={2} />
                </button>
                <span className="min-w-[2.5rem] text-center text-[14px] text-[var(--ios-label)] tabular-nums">
                  {maxMembers}
                </span>
                <button
                  type="button"
                  onClick={() => setMaxMembers((n) => Math.min(MEMBERS_CAP, n + 1))}
                  className="w-9 h-9 rounded-full border border-white/10 bg-white/[0.06] flex items-center justify-center text-[var(--ios-label)] disabled:opacity-40"
                  disabled={maxMembers >= MEMBERS_CAP}
                  aria-label="More members"
                >
                  <IconPlus size={16} stroke={2} />
                </button>
              </div>
            </div>
          </div>

          <div className="mt-5">
            <Button variant="filled" fullWidth onClick={() => setStep('when')}>
              Next
            </Button>
          </div>
        </>
      ) : (
        <>
          <div className="space-y-4">
            <div className="flex gap-1.5 overflow-x-auto touch-pan-x pb-0.5 -mx-0.5 px-0.5">
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
                onClick={() => {
                  setShowCustom(true)
                  setPresetId('custom')
                }}
                className={`${CHIP} ${presetId === 'custom' ? CHIP_ON : CHIP_OFF}`}
              >
                Custom
              </button>
            </div>
            <p className="text-[15px] text-[var(--ios-blue)] font-medium">{formatShort(startMs)}</p>
            {showCustom || presetId === 'custom' ? (
              <input
                type="datetime-local"
                value={toLocalInput(startMs)}
                onChange={(e) => handleCustomChange(e.target.value)}
                className="w-full px-3.5 h-11 bg-[var(--ios-fill-tertiary)] rounded-full border border-white/10 outline-none focus:border-[var(--ios-blue)] text-[14px] text-[var(--ios-label)] [color-scheme:dark]"
              />
            ) : null}
          </div>

          <div className="mt-5">
            <Button variant="filled" fullWidth onClick={handleCreate} disabled={saving}>
              {saving ? 'Creating…' : 'Create meetup'}
            </Button>
          </div>
        </>
      )}
    </Modal>
  )
}
