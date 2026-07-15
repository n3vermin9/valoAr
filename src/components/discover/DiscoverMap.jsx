import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import './discover-map.css'
import toast from 'react-hot-toast'
import {
  IconCurrentLocation,
  IconAdjustmentsHorizontal,
  IconPlus,
  IconPencil,
  IconX,
  IconCalendarPlus,
  IconClockHour4,
  IconUser,
  IconUserCircle,
  IconSearch,
  IconChevronLeft,
} from '@tabler/icons-react'
import {
  scatterUsersAroundCenter,
  loadMapSettings,
  saveMapSettings,
  getDefaultSeedPlaces,
  getFallbackPlaces,
  PLACE_TYPES,
} from '../../utils/discoverMapData'
import {
  subscribeMapPlaces,
  createMapPlace,
  updateMapPlace,
  deleteMapPlace,
  seedMapPlaces,
} from '../../services/placesService'
import { isDurovAdmin } from '../../utils/appAdmin'
import { subscribeMeetupManager, subscribeMeetupsForPlace, joinMeetup } from '../../services/meetupService'
import {
  photoOverlayButtonClass,
  segmentedControlClass,
  segmentedItemClass,
  segmentedItemActiveClass,
  typoTitle3Class,
  typoHeadlineClass,
  typoSubheadClass,
  fieldLabelClass,
  pageSwitchMotion,
} from '../../utils/designSystem'
import Modal from '../ui/Modal'
import Button from '../ui/Button'
import ConfirmDialog from '../ui/ConfirmDialog'
import MapPlaceEditor from './MapPlaceEditor'
import CreateMeetupModal from './CreateMeetupModal'
import LoadingSpinner from '../ui/LoadingSpinner'
import { sad } from '../../assets'

