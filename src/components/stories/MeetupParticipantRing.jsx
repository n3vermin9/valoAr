import { IconUsers } from '@tabler/icons-react'

const RING_SIZE = 58
const CENTER = RING_SIZE / 2
const RING_RADIUS = 23
const RING_STROKE = 6
const SEGMENT_GAP_DEG = 4

function segmentTypeForUser(profile) {
  if (!profile) return 'empty'
  if (profile.gender === 'male') return 'male'
  if (profile.gender === 'female') return 'female'
  return 'unknown'
}

function segmentColor(type) {
  if (type === 'male') return '#0A84FF'
  if (type === 'female') return '#FF2D55'
  if (type === 'unknown') return '#AEAEB2'
  return '#48484A'
}

function segmentGlow(type) {
  if (type === 'male') return 'rgba(10,132,255,0.55)'
  if (type === 'female') return 'rgba(255,45,85,0.55)'
  if (type === 'unknown') return 'rgba(174,174,178,0.45)'
  return 'rgba(72,72,74,0.45)'
}

function describeRingSegment(index, total) {
  const sweep = 360 / total - SEGMENT_GAP_DEG
  const start = index * (360 / total) + SEGMENT_GAP_DEG / 2 - 90
  const outerR = RING_RADIUS + RING_STROKE / 2
  const innerR = RING_RADIUS - RING_STROKE / 2

  const toXY = (angle, radius) => {
    const rad = (angle * Math.PI) / 180
    return [CENTER + radius * Math.cos(rad), CENTER + radius * Math.sin(rad)]
  }

  const [x1, y1] = toXY(start, outerR)
  const [x2, y2] = toXY(start + sweep, outerR)
  const [x3, y3] = toXY(start + sweep, innerR)
  const [x4, y4] = toXY(start, innerR)
  const largeArc = sweep > 180 ? 1 : 0

  return `M ${x1} ${y1} A ${outerR} ${outerR} 0 ${largeArc} 1 ${x2} ${y2} L ${x3} ${y3} A ${innerR} ${innerR} 0 ${largeArc} 0 ${x4} ${y4} Z`
}

export default function MeetupParticipantRing({
  maxMembers = 10,
  participants = [],
  participantProfiles = {},
  className = '',
}) {
  const slotCount = Math.max(2, Math.min(10, Number(maxMembers) || 10))
  const segments = Array.from({ length: slotCount }, (_, index) => {
    const userId = participants[index]
    if (!userId) return 'empty'
    return segmentTypeForUser(participantProfiles[userId])
  })

  return (
    <div
      className={`relative shrink-0 drop-shadow-[0_3px_10px_rgba(0,0,0,0.6)] ${className}`}
      style={{ width: RING_SIZE, height: RING_SIZE }}
      aria-hidden
    >
      <svg width={RING_SIZE} height={RING_SIZE} viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`}>
        <circle
          cx={CENTER}
          cy={CENTER}
          r={RING_RADIUS}
          fill="none"
          stroke="rgba(0,0,0,0.55)"
          strokeWidth={RING_STROKE + 2}
        />
        {segments.map((type, index) => (
          <path
            key={index}
            d={describeRingSegment(index, slotCount)}
            fill={segmentColor(type)}
            stroke="rgba(255,255,255,0.35)"
            strokeWidth="0.75"
            style={{ filter: `drop-shadow(0 0 3px ${segmentGlow(type)})` }}
          />
        ))}
      </svg>

      <div className="absolute inset-[9px] flex items-center justify-center rounded-full border-2 border-orange-500 bg-white shadow-[0_1px_8px_rgba(0,0,0,0.35)]">
        <IconUsers size={20} stroke={2.25} className="text-orange-600" />
      </div>
    </div>
  )
}
