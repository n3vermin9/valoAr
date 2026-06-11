import { IconPlus } from '@tabler/icons-react'
import { storyRingInnerClass } from '../../utils/designSystem'
import { sad } from '../../assets'

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
  const pad = unseen ? 3 : seen || hasStories ? 2.5 : isOwn ? 2 : 0
  const inner = size - pad * 2

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
      style={{ width: size, height: size, padding: hasRing ? pad : 0 }}
      className={`relative shrink-0 rounded-full box-border flex items-center justify-center ${ringClass} ${className}`}
    >
      <div
        className={`${storyRingInnerClass} flex items-center justify-center bg-[var(--ios-bg)]`}
        style={{ width: inner, height: inner }}
      >
        <img
          src={photo || sad}
          alt=""
          className="w-full h-full object-cover"
          draggable={false}
        />
      </div>
      {(showAddBadge || (isOwn && !hasStories)) && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onAddClick?.()
          }}
          className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full bg-[var(--ios-blue)] border-2 border-black flex items-center justify-center z-10"
          aria-label="Add story"
        >
          <IconPlus size={12} stroke={2.5} />
        </button>
      )}
    </Outer>
  )
}
