import { useEffect, useState } from 'react'
import { IconClockHour4, IconMapPin } from '@tabler/icons-react'
import {
  parseMeetupStoryContent,
  getMeetupMapCoords,
  getStoryCardColorClass,
} from '../../utils/storyHelpers'
import { getLowQualityImageSrc } from '../../utils/helpers'
import {
  btnFilledClass,
  storyGlassPillClass,
  typoTitle3Class,
  typoBodyClass,
  typoSubheadClass,
} from '../../utils/designSystem'
import MeetupParticipantRing from './MeetupParticipantRing'
import MeetupStoryMapPreview from './MeetupStoryMapPreview'
import { Skeleton } from '../ui/Skeleton'

function MeetupPlacePhoto({ src, compact, onFailed, framed = true, short = false }) {
  const [displaySrc, setDisplaySrc] = useState('')
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    setFailed(false)
    setDisplaySrc('')
    if (!src) return undefined

    if (compact) {
      getLowQualityImageSrc(src, { maxWidth: 360, quality: 0.48 }).then((next) => {
        if (!cancelled) setDisplaySrc(next || src)
      })
    } else {
      setDisplaySrc(src)
    }

    return () => {
      cancelled = true
    }
  }, [src, compact])

  useEffect(() => {
    if (failed) onFailed?.()
  }, [failed, onFailed])

  if (failed || !src) return null
  if (!displaySrc) {
    return (
      <Skeleton
        className={`w-full transition-[height] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] ${
          short ? 'h-[5rem]' : 'h-[9.5rem]'
        } ${framed ? 'border border-white/15' : ''}`}
        rounded="lg"
      />
    )
  }

  return (
    <div
      className={`relative w-full overflow-hidden rounded-[var(--ios-radius-lg)] bg-black/40 transition-[height] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] ${
        short ? 'h-[5rem]' : 'h-[9.5rem]'
      } ${framed ? 'border border-white/15' : ''}`}
    >
      <img
        src={displaySrc}
        alt=""
        loading="lazy"
        decoding="async"
        className="h-full w-full object-cover"
        onError={() => {
          if (displaySrc !== src) {
            setDisplaySrc(src)
            return
          }
          setFailed(true)
        }}
      />
      <div className="pointer-events-none absolute inset-0 bg-black/25" />
    </div>
  )
}

function stopControlEvent(e) {
  e.stopPropagation()
}