function formatMeetupTime(ms) {
  if (!ms) return ''
  return new Date(ms).toLocaleString(undefined, {
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const DEFAULT_CENTER = [43.3178, 45.6949]
const PLACE_ZOOM = 16

const MAP_THEMES = [
  { id: 'dark', label: 'Dark', url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png' },
  { id: 'light', label: 'Light', url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png' },
  { id: 'voyager', label: 'Voyager', url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png' },
]

const mapSession = {
  located: false,
  userCenter: null,
  anchor: null,
  viewCenter: null,
  zoom: 14,
}

function MapRecenter({ center }) {
  const map = useMap()
  useEffect(() => {
    if (center) map.setView(center, map.getZoom(), { animate: true })
  }, [center, map])
  return null
}

function MapFlyTo({ target }) {
  const map = useMap()
  useEffect(() => {
    if (!target) return
    const { lat, lng, offsetY, offsetYRatio } = target
    const zoom = Math.max(map.getZoom(), PLACE_ZOOM)

    // Pre-compute the exact map center so the marker lands at desiredY from the top.
    // Default desiredY = mapHeight/2 → marker is vertically centered.
    const mapSize = map.getSize()
    const desiredY =
      typeof offsetY === 'number'
        ? offsetY
        : typeof offsetYRatio === 'number'
          ? mapSize.y * offsetYRatio
          : mapSize.y / 2
    const markerPixel = map.project([lat, lng], zoom)
    const centerPixel = L.point(markerPixel.x, markerPixel.y - desiredY + mapSize.y / 2)
    const centerLatLng = map.unproject(centerPixel, zoom)

    map.flyTo(centerLatLng, zoom, { duration: 0.6, easeLinearity: 0.5 })
  }, [target, map])
  return null
}

function MapStatePersistor() {
  useMapEvents({
    moveend: (e) => {
      const c = e.target.getCenter()
      mapSession.viewCenter = [c.lat, c.lng]
      mapSession.zoom = e.target.getZoom()
    },
    zoomend: (e) => {
      mapSession.zoom = e.target.getZoom()
    },
  })
  return null
}

function MapClickHandler({ addingPlace, onAddTap, onBackgroundClick }) {
  useMapEvents({
    click: (e) => {
      if (addingPlace) {
        onAddTap([e.latlng.lat, e.latlng.lng])
        return
      }
      // Marker clicks can bubble through some Leaflet/divIcon paths — don't treat those as map dismiss.
      const target = e.originalEvent?.target
      if (
        target instanceof Element &&
        target.closest(
          '.leaflet-marker-icon, .discover-map-place-pin, .discover-map-user-pin, .discover-map-you-pin'
        )
      ) {
        return
      }
      onBackgroundClick()
    },
  })
  return null
}

function MapFlyEndNotifier({ flyKey, onEnd }) {
  const map = useMap()
  useEffect(() => {
    if (!flyKey) return
    let finished = false
    const finish = () => {
      if (finished) return
      finished = true
      onEnd()
      map.off('moveend', finish)
    }
    map.on('moveend', finish)
    // flyTo to the current view may skip moveend — still open the card.
    const fallback = window.setTimeout(finish, 650)
    return () => {
      map.off('moveend', finish)
      window.clearTimeout(fallback)
    }
  }, [flyKey, map, onEnd])
  return null
}

function MapInteractionCloser({ onClose, disabled }) {
  useMapEvents({
    dragstart: () => {
      if (!disabled) onClose()
    },
    zoomstart: (e) => {
      if (!disabled && e.originalEvent) onClose()
    },
  })
  return null
}

const mapCardAnchorClass = 'absolute z-[1050] pointer-events-none left-1/2 -translate-x-1/2'
// Pin slightly above mid-screen; card hangs just under it so short cards stay close.
const MAP_FOCUS_PIN_OFFSET_RATIO = 0.32
const mapFocusCardAnchorStyle = {
  top: `calc(${MAP_FOCUS_PIN_OFFSET_RATIO * 100}% + 34px)`,
}

const mapCardMotion = {
  initial: { opacity: 0, scale: 0.94, y: 14 },
  animate: { opacity: 1, scale: 1, y: 0 },
  exit: { opacity: 0, scale: 0.96, y: 10, transition: pageSwitchMotion.exit.transition },
  transition: { type: 'spring', stiffness: 420, damping: 34, mass: 0.85 },
}

function createUserIcon(photoUrl) {
  const safeUrl = photoUrl.replace(/"/g, '&quot;')
  return L.divIcon({
    className: 'discover-map-user-marker',
    html: `<div class="discover-map-user-pin"><img src="${safeUrl}" alt="" /></div>`,
    iconSize: [44, 44],
    iconAnchor: [22, 22],
  })
}

function createPlaceIcon(emoji, name = '', selected = false, meetupCount = 0) {
  const safeName = String(name || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/"/g, '&quot;')
  const countBadge =
    meetupCount > 0
      ? `<span class="discover-map-place-count">${meetupCount > 9 ? '9+' : meetupCount}</span>`
      : ''
  return L.divIcon({
    className: 'discover-map-place-marker',
    html: `<div class="discover-map-place-anchor"><div class="discover-map-place-pin${selected ? ' is-selected' : ''}"><span class="discover-map-place-pin-emoji" aria-hidden="true">${emoji}</span><span class="discover-map-place-pin-title">${safeName}</span>${countBadge}</div></div>`,
    iconSize: [220, 44],
    iconAnchor: [110, 22],
  })
}

const youMarkerIcon = L.divIcon({
  className: 'discover-map-you-marker',
  html: '<div class="discover-map-you-pin"></div>',
  iconSize: [16, 16],
  iconAnchor: [8, 8],
})

function SegmentedField({ label, value, options, onChange }) {
  return (
    <div>
      <label className={fieldLabelClass}>{label}</label>
      <div className={segmentedControlClass}>
        {options.map((option) => (
          <button
            key={option.id}
            type="button"
            onClick={() => onChange(option.id)}
            className={value === option.id ? segmentedItemActiveClass : segmentedItemClass}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  )
}

function UserCard({ pin, onClose, onViewProfile }) {
  const { profile } = pin
  const name = profile?.displayName || profile?.name || `@${profile?.username || '?'}`
  const age = profile?.age
  const bio = profile?.bio
  const photo = pin.photo || profile?.photos?.[0] || null

  return (
    <motion.div
      className={mapCardAnchorClass}
      style={mapFocusCardAnchorStyle}
      {...mapCardMotion}
    >
      <div className="discover-map-place-card relative pointer-events-auto overflow-hidden">
        {/* Photo header */}
        <div className="relative h-32 bg-[var(--ios-fill-tertiary)]">
          {photo ? (
            <img src={photo} alt={name} className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <IconUserCircle size={48} stroke={1.2} className="text-[var(--ios-label-tertiary)]" />
            </div>
          )}
          <button
            type="button"
            onClick={onClose}
            className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center text-white"
            aria-label="Close"
          >
            <IconX size={14} stroke={2.5} />
          </button>
        </div>

        {/* Info */}
        <div className="p-3 space-y-3">
          <div>
            <p className={typoHeadlineClass}>
              {name}
              {age ? <span className="font-normal text-[var(--ios-label-secondary)]">, {age}</span> : null}
              {pin.isFriend && (
                <span className="ml-2 text-[13px] font-medium text-[var(--ios-blue)]">· Friend</span>
              )}
            </p>
            {bio && (
              <p className={`${typoSubheadClass} mt-1 line-clamp-2`}>{bio}</p>
            )}
          </div>

          <Button
            variant="filled"
            fullWidth
            onClick={() => onViewProfile?.(profile)}
          >
            <span className="inline-flex items-center gap-2">
              <IconUser size={16} stroke={2} />
              Open profile
            </span>
          </Button>
        </div>
      </div>
    </motion.div>
  )
}

function PlaceCard({ place, isAdmin, meetups, userId, onClose, onEdit, onCreateMeetup, onJoinMeetup }) {
  const [selectedSub, setSelectedSub] = useState(null)
  const [photoFailed, setPhotoFailed] = useState(false)
  const [showMeetups, setShowMeetups] = useState(false)
  const typeLabel = PLACE_TYPES.find((t) => t.id === place.type)?.label || 'Place'
  const subplaces = place.subplaces || []
  const photoUrl = place.photoUrl?.trim() || ''
  const hasMeetups = meetups.length > 0

  useEffect(() => {
    setSelectedSub(null)
    setPhotoFailed(false)
    setShowMeetups(false)
  }, [place.id, photoUrl])

  useEffect(() => {
    if (!hasMeetups) setShowMeetups(false)
  }, [hasMeetups])

  return (
    <motion.div
      className={mapCardAnchorClass}
      style={mapFocusCardAnchorStyle}
      {...mapCardMotion}
    >
      <div className="discover-map-place-card relative pointer-events-auto p-4 max-h-[60vh] overflow-y-auto">
        {showMeetups && hasMeetups ? (
          <>
            <div className="flex items-center justify-between gap-3 mb-3">
              <button
                type="button"
                onClick={() => setShowMeetups(false)}
                className="inline-flex items-center gap-1 text-[13px] text-[var(--ios-blue)] shrink-0"
              >
                <IconChevronLeft size={16} stroke={2} />
                Place
              </button>
              <p className="text-[13px] font-medium text-[var(--ios-label)] truncate">
                Meetups here · {meetups.length}
              </p>
              <button
                type="button"
                onClick={onClose}
                className="p-1 rounded-full text-[var(--ios-label-secondary)] hover:bg-white/10 shrink-0"
                aria-label="Close"
              >
                <IconX size={18} stroke={2} />
              </button>
            </div>

            <div className="space-y-2">
              {meetups.map((meetup) => {
                const isMember = meetup.participants?.includes(userId)
                const full = (meetup.participants?.length || 0) >= meetup.maxMembers
                return (
                  <div
                    key={meetup.id}
                    className="rounded-[var(--ios-radius-md)] border border-white/10 bg-white/[0.05] p-2.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-[14px] font-medium text-[var(--ios-label)] truncate">{meetup.title}</p>
                        <p className="text-[12px] text-[var(--ios-label-secondary)]">
                          {formatMeetupTime(meetup.startAt)} · {meetup.participants?.length || 0}/{meetup.maxMembers}
                          {meetup.privacy === 'friends' ? ' · Friends' : ''}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => onJoinMeetup(meetup)}
                        disabled={full && !isMember}
                        className="shrink-0 px-3 py-1.5 rounded-full text-[13px] font-medium bg-[var(--ios-blue)] text-white disabled:opacity-50"
                      >
                        {isMember ? 'Open' : full ? 'Full' : 'Join'}
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </>
        ) : (
          <>
            <div className="flex items-start gap-3">
              <div className="w-11 h-11 rounded-full bg-[var(--ios-fill-tertiary)] border border-white/10 flex items-center justify-center text-2xl shrink-0">
                {place.emoji}
              </div>
              <div className="min-w-0 flex-1">
                <p className={typoHeadlineClass}>{place.name}</p>
                <p className={`${typoSubheadClass} mt-0.5`}>
                  {selectedSub ? `${typeLabel} · ${selectedSub.name}` : typeLabel}
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="p-1 rounded-full text-[var(--ios-label-secondary)] hover:bg-white/10 shrink-0"
                aria-label="Close"
              >
                <IconX size={18} stroke={2} />
              </button>
            </div>

            {subplaces.length > 0 && (
              <div className="mt-3">
                <p className="text-[11px] uppercase tracking-wide text-[var(--ios-label-tertiary)] mb-1.5">
                  Choose a spot
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {subplaces.map((sub) => (
                    <button
                      key={sub.id}
                      type="button"
                      onClick={() => setSelectedSub((cur) => (cur?.id === sub.id ? null : sub))}
                      className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full text-[13px] border transition-colors ${
                        selectedSub?.id === sub.id
                          ? 'border-[var(--ios-blue)] bg-[var(--ios-blue)]/15 text-[var(--ios-label)]'
                          : 'border-white/10 bg-white/[0.06] text-[var(--ios-label-secondary)]'
                      }`}
                    >
                      <span>{sub.emoji}</span>
                      <span className="truncate max-w-[8rem]">{sub.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {photoUrl && !photoFailed ? (
              <div className="mt-4 rounded-[var(--ios-radius-md)] overflow-hidden border border-white/10">
                <img
                  src={photoUrl}
                  alt=""
                  className="w-full aspect-[16/10] object-cover"
                  onError={() => setPhotoFailed(true)}
                />
              </div>
            ) : null}

            <Button
              variant="filled"
              fullWidth
              className="mt-4"
              onClick={() => onCreateMeetup(selectedSub)}
            >
              <span className="inline-flex items-center gap-2">
                <IconCalendarPlus size={16} stroke={2} />
                Create meetup
              </span>
            </Button>

            {isAdmin && (
              <Button variant="bordered" fullWidth className="mt-3" onClick={() => onEdit(place)}>
                <span className="inline-flex items-center gap-2">
                  <IconPencil size={16} stroke={2} />
                  Edit place
                </span>
              </Button>
            )}

            {hasMeetups ? (
              <button
                type="button"
                onClick={() => setShowMeetups(true)}
                className="mt-3 w-full text-center text-[12px] font-medium text-[var(--ios-blue)] transition-colors"
              >
                Meetups here · {meetups.length}
              </button>
            ) : null}
          </>
        )}
      </div>
    </motion.div>
  )
}

function MeetupManagerCard({ meetup, isMember, onAction }) {
  const members = meetup.participants?.length || 0
  const maxMembers = meetup.maxMembers || 0
  const full = maxMembers > 0 && members >= maxMembers
  const venue = meetup.subplaceName
    ? `${meetup.placeName} · ${meetup.subplaceName}`
    : meetup.placeName || 'Place'

  return (
    <div className="rounded-[var(--ios-radius-md)] border border-white/10 bg-white/[0.05] p-2.5">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[14px] font-medium text-[var(--ios-label)] truncate">{meetup.title}</p>
          <p className="text-[12px] text-[var(--ios-label-secondary)] truncate">
            {venue} · {formatMeetupTime(meetup.startAt)} · {members}/{maxMembers || members}
            {meetup.privacy === 'friends' ? ' · Friends' : ''}
          </p>
        </div>
        <button
          type="button"
          onClick={() => onAction(meetup)}
          disabled={full && !isMember}
          className="shrink-0 px-3 py-1.5 rounded-full text-[13px] font-medium bg-[var(--ios-blue)] text-white disabled:opacity-50"
        >
          {isMember ? 'Open' : full ? 'Full' : 'Join'}
        </button>
      </div>
    </div>
  )
}

function MeetupManager({
  myMeetups,
  availableMeetups,
  places,
  expanded,
  onExpandedChange,
  onOpenMeetupChat,
  onSelectPlace,
  onBeforeExpand,
}) {
  const myCount = myMeetups.length
  const availCount = availableMeetups.length
  const [placeSearchQuery, setPlaceSearchQuery] = useState('')
  const [searchActive, setSearchActive] = useState(false)
  const [joinTarget, setJoinTarget] = useState(null)
  const [joining, setJoining] = useState(false)

  useEffect(() => {
    if (!expanded) {
      setPlaceSearchQuery('')
      setSearchActive(false)
      if (!joining) setJoinTarget(null)
    }
  }, [expanded, joining])

  useEffect(() => {
    if (!joinTarget) return
    if (!availableMeetups.some((meetup) => meetup.id === joinTarget.id)) {
      setJoinTarget(null)
    }
  }, [availableMeetups, joinTarget])

  const handleExpand = () => {
    onBeforeExpand?.()
    onExpandedChange(true)
  }

  const showSearchBar = searchActive || placeSearchQuery.length > 0
  const isSearching = placeSearchQuery.trim().length > 0

  const matchingPlaces = useMemo(() => {
    const q = placeSearchQuery.trim().toLowerCase()
    if (!q) return []
    return places.filter((place) => {
      if (place.name?.toLowerCase().includes(q)) return true
      return (place.subplaces || []).some((sub) => sub.name?.toLowerCase().includes(q))
    })
  }, [places, placeSearchQuery])

  const handleSearchBlur = () => {
    if (!placeSearchQuery.trim()) setSearchActive(false)
  }

  const handleSelectPlace = (place) => {
    setPlaceSearchQuery('')
    setSearchActive(false)
    onSelectPlace?.(place)
  }

  const handleConfirmJoin = async () => {
    if (!joinTarget || joining) return
    setJoining(true)
    try {
      await onOpenMeetupChat(joinTarget)
      setJoinTarget(null)
    } finally {
      setJoining(false)
    }
  }

  const panelChromeClass =
    'w-full rounded-[var(--ios-radius-lg)] border border-[var(--ios-separator)] bg-[var(--ios-bg-secondary)]/95 backdrop-blur-md shadow-[0_10px_26px_rgba(0,0,0,0.35)]'
  const headerSlotClass = 'relative h-10 w-full'

  return (
    <div className="relative w-full pointer-events-auto">
      <AnimatePresence mode="wait" initial={false}>
        {!expanded ? (
          <motion.button
            key="meetups-collapsed"
            type="button"
            onClick={handleExpand}
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
            className="w-full h-12 rounded-full border border-[var(--ios-separator)] bg-[var(--ios-bg-secondary)]/95 backdrop-blur-md px-4 py-0 flex items-center justify-between gap-3"
            aria-label="Open meetups manager"
          >
            <div className="flex items-center gap-2 min-w-0">
              <IconCalendarPlus size={18} stroke={2} className="text-[var(--ios-blue)] shrink-0" />
              <p className="text-[13px] font-medium text-[var(--ios-label)] truncate">Meetups</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="min-w-[22px] h-6 px-2 rounded-full bg-[var(--ios-blue)] text-white text-[12px] font-semibold flex items-center justify-center">
                {myCount}
              </span>
              <span className="min-w-[22px] h-6 px-2 rounded-full bg-white/[0.08] border border-white/10 text-white text-[12px] font-semibold flex items-center justify-center">
                {availCount}
              </span>
            </div>
          </motion.button>
        ) : (
          <motion.div
            key="meetups-expanded"
            initial={{ opacity: 0, y: -8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.98 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            className={`${panelChromeClass} p-3`}
          >
            <div className={`${headerSlotClass} mb-2`}>
              <AnimatePresence mode="wait" initial={false}>
                {showSearchBar ? (
                  <motion.div
                    key="search"
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.15, ease: [0.22, 1, 0.36, 1] }}
                    className="absolute inset-0 flex items-center gap-1.5"
                  >
                    <div className="flex-1 min-w-0 flex items-center gap-2 rounded-full border border-[var(--ios-separator)] bg-[var(--ios-fill-tertiary)] px-3 h-10">
                      <IconSearch size={16} stroke={2} className="text-[var(--ios-label-tertiary)] shrink-0" />
                      <input
                        type="search"
                        value={placeSearchQuery}
                        onChange={(e) => setPlaceSearchQuery(e.target.value)}
                        onBlur={handleSearchBlur}
                        autoFocus={searchActive}
                        placeholder="Find a place…"
                        className="flex-1 min-w-0 bg-transparent text-[15px] text-[var(--ios-label)] placeholder:text-[var(--ios-label-tertiary)] outline-none"
                        aria-label="Search places"
                      />
                      {placeSearchQuery ? (
                        <button
                          type="button"
                          onClick={() => {
                            setPlaceSearchQuery('')
                            setSearchActive(false)
                          }}
                          className="p-0.5 rounded-full text-[var(--ios-label-secondary)] hover:bg-white/10"
                          aria-label="Clear search"
                        >
                          <IconX size={14} stroke={2} />
                        </button>
                      ) : null}
                    </div>
                    <button
                      type="button"
                      onClick={() => onExpandedChange(false)}
                      className="shrink-0 p-1 rounded-full text-[var(--ios-label-secondary)] hover:bg-white/10"
                      aria-label="Close meetups manager"
                    >
                      <IconX size={18} stroke={2} />
                    </button>
                  </motion.div>
                ) : (
                  <motion.div
                    key="header"
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.15, ease: [0.22, 1, 0.36, 1] }}
                    className="absolute inset-0 flex items-center justify-between gap-3"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <IconCalendarPlus size={18} stroke={2} className="text-[var(--ios-blue)] shrink-0" />
                      <p className="text-[13px] font-medium text-[var(--ios-label)] truncate">Meetups manager</p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => setSearchActive(true)}
                        className="p-1 rounded-full text-[var(--ios-label-secondary)] hover:bg-white/10"
                        aria-label="Search places"
                      >
                        <IconSearch size={18} stroke={2} />
                      </button>
                      <button
                        type="button"
                        onClick={() => onExpandedChange(false)}
                        className="p-1 rounded-full text-[var(--ios-label-secondary)] hover:bg-white/10"
                        aria-label="Close meetups manager"
                      >
                        <IconX size={18} stroke={2} />
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

          {isSearching ? (
            <div className="max-h-52 overflow-y-auto space-y-1">
              {matchingPlaces.length === 0 ? (
                <p className="text-[13px] text-[var(--ios-label-secondary)] py-2">No places found</p>
              ) : (
                matchingPlaces.map((place) => (
                  <button
                    key={place.id}
                    type="button"
                    onClick={() => handleSelectPlace(place)}
                    className="w-full flex items-center gap-3 rounded-[var(--ios-radius-md)] px-2 py-2 text-left hover:bg-white/[0.06] transition-colors"
                  >
                    <span className="w-9 h-9 rounded-full bg-[var(--ios-fill-tertiary)] border border-white/10 flex items-center justify-center text-lg shrink-0">
                      {place.emoji}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className={`${typoHeadlineClass} text-[15px] truncate`}>{place.name}</p>
                      <p className={`${typoSubheadClass} text-[13px] truncate`}>
                        {PLACE_TYPES.find((t) => t.id === place.type)?.label || 'Place'}
                      </p>
                    </div>
                  </button>
                ))
              )}
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <p className="text-[11px] uppercase tracking-wide text-[var(--ios-label-tertiary)] mb-1.5 inline-flex items-center gap-2">
                  <IconClockHour4 size={14} stroke={2} className="text-amber-300" />
                  Your meetups
                </p>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {myMeetups.length === 0 ? (
                    <p className="text-[13px] text-[var(--ios-label-secondary)]">No active meetups</p>
                  ) : (
                    myMeetups.map((meetup) => (
                      <MeetupManagerCard
                        key={meetup.id}
                        meetup={meetup}
                        isMember
                        onAction={() => onOpenMeetupChat(meetup)}
                      />
                    ))
                  )}
                </div>
              </div>

              <div>
                <p className="text-[11px] uppercase tracking-wide text-[var(--ios-label-tertiary)] mb-1.5">
                  Available meetups
                </p>
                <div className="space-y-2 max-h-40 overflow-y-auto">
                  {availableMeetups.length === 0 ? (
                    <p className="text-[13px] text-[var(--ios-label-secondary)]">No meetups nearby</p>
                  ) : (
                    availableMeetups.slice(0, 16).map((meetup) => (
                      <MeetupManagerCard
                        key={meetup.id}
                        meetup={meetup}
                        isMember={false}
                        onAction={() => setJoinTarget(meetup)}
                      />
                    ))
                  )}
                </div>
              </div>
            </div>
          )}
          </motion.div>
        )}
      </AnimatePresence>

      <ConfirmDialog
        isOpen={Boolean(joinTarget)}
        onClose={() => !joining && setJoinTarget(null)}
        onConfirm={handleConfirmJoin}
        title="Join this meetup?"
        message={
          joinTarget
            ? `Join "${joinTarget.title}" at ${joinTarget.placeName || 'the meetup spot'}? You'll be added to the group chat.`
            : 'Join this meetup and enter the group chat?'
        }
        confirmLabel="Join"
        loading={joining}
        overlayClassName="z-[1200]"
      />
    </div>
  )
}

export default function DiscoverMap({
  profiles,
  friendIds,
  profile,
  userId,
  onViewProfile,
  onOpenChat,
  onExitMap,
  chromeHidden = false,
}) {
  const [center, setCenter] = useState(mapSession.located ? mapSession.viewCenter : null)
  const [userCenter, setUserCenter] = useState(mapSession.located ? mapSession.userCenter : null)
  const [anchor, setAnchor] = useState(mapSession.located ? mapSession.anchor : null)
  const [loading, setLoading] = useState(!mapSession.located)
  const [settings, setSettings] = useState(loadMapSettings)
  const [showSettings, setShowSettings] = useState(false)
  const [places, setPlaces] = useState([])
  const [placesReady, setPlacesReady] = useState(false)
  const [selectedPlace, setSelectedPlace] = useState(null)
  const [selectedUserPin, setSelectedUserPin] = useState(null)
  const [flyTarget, setFlyTarget] = useState(null)
  const [visibleCardKey, setVisibleCardKey] = useState(null)
  const visibleCardKeyRef = useRef(null)
  const selectedUserPinRef = useRef(null)
  const selectedPlaceRef = useRef(null)
  const [editorPlace, setEditorPlace] = useState(null)
  const [addingPlace, setAddingPlace] = useState(false)
  const [meetups, setMeetups] = useState([])
  const [meetupDraft, setMeetupDraft] = useState(null)
  const [myMeetups, setMyMeetups] = useState([])
  const [availableMeetups, setAvailableMeetups] = useState([])
  const [placeMeetupCounts, setPlaceMeetupCounts] = useState({})
  const [meetupManagerExpanded, setMeetupManagerExpanded] = useState(false)

  const isAdmin = isDurovAdmin(profile)
  const theme = MAP_THEMES.find((t) => t.id === settings.theme) || MAP_THEMES[0]
  const overlayOpen =
    showSettings ||
    !!editorPlace ||
    !!selectedPlace ||
    !!selectedUserPin ||
    addingPlace ||
    !!meetupDraft ||
    meetupManagerExpanded ||
    chromeHidden

  visibleCardKeyRef.current = visibleCardKey
  selectedUserPinRef.current = selectedUserPin
  selectedPlaceRef.current = selectedPlace

  const dismissMapSelection = useCallback(() => {
    setVisibleCardKey(null)
    setSelectedPlace(null)
    setSelectedUserPin(null)
    setMeetupManagerExpanded(false)
  }, [])

  const handleChromeClose = useCallback(() => {
    if (meetupDraft) {
      setMeetupDraft(null)
      return
    }
    if (editorPlace) {
      setEditorPlace(null)
      return
    }
    if (showSettings) {
      setShowSettings(false)
      return
    }
    if (addingPlace) {
      setAddingPlace(false)
      return
    }
    if (visibleCardKey || selectedPlace || selectedUserPin) {
      dismissMapSelection()
      return
    }
    onExitMap?.()
  }, [
    meetupDraft,
    editorPlace,
    showSettings,
    addingPlace,
    visibleCardKey,
    selectedPlace,
    selectedUserPin,
    dismissMapSelection,
    onExitMap,
  ])

  const chromeCloseLabel =
    meetupDraft || editorPlace || showSettings || addingPlace || visibleCardKey
      ? 'Close'
      : 'Exit map mode'

  const handleMapCardExitComplete = useCallback(() => {
    // Keep a pending place/user selection while the map flies to the next pin.
    if (visibleCardKeyRef.current !== null) return
    if (selectedPlaceRef.current || selectedUserPinRef.current) return
    setSelectedPlace(null)
    setSelectedUserPin(null)
  }, [])

  const handleFlyEnd = useCallback(() => {
    if (selectedUserPinRef.current) {
      setVisibleCardKey(`user:${selectedUserPinRef.current.id}`)
    } else if (selectedPlaceRef.current) {
      setVisibleCardKey(`place:${selectedPlaceRef.current.id}`)
    }
  }, [])

  const handleOpenProfile = useCallback(
    (userProfile) => {
      dismissMapSelection()
      onViewProfile?.(userProfile)
    },
    [dismissMapSelection, onViewProfile]
  )

  const updateSettings = (patch) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch }
      saveMapSettings(next)
      return next
    })
  }

  useEffect(() => {
    if (mapSession.located) return

    mapSession.located = true
    mapSession.userCenter = DEFAULT_CENTER
    mapSession.anchor = DEFAULT_CENTER
    mapSession.viewCenter = DEFAULT_CENTER
    setUserCenter(DEFAULT_CENTER)
    setAnchor(DEFAULT_CENTER)
    setCenter(DEFAULT_CENTER)
    setLoading(false)
  }, [])

  useEffect(() => {
    return subscribeMapPlaces(
      (nextPlaces) => {
        setPlaces(nextPlaces)
        setPlacesReady(true)
      },
      () => {
        setPlacesReady(true)
        toast.error('Could not load map places')
      }
    )
  }, [])

  useEffect(() => {
    if (!placesReady || !isAdmin || !anchor || places.length > 0) return
    seedMapPlaces(getDefaultSeedPlaces(anchor), userId).catch(() => {
      toast.error('Could not seed default places')
    })
  }, [placesReady, isAdmin, anchor, places.length, userId])

  useEffect(() => {
    if (!selectedPlace || selectedPlace.isLocal) return
    const fresh = places.find((p) => p.id === selectedPlace.id)
    if (fresh && fresh !== selectedPlace) setSelectedPlace(fresh)
    else if (!fresh) {
      setSelectedPlace(null)
      setVisibleCardKey(null)
    }
  }, [places, selectedPlace])

  const displayPlaces = useMemo(() => {
    if (places.length > 0) return places
    if (placesReady && anchor) return getFallbackPlaces(anchor)
    return []
  }, [places, placesReady, anchor])

  useEffect(() => {
    if (!selectedPlace) {
      setMeetups([])
      return
    }
    return subscribeMeetupsForPlace(selectedPlace.id, setMeetups, () => setMeetups([]))
  }, [selectedPlace?.id])

  useEffect(() => {
    return subscribeMeetupManager(
      userId,
      friendIds,
      ({ myMeetups: mine, availableMeetups: available, placeCounts }) => {
        setMyMeetups(mine)
        setAvailableMeetups(available)
        setPlaceMeetupCounts(placeCounts)
      },
      () => {
        setMyMeetups([])
        setAvailableMeetups([])
        setPlaceMeetupCounts({})
      }
    )
  }, [userId, friendIds])

  // Always scatter users near Grozny city center so real users appear on the map
  // regardless of where the current device is located.
  const userPins = useMemo(
    () => scatterUsersAroundCenter(DEFAULT_CENTER, profiles, friendIds),
    [profiles, friendIds]
  )

  const showUsers = settings.display !== 'places'
  const showPlaces = settings.display !== 'users'

  const visibleUserPins = useMemo(
    () => (settings.show === 'friends' ? userPins.filter((pin) => pin.isFriend) : userPins),
    [userPins, settings.show]
  )

  const handleRecenter = () => {
    if (userCenter) setCenter([...userCenter])
  }

  const handleUserPinClick = (pin) => {
    setAddingPlace(false)
    setMeetupManagerExpanded(false)
    setSelectedPlace(null)
    setVisibleCardKey(null)
    setSelectedUserPin(pin)
    setFlyTarget({
      lat: pin.position[0],
      lng: pin.position[1],
      offsetYRatio: MAP_FOCUS_PIN_OFFSET_RATIO,
      ts: Date.now(),
    })
  }

  const handlePlaceClick = (place) => {
    if (!place) return
    setAddingPlace(false)
    setMeetupManagerExpanded(false)
    setSelectedUserPin(null)
    setVisibleCardKey(null)
    setSelectedPlace(place)
    setFlyTarget({
      lat: place.lat,
      lng: place.lng,
      offsetYRatio: MAP_FOCUS_PIN_OFFSET_RATIO,
      ts: Date.now(),
    })
  }

  const handleSelectPlaceFromSearch = (place) => {
    setMeetupManagerExpanded(false)
    handlePlaceClick(place)
  }

  const handleMapTapForPlace = (coords) => {
    if (!addingPlace) return
    setAddingPlace(false)
    setSelectedPlace(null)
    setVisibleCardKey(null)
    setEditorPlace({ lat: coords[0], lng: coords[1], name: '', emoji: '📍', type: 'other', subplaces: [] })
  }

  const handleSavePlace = async (data) => {
    try {
      if (editorPlace?.id) {
        await updateMapPlace(editorPlace.id, data)
        toast.success('Place updated')
      } else {
        await createMapPlace({ ...data, lat: editorPlace.lat, lng: editorPlace.lng }, userId)
        toast.success('Place created')
      }
      setEditorPlace(null)
    } catch {
      toast.error('Failed to save place')
    }
  }

  const handleDeletePlace = async () => {
    if (!editorPlace?.id) return
    try {
      await deleteMapPlace(editorPlace.id)
      toast.success('Place deleted')
      setEditorPlace(null)
      setSelectedPlace(null)
      setVisibleCardKey(null)
    } catch {
      toast.error('Failed to delete place')
    }
  }

  const handleCreateMeetup = (subplace) => {
    if (!selectedPlace) return
    setMeetupDraft({ place: selectedPlace, subplace: subplace || null })
  }

  const handleJoinMeetup = async (meetup) => {
    if (meetup.participants?.includes(userId)) {
      onOpenChat?.(meetup.chatId)
      return
    }
    try {
      const { chatId } = await joinMeetup(meetup.id, userId)
      toast.success('Joined meetup!')
      onOpenChat?.(chatId)
    } catch (err) {
      toast.error(err.message || 'Could not join meetup')
    }
  }

  const handleOpenMeetupFromManager = async (meetup) => {
    if (meetup.participants?.includes(userId)) {
      onOpenChat?.(meetup.chatId)
      return
    }
    await handleJoinMeetup(meetup)
  }

  if (loading || !center) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-0">
        <LoadingSpinner />
      </div>
    )
  }

  return (
    <div className={`flex-1 min-h-0 relative discover-map-container${addingPlace ? ' discover-map-placing' : ''}`}>
      <MapContainer
        center={center}
        zoom={mapSession.zoom}
        minZoom={11}
        maxZoom={18}
        zoomControl={false}
        attributionControl={false}
        zoomSnap={0.25}
        zoomDelta={0.5}
        wheelPxPerZoomLevel={120}
        zoomAnimation
        fadeAnimation
        markerZoomAnimation={false}
        inertia
        inertiaDeceleration={2500}
        className="h-full w-full discover-map-leaflet"
      >
        <MapRecenter center={center} />
        <MapFlyTo target={flyTarget} />
        <MapFlyEndNotifier flyKey={flyTarget?.ts} onEnd={handleFlyEnd} />
        <MapInteractionCloser onClose={dismissMapSelection} disabled={!visibleCardKey} />
        <MapStatePersistor />
        <MapClickHandler
          addingPlace={addingPlace}
          onAddTap={handleMapTapForPlace}
          onBackgroundClick={dismissMapSelection}
        />
        <TileLayer key={theme.id} url={theme.url} />

        {userCenter && <Marker position={userCenter} icon={youMarkerIcon} />}

        {showUsers &&
          visibleUserPins.map((pin) => (
            <Marker
              key={pin.id}
              position={pin.position}
              icon={createUserIcon(pin.photo || sad)}
              eventHandlers={{
                click: (e) => {
                  if (e.originalEvent) L.DomEvent.stopPropagation(e.originalEvent)
                  handleUserPinClick(pin)
                },
              }}
            />
          ))}

        {showPlaces &&
          displayPlaces.map((place) => (
            <Marker
              key={place.id}
              position={[place.lat, place.lng]}
              icon={createPlaceIcon(
                place.emoji,
                place.name,
                selectedPlace?.id === place.id,
                placeMeetupCounts[place.id] || 0
              )}
              eventHandlers={{
                click: (e) => {
                  if (e.originalEvent) L.DomEvent.stopPropagation(e.originalEvent)
                  handlePlaceClick(place)
                },
              }}
            />
          ))}
      </MapContainer>

      {!chromeHidden && (
        <div className="absolute top-3 left-3 right-3 z-[1100] flex items-start gap-2 pointer-events-none">
          {!meetupDraft && !editorPlace && !showSettings && !addingPlace ? (
            <div className="flex-1 min-w-0 pointer-events-auto">
              <MeetupManager
                myMeetups={myMeetups}
                availableMeetups={availableMeetups}
                places={displayPlaces}
                expanded={meetupManagerExpanded}
                onExpandedChange={setMeetupManagerExpanded}
                onOpenMeetupChat={handleOpenMeetupFromManager}
                onSelectPlace={handleSelectPlaceFromSearch}
                onBeforeExpand={dismissMapSelection}
              />
            </div>
          ) : (
            <div className="flex-1 min-w-0" />
          )}

          {!meetupManagerExpanded && onExitMap && (
            <button
              type="button"
              onClick={handleChromeClose}
              className="pointer-events-auto shrink-0 h-12 w-12 rounded-full border border-[var(--ios-separator)] bg-[var(--ios-bg-secondary)]/95 backdrop-blur-md text-[var(--ios-label)] flex items-center justify-center"
              aria-label={chromeCloseLabel}
            >
              <IconX size={20} stroke={2} />
            </button>
          )}
        </div>
      )}

      {!chromeHidden && meetupManagerExpanded && (
        <button
          type="button"
          className="absolute inset-0 z-[900] cursor-default"
          onClick={() => setMeetupManagerExpanded(false)}
          aria-label="Close meetups manager"
        />
      )}

      {addingPlace && (
        <div className="absolute top-3 left-3 right-16 z-[1100] pointer-events-none">
          <div className="rounded-[var(--ios-radius-lg)] border border-[var(--ios-separator)] bg-[var(--ios-bg-secondary)] px-4 py-3 text-center shadow-lg pointer-events-auto">
            <p className="text-sm font-medium text-[var(--ios-label)]">Tap the map to place a new spot</p>
            <button
              type="button"
              onClick={() => setAddingPlace(false)}
              className="mt-2 text-sm text-[var(--ios-blue)]"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {!editorPlace && !meetupDraft && !chromeHidden && (
        <AnimatePresence mode="wait" onExitComplete={handleMapCardExitComplete}>
          {visibleCardKey?.startsWith('user:') && selectedUserPin && (
            <UserCard
              key={visibleCardKey}
              pin={selectedUserPin}
              onClose={dismissMapSelection}
              onViewProfile={handleOpenProfile}
            />
          )}
          {visibleCardKey?.startsWith('place:') && selectedPlace && (
            <PlaceCard
              key={visibleCardKey}
              place={selectedPlace}
              isAdmin={isAdmin}
              meetups={meetups}
              userId={userId}
              onClose={dismissMapSelection}
              onEdit={(place) => {
                setVisibleCardKey(null)
                setSelectedPlace(null)
                setEditorPlace(place)
              }}
              onCreateMeetup={handleCreateMeetup}
              onJoinMeetup={handleJoinMeetup}
            />
          )}
        </AnimatePresence>
      )}

      {!overlayOpen && !chromeHidden && (
        <div className="absolute bottom-4 right-4 z-[1000] flex flex-col gap-3">
          {isAdmin && (
            <button
              type="button"
              onClick={() => {
                setAddingPlace(true)
                setSelectedPlace(null)
                setVisibleCardKey(null)
              }}
              className={photoOverlayButtonClass}
              aria-label="Add place"
            >
              <IconPlus size={22} stroke={2} />
            </button>
          )}
          <button
            type="button"
            onClick={() => setShowSettings(true)}
            className={photoOverlayButtonClass}
            aria-label="Map settings"
          >
            <IconAdjustmentsHorizontal size={22} stroke={2} />
          </button>
          <button
            type="button"
            onClick={handleRecenter}
            className={photoOverlayButtonClass}
            aria-label="Recenter map"
          >
            <IconCurrentLocation size={22} stroke={2} />
          </button>
        </div>
      )}

      <Modal isOpen={showSettings} onClose={() => setShowSettings(false)} className="p-6">
        <div className="flex items-center justify-between gap-3 mb-5">
          <h3 className={typoTitle3Class}>Map settings</h3>
          <button
            type="button"
            onClick={() => setShowSettings(false)}
            className="p-1 rounded-full text-[var(--ios-label-secondary)] hover:bg-white/10"
            aria-label="Close map settings"
          >
            <IconX size={20} stroke={2} />
          </button>
        </div>
        <div className="space-y-5">
          <SegmentedField
            label="Display"
            value={settings.display}
            onChange={(display) => updateSettings({ display })}
            options={[
              { id: 'users', label: 'Users' },
              { id: 'places', label: 'Places' },
              { id: 'both', label: 'Both' },
            ]}
          />
          <SegmentedField
            label="Show"
            value={settings.show}
            onChange={(show) => updateSettings({ show })}
            options={[
              { id: 'everyone', label: 'Everyone' },
              { id: 'friends', label: 'Friends only' },
            ]}
          />
          <SegmentedField
            label="Theme"
            value={settings.theme}
            onChange={(themeId) => updateSettings({ theme: themeId })}
            options={MAP_THEMES.map((t) => ({ id: t.id, label: t.label }))}
          />
        </div>
      </Modal>

      <MapPlaceEditor
        isOpen={!!editorPlace}
        place={editorPlace}
        onClose={() => setEditorPlace(null)}
        onSave={handleSavePlace}
        onDelete={handleDeletePlace}
      />

      <CreateMeetupModal
        isOpen={!!meetupDraft}
        place={meetupDraft?.place}
        subplace={meetupDraft?.subplace}
        userId={userId}
        username={profile?.username}
        creatorGender={profile?.gender}
        onClose={() => setMeetupDraft(null)}
        onCreated={(meetup) => {
          setMeetupDraft(null)
          setSelectedPlace(null)
          setVisibleCardKey(null)
          onOpenChat?.(meetup.chatId)
        }}
      />
    </div>
  )
}
