import { useEffect, useMemo, useState } from 'react'
import Modal from '../ui/Modal'
import MeetupStoryCard from '../stories/MeetupStoryCard'
import { fetchUsersMap } from '../../services/userService'
import { isMeetupActive, meetupExpiryMs } from '../../services/meetupService'
import { formatMeetupStoryTimer, getMeetupMapCoords } from '../../utils/storyHelpers'
import { typoTitle3Class } from '../../utils/designSystem'

export default function MeetupInfoModal({
  meetup,
  place = null,
  isMember = false,
  isOwn = false,
  onClose,
  onJoin,
  onOpenChat,
  onShowMap,
}) {
  const [participantProfiles, setParticipantProfiles] = useState({})
  const [now, setNow] = useState(Date.now())
  const [joining, setJoining] = useState(false)

  const participants = meetup?.participants || []

  useEffect(() => {
    if (!meetup) return undefined
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [meetup?.id])

  useEffect(() => {
    if (!participants.length) {
      setParticipantProfiles({})
      return undefined
    }
    let cancelled = false
    fetchUsersMap(participants).then((profiles) => {
      if (!cancelled) setParticipantProfiles(profiles)
    })
    return () => {
      cancelled = true
    }
  }, [participants.join(',')])

  const meetupWithPlace = useMemo(() => {
    if (!meetup) return null
    return {
      ...meetup,
      placeName: meetup.placeName || place?.name || '',
      placeEmoji: place?.emoji || meetup.placeEmoji || '📍',
      placePhotoUrl: place?.photoUrl || meetup.placePhotoUrl || '',
      placeLat: typeof meetup.placeLat === 'number' ? meetup.placeLat : place?.lat,
      placeLng: typeof meetup.placeLng === 'number' ? meetup.placeLng : place?.lng,
    }
  }, [meetup, place])

  const mapCoords = useMemo(
    () => getMeetupMapCoords(null, meetupWithPlace),
    [meetupWithPlace]
  )

  if (!meetup || !meetupWithPlace) return null

  const expiresAt = meetupExpiryMs(meetup)
  const stillActive = isMeetupActive(meetup, now)
  const members = participants.length
  const maxMembers = meetup.maxMembers || 0
  const isFull = maxMembers > 0 && members >= maxMembers
  const timeLeft = formatMeetupStoryTimer(expiresAt, now)

  const handlePrimary = async () => {
    if (isMember) {
      onOpenChat?.(meetup)
      return
    }
    if (joining || isFull || !stillActive) return
    setJoining(true)
    try {
      await onJoin?.(meetup)
    } finally {
      setJoining(false)
    }
  }

  return (
    <Modal isOpen onClose={onClose} glass overlayClassName="z-[1300]">
      <div className="p-4 pb-5">
        <div className="flex items-center justify-between gap-3 mb-4 px-1">
          <h3 className={typoTitle3Class}>Meetup</h3>
          <button
            type="button"
            onClick={onClose}
            className="text-[15px] font-medium text-[var(--ios-blue)] px-1 py-1"
          >
            Close
          </button>
        </div>

        <MeetupStoryCard
          meetupData={meetupWithPlace}
          meetupChatId={meetup.chatId || null}
          meetupTimeLeft={timeLeft}
          mapCoords={mapCoords}
          meetupMaxMembers={maxMembers || 10}
          meetupParticipants={participants}
          participantProfiles={participantProfiles}
          isOwn={isOwn}
          showJoin={!isMember && stillActive && !isFull}
          isJoined={isMember}
          meetupStillActive={stillActive}
          meetupIsFull={isFull}
          onJoinClick={handlePrimary}
          onOpenChat={() => onOpenChat?.(meetup)}
          onShowMap={
            onShowMap && mapCoords
              ? () => {
                  onShowMap(meetupWithPlace, mapCoords)
                  onClose()
                }
              : undefined
          }
          compact
          className="!w-full !max-w-none"
        />

        {joining ? (
          <p className="mt-3 text-center text-[13px] text-[var(--ios-label-secondary)]">Joining…</p>
        ) : null}
      </div>
    </Modal>
  )
}