export default function MeetupStoryCard({
  story = null,
  meetupData = null,
  meetupChatId = null,
  meetupTimeLeft = '',
  mapCoords = null,
  mapCoordsPending = false,
  meetupMaxMembers = 10,
  meetupParticipants = [],
  participantProfiles = {},
  isOwn = false,
  showJoin = false,
  isJoined = false,
  meetupStillActive = true,
  meetupIsFull = false,
  onJoinClick,
  onOpenChat,
  onShowMap,
  hideAction = false,
  compact = false,
  /** `story` = same shell as text stories (no nested card / gesture capture). */
  variant = 'card',
  /** Shrink map/photo when the story reply keyboard is open. */
  keyboardOpen = false,
  militaryTime = true,
  className = '',
}) {
  const isStoryVariant = variant === 'story'
  const compactMedia = compact || (isStoryVariant && keyboardOpen)
  const { title, venue, time, description } = parseMeetupStoryContent(story, meetupData, {
    militaryTime,
  })
  const cardBgClass = getStoryCardColorClass(story?.color)
  const resolvedMapCoords = mapCoords || getMeetupMapCoords(story, meetupData)
  const placePinName = meetupData?.placeName || venue.split(' · ')[0] || venue
  const placePinEmoji = story?.meetupPlaceEmoji || meetupData?.placeEmoji || '📍'
  const placePhotoUrl = (
    story?.meetupPlacePhotoUrl ||
    meetupData?.placePhotoUrl ||
    meetupData?.photoUrl ||
    ''
  ).trim()
  const [photoFailed, setPhotoFailed] = useState(false)
  useEffect(() => {
    setPhotoFailed(false)
  }, [placePhotoUrl])
  const showPlacePhoto = Boolean(placePhotoUrl) && !photoFailed
  const canShowMap = Boolean(onShowMap && (resolvedMapCoords || meetupData?.placeId))

  let action = null
  if (!hideAction) {
    if (!isOwn) {
      if (showJoin) {
        action = (
          <button
            type="button"
            onPointerDown={stopControlEvent}
            onClick={(e) => {
              stopControlEvent(e)
              onJoinClick?.()
            }}
            className={`${btnFilledClass} w-full justify-center pointer-events-auto ${
              compact || isStoryVariant ? 'h-10 text-[15px]' : 'py-3 text-[17px]'
            } font-semibold`}
          >
            Join
          </button>
        )
      } else if (isJoined && meetupStillActive && meetupChatId) {
        action = (
          <button
            type="button"
            onPointerDown={stopControlEvent}
            onClick={(e) => {
              stopControlEvent(e)
              onOpenChat?.()
            }}
            className={`${btnFilledClass} w-full justify-center pointer-events-auto ${
              compact || isStoryVariant ? 'h-10 text-[15px]' : 'py-3 text-[17px]'
            } font-semibold`}
          >
            Open meetup chat
          </button>
        )
      } else if (meetupIsFull && meetupStillActive) {
        action = <p className="text-center text-sm text-white/60 py-2">This meetup is full</p>
      } else if (!meetupStillActive) {
        action = <p className="text-center text-sm text-white/60 py-2">This meetup has ended</p>
      }
    } else if (isOwn && meetupStillActive && meetupChatId) {
      action = (
        <button
          type="button"
          onPointerDown={stopControlEvent}
          onClick={(e) => {
            stopControlEvent(e)
            onOpenChat?.()
          }}
          className={`${btnFilledClass} w-full justify-center pointer-events-auto ${
            compact || isStoryVariant ? 'h-10 text-[15px]' : 'py-3 text-[17px]'
          } font-semibold`}
        >
          Open meetup chat
        </button>
      )
    }
  }

  const mapButton = canShowMap ? (
    <button
      type="button"
      onPointerDown={stopControlEvent}
      onClick={(e) => {
        stopControlEvent(e)
        onShowMap?.()
      }}
      className={`inline-flex items-center justify-center w-full rounded-full font-semibold bg-white text-black hover:bg-white/90 active:bg-white/80 transition-colors pointer-events-auto ${
        compact || isStoryVariant ? 'h-10 text-[15px] gap-2' : 'h-11 text-[15px] gap-2'
      }`}
    >
      <IconMapPin size={compact || isStoryVariant ? 16 : 18} stroke={2} />
      Show on map
    </button>
  ) : null

  const media = showPlacePhoto ? (
    <MeetupPlacePhoto
      src={placePhotoUrl}
      compact={compact || isStoryVariant}
      framed={!isStoryVariant}
      short={compactMedia}
      onFailed={() => setPhotoFailed(true)}
    />
  ) : resolvedMapCoords ? (
    <MeetupStoryMapPreview
      lat={resolvedMapCoords.lat}
      lng={resolvedMapCoords.lng}
      placeName={placePinName}
      emoji={placePinEmoji}
      compactHeight={compactMedia}
    />
  ) : (
    <div
      className={`relative w-full overflow-hidden rounded-[var(--ios-radius-lg)] transition-[height] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] ${
        compactMedia ? 'h-[5rem]' : 'h-[9.5rem]'
      } ${isStoryVariant ? 'bg-black/25' : 'border border-white/15'}`}
      aria-hidden
    >
      <Skeleton className="absolute inset-0 !rounded-none h-full w-full" rounded="sm" />
      {mapCoordsPending ? (
        <p className="absolute inset-x-0 bottom-3 text-center text-[11px] font-medium uppercase tracking-wide text-white/45 z-[1]">
          Loading map…
        </p>
      ) : null}
    </div>
  )

  const metaRow = (
    <div
      className={`flex items-center justify-between gap-2 w-full ${
        isStoryVariant
          ? 'absolute left-0 right-0 -top-5 z-10 pointer-events-none'
          : ''
      }`}
    >
      {meetupTimeLeft ? (
        <span
          className={`${storyGlassPillClass} tabular-nums shadow-lg shrink-0 ${
            isStoryVariant ? 'pointer-events-auto' : ''
          } ${compact || isStoryVariant ? 'px-2.5 py-1.5 text-[12px] gap-1.5' : 'text-sm'}`}
        >
          <IconClockHour4 size={compact || isStoryVariant ? 13 : 16} stroke={2} />
          <span>{meetupTimeLeft}</span>
        </span>
      ) : (
        <span />
      )}
      <MeetupParticipantRing
        maxMembers={meetupMaxMembers}
        participants={meetupParticipants}
        participantProfiles={participantProfiles}
        size={compact || isStoryVariant ? 'sm' : 'md'}
        className={`shrink-0 ${
          isStoryVariant ? 'pointer-events-auto -mr-1.5' : compact ? '-mr-1.5 -mt-0.5' : '-mr-3 -mt-0.5'
        }`}
      />
    </div>
  )

  // Story viewer: dark modal panel on the story gradient (no full-body scrim).
  if (isStoryVariant) {
    return (
      <div
        className={`relative mx-auto w-full max-w-[380px] overflow-visible ${className}`}
      >
        {metaRow}
        <div
          className={`relative w-full rounded-[var(--ios-radius-xl)] border border-white/15 shadow-[0_16px_48px_rgba(0,0,0,0.55)] ${cardBgClass} ${
            keyboardOpen ? 'px-5 pb-4 pt-7' : 'px-6 pb-6 pt-8'
          }`}
        >
          <div className={`text-center ${keyboardOpen ? 'space-y-2.5' : 'space-y-3.5'}`}>
            <h2 className="text-2xl sm:text-3xl font-semibold leading-snug text-white whitespace-pre-wrap break-words">
              {title}
            </h2>
            {media}
            {time ? (
              <p className="text-[15px] text-white/75 text-center w-full">
                {time}
              </p>
            ) : null}
            {description && !keyboardOpen ? (
              <p className="text-[17px] text-white/90 whitespace-pre-wrap break-words text-center">
                {description}
              </p>
            ) : null}
          </div>
          {(action || mapButton) && (
            <div className={`${keyboardOpen ? 'mt-3' : 'mt-5'} w-full space-y-2`}>
              {action}
              {mapButton}
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div
      className={`relative mx-auto overflow-visible ${
        compact ? 'w-[80vw] max-w-[80vw]' : 'w-full max-w-[380px]'
      } ${className}`}
    >
      <div
        className={`absolute left-0 right-0 z-10 flex items-center justify-between gap-2 pointer-events-none ${
          compact ? '-top-4' : '-top-6'
        }`}
      >
        {meetupTimeLeft ? (
          <span
            className={`${storyGlassPillClass} tabular-nums shadow-lg shrink-0 ${
              compact ? 'px-2.5 py-1.5 text-[12px] gap-1.5' : 'text-sm'
            }`}
          >
            <IconClockHour4 size={compact ? 13 : 16} stroke={2} />
            <span>{meetupTimeLeft}</span>
          </span>
        ) : (
          <span />
        )}
        <MeetupParticipantRing
          maxMembers={meetupMaxMembers}
          participants={meetupParticipants}
          participantProfiles={participantProfiles}
          size={compact ? 'sm' : 'md'}
          className={`shrink-0 ${compact ? '-mr-1.5 -mt-0.5' : '-mr-3 -mt-0.5'}`}
        />
      </div>

      <div
        className={`relative rounded-[var(--ios-radius-xl)] border border-white/15 shadow-[0_12px_40px_rgba(0,0,0,0.45)] ${cardBgClass} ${
          compact ? 'px-4 pb-5 pt-8' : 'px-6 pb-6 pt-9'
        }`}
      >
        <div className={`text-center ${compact ? 'space-y-3' : 'space-y-3.5'}`}>
          <h2 className={`${typoTitle3Class} text-white ${compact ? 'text-[18px] leading-snug' : 'text-[22px]'}`}>
            {title}
          </h2>

          {media}

          {time ? (
            <p className={`${typoSubheadClass} text-white/75 text-center w-full ${compact ? 'text-[13px]' : ''}`}>
              {time}
            </p>
          ) : null}

          {description && !compact ? (
            <p className={`${typoBodyClass} text-white/85 whitespace-pre-wrap break-words text-left`}>
              {description}
            </p>
          ) : null}
        </div>

        {(action || mapButton) && (
          <div className={`${compact ? 'mt-4' : 'mt-6'} space-y-2`}>
            {action}
            {mapButton}
          </div>
        )}
      </div>
    </div>
  )
}
