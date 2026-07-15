import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { subscribeMeetup, meetupExpiryMs, isMeetupActive } from '../../services/meetupService'
import { fetchMapPlace } from '../../services/placesService'
import { fetchUsersMap } from '../../services/userService'
import {
  formatMeetupStoryTimer,
  getMeetupMapCoords,
  preloadMeetupMapTiles,
} from '../../utils/storyHelpers'
import { usesMilitaryTime } from '../../utils/helpers'
import MeetupStoryCard from '../stories/MeetupStoryCard'

function toMs(value) {
  if (!value) return 0
  if (typeof value === 'number') return value
  if (typeof value.toMillis === 'function') return value.toMillis()
  return 0
}

export default function MeetupPinnedInfo({
  meetupId,
  chat,
  message,
  profile,
  actionHidden = false,
  readOnly = false,
  onContextMenu,
  onLongPress,
  onReply,
}) {
  const navigate = useNavigate()
  const rootRef = useRef(null)
  const pressTimerRef = useRef(null)
  const touchStartRef = useRef({ x: 0, y: 0 })
  const [meetup, setMeetup] = useState(null)
  const [place, setPlace] = useState(null)
  const [participantProfiles, setParticipantProfiles] = useState({})
  const [now, setNow] = useState(Date.now())
  const militaryTime = usesMilitaryTime(profile)

  useEffect(() => {
    if (!meetupId) {
      setMeetup(null)
      return undefined
    }
    return subscribeMeetup(meetupId, setMeetup)
  }, [meetupId])

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    const placeId = meetup?.placeId
    if (!placeId) {
      setPlace(null)
      return undefined
    }
    let cancelled = false
    fetchMapPlace(placeId)
      .then((data) => {
        if (!cancelled) setPlace(data)
      })
      .catch(() => {
        if (!cancelled) setPlace(null)
      })
    return () => {
      cancelled = true
    }
  }, [meetup?.placeId])

  const participants = meetup?.participants || chat?.participants || []

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
    if (!meetup && !chat) return null
    const base = meetup || {
      title: chat?.name,
      description: chat?.description,
      participants: chat?.participants,
      maxMembers: chat?.memberLimit,
      expiresAt: chat?.expiresAt,
    }
    return {
      ...base,
      placePhotoUrl: place?.photoUrl || base.placePhotoUrl || '',
      placeEmoji: place?.emoji || base.placeEmoji || '📍',
      placeName: base.placeName || place?.name || '',
      placeLat: base.placeLat ?? place?.lat,
      placeLng: base.placeLng ?? place?.lng,
      placeId: base.placeId || place?.id,
    }
  }, [meetup, chat, place])

  const expiresAtMs = meetup
    ? meetupExpiryMs(meetup) || toMs(meetup.expiresAt)
    : toMs(chat?.expiresAt)
  const meetupTimeLeft = expiresAtMs ? formatMeetupStoryTimer(expiresAtMs, now) : ''
  const mapCoords = getMeetupMapCoords(null, meetupWithPlace)
  const mapCoordsPending = Boolean(meetup?.placeId && !place && !mapCoords)

  useEffect(() => {
    // Only warm map tiles when we need the map preview (no place photo).
    if (!mapCoords || meetupWithPlace?.placePhotoUrl) return
    preloadMeetupMapTiles(mapCoords.lat, mapCoords.lng)
  }, [mapCoords?.lat, mapCoords?.lng, meetupWithPlace?.placePhotoUrl])

  const getRect = () => rootRef.current?.getBoundingClientRect()

  const clearPressTimer = () => {
    if (pressTimerRef.current) {
      clearTimeout(pressTimerRef.current)
      pressTimerRef.current = null
    }
  }

  const handleContextMenu = (e) => {
    if (readOnly || !message) return
    e.preventDefault()
    e.stopPropagation()
    onContextMenu?.(message, getRect())
  }

  const handleTouchStart = (e) => {
    if (readOnly || !message) return
    const touch = e.touches[0]
    touchStartRef.current = { x: touch.clientX, y: touch.clientY }
    clearPressTimer()
    pressTimerRef.current = setTimeout(() => onLongPress?.(message, getRect()), 500)
  }

  const handleTouchMove = (e) => {
    const touch = e.touches[0]
    const dx = touch.clientX - touchStartRef.current.x
    const dy = touch.clientY - touchStartRef.current.y
    if (Math.abs(dx) > 8 || Math.abs(dy) > 8) clearPressTimer()
  }

  const handleTouchEnd = () => clearPressTimer()

  const handleShowMap = () => {
    navigate('/discover', {
      state: {
        openMap: true,
        focusPlaceId: meetupWithPlace?.placeId || null,
        focusLat: mapCoords?.lat ?? meetupWithPlace?.placeLat ?? null,
        focusLng: mapCoords?.lng ?? meetupWithPlace?.placeLng ?? null,
      },
    })
  }

  if (!meetupWithPlace) return null

  return (
    <div
      ref={rootRef}
      data-message-id={message?.id}
      data-allow-contextmenu={readOnly || !message ? undefined : true}
      className={`mb-4 pt-5 flex justify-center ${actionHidden ? 'invisible' : ''}`}
      onContextMenu={handleContextMenu}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
      onDoubleClick={() => {
        if (!readOnly && message) onReply?.(message)
      }}
    >
      <MeetupStoryCard
        meetupData={meetupWithPlace}
        meetupChatId={meetup?.chatId || chat?.id || null}
        meetupTimeLeft={meetupTimeLeft === 'Ended' ? 'Ended' : meetupTimeLeft}
        mapCoords={mapCoords}
        mapCoordsPending={mapCoordsPending}
        meetupMaxMembers={meetupWithPlace.maxMembers || chat?.memberLimit || 10}
        meetupParticipants={participants}
        participantProfiles={participantProfiles}
        compact
        militaryTime={militaryTime}
        onShowMap={handleShowMap}
        meetupStillActive={meetup ? isMeetupActive(meetup, now) : true}
        hideAction
        className="shadow-[0_8px_28px_rgba(0,0,0,0.35)]"
      />
    </div>
  )
}
