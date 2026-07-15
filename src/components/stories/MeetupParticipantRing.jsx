import { IconUsers } from '@tabler/icons-react'

const SIZES = {
  md: { ring: 58, radius: 23, stroke: 6, inset: 9, icon: 20 },
  sm: { ring: 44, radius: 17, stroke: 5, inset: 7, icon: 15 },
}

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

function describeRingSegment(index, total, center, radius, stroke) {
  const sweep = 360 / total - SEGMENT_GAP_DEG
  const start = index * (360 / total) + SEGMENT_GAP_DEG / 2 - 90
  const outerR = radius + stroke / 2
  const innerR = radius - stroke / 2

  const toXY = (angle, r) => {
    const rad = (angle * Math.PI) / 180
    return [center + r * Math.cos(rad), center + r * Math.sin(rad)]
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
  size = 'md',
  className = '',
}) {
  const metrics = SIZES[size] || SIZES.md
  const center = metrics.ring / 2
  const slotCount = Math.max(2, Math.min(10, Number(maxMembers) || 10))
  const segments = Array.from({ length: slotCount }, (_, index) => {
    const userId = participants[index]
    if (!userId) return 'empty'
    return segmentTypeForUser(participantProfiles[userId])
  })

  return (
    <div
      className={`relative shrink-0 drop-shadow-[0_3px_10px_rgba(0,0,0,0.6)] ${className}`}
      style={{ width: metrics.ring, height: metrics.ring }}
      aria-hidden
    >
      <svg
        width={metrics.ring}
        height={metrics.ring}
        viewBox={`0 0 ${metrics.ring} ${metrics.ring}`}
      >
        <circle
          cx={center}
          cy={center}
          r={metrics.radius}
          fill="none"
          stroke="rgba(0,0,0,0.55)"
          strokeWidth={metrics.stroke + 2}
        />
        {segments.map((type, index) => (
          <path
            key={index}
            d={describeRingSegment(index, slotCount, center, metrics.radius, metrics.stroke)}
            fill={segmentColor(type)}
            stroke="rgba(255,255,255,0.35)"
            strokeWidth="0.75"
            style={{ filter: `drop-shadow(0 0 3px ${segmentGlow(type)})` }}
          />
        ))}
      </svg>

      <div
        className="absolute flex items-center justify-center rounded-full border-2 border-orange-500 bg-white shadow-[0_1px_8px_rgba(0,0,0,0.35)]"
        style={{ inset: metrics.inset }}
      >
        <IconUsers size={metrics.icon} stroke={2.25} className="text-orange-600" />
      </div>
    </div>
  )
}
