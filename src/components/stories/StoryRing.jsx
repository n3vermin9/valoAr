import { IconPlus } from '@tabler/icons-react'
import { storyRingInnerClass } from '../../utils/designSystem'
import CachedAvatar from '../ui/CachedAvatar'
import { sad } from '../../assets'

// Gap between ring and photo, as % of inner diameter (per side)
const STORY_RING_GAP_PERCENT = 8

export default function StoryRing({
  photo,
  username,
  size = 64,
  unseen = false,
  seen = false,
  isOwn = false,
  hasStories = false,
  showAddBadge = false,
  onAddClick,
  onClick,
  onPointerDown,
  as: Component = 'button',
  className = '',
}) {
  const hasRing = unseen || seen || hasStories || isOwn
  const ringWidth = unseen ? 3 : seen || hasStories ? 2.5 : isOwn ? 2 : 0
  const innerDiameter = hasRing ? size - ringWidth * 2 : size
  const ringGap = hasRing ? innerDiameter * (STORY_RING_GAP_PERCENT / 100) : 0
  const photoDiameter = hasRing ? innerDiameter - ringGap * 2 : size
  const badgeClass = size >= 100 ? 'w-7 h-7' : 'w-5 h-5'
  const badgeIconSize = size >= 100 ? 16 : 12

  const ringClass = unseen
    ? 'bg-gradient-to-tr from-blue-500 via-violet-500 to-fuchsia-500'
    : seen || hasStories
      ? 'bg-neutral-500/90'
      : isOwn
        ? 'border border-dashed border-white/35 bg-transparent'
        : ''

  const useDivInteractive = Component === 'div' && onClick
  const useDivWrapper = (showAddBadge && Component === 'button') || useDivInteractive
  const Outer = showAddBadge && Component === 'button' ? 'div' : Component
  const ariaLabel = isOwn ? 'Your story' : `${username}'s story`

  const interactiveProps = useDivWrapper
    ? {
        onClick,
        onPointerDown,
        role: 'button',
        tabIndex: 0,
        'aria-label': ariaLabel,
        onKeyDown: (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            onClick?.(e)
          }
        },
      }
    : Component === 'button'
      ? { type: 'button', onClick, onPointerDown, 'aria-label': ariaLabel }
      : {}

  return (
    <Outer
      {...interactiveProps}
      style={{ width: size, height: size, padding: hasRing ? ringWidth : 0 }}
      className={`relative shrink-0 rounded-full box-border flex items-center justify-center ${ringClass} ${className}`}
    >
      <div
        className="rounded-full box-border flex items-center justify-center bg-[var(--ios-bg)]"
        style={{
          width: hasRing ? innerDiameter : size,
          height: hasRing ? innerDiameter : size,
          padding: hasRing ? `${STORY_RING_GAP_PERCENT}%` : 0,
        }}
      >
        <div
          className={`${storyRingInnerClass} flex items-center justify-center`}
          style={{
            width: hasRing ? photoDiameter : size,
            height: hasRing ? photoDiameter : size,
          }}
        >
        <CachedAvatar
          src={photo}
          fallback={sad}
          size={hasRing ? photoDiameter : size}
          alt=""
          className="w-full h-full object-cover"
          draggable={false}
        />
        </div>
      </div>
      {(showAddBadge || (isOwn && !hasStories)) && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onAddClick?.()
          }}
          className={`absolute -bottom-0.5 -right-0.5 ${badgeClass} rounded-full bg-[var(--ios-blue)] border-2 border-black flex items-center justify-center z-10`}
          aria-label="Add story"
        >
          <IconPlus size={badgeIconSize} stroke={2.5} />
        </button>
      )}
    </Outer>
  )
}
