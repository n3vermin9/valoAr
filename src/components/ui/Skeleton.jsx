function cx(...parts) {
  return parts.filter(Boolean).join(' ')
}

/** Grayed-out block that slowly blinks — building unit for skeleton screens. */
export function Skeleton({ className = '', rounded = 'md' }) {
  const radius =
    rounded === 'full'
      ? 'rounded-full'
      : rounded === 'lg'
        ? 'rounded-[var(--ios-radius-lg)]'
        : rounded === 'sm'
          ? 'rounded-md'
          : 'rounded-[var(--ios-radius-md)]'

  return (
    <div
      className={cx('skeleton-block', radius, className)}
      aria-hidden
    />
  )
}

/** Full-page skeleton matching typical content: header bar, media + lines, large block. */
export function PageSkeleton({ className = '' }) {
  return (
    <div
      className={cx('h-full w-full flex flex-col px-[var(--ios-page-x-lg)] pt-4 pb-8 gap-5', className)}
      role="status"
      aria-label="Loading"
    >
      <Skeleton className="h-8 w-[42%] max-w-[10rem] shrink-0" rounded="md" />

      <div className="flex items-start gap-3">
        <Skeleton className="h-[4.5rem] w-[4.5rem] shrink-0" rounded="lg" />
        <div className="flex-1 min-w-0 pt-1 space-y-2.5">
          <Skeleton className="h-3.5 w-[72%]" rounded="sm" />
          <Skeleton className="h-3.5 w-[48%]" rounded="sm" />
        </div>
      </div>

      <Skeleton className="aspect-square w-full max-w-[17rem] shrink-0" rounded="lg" />

      <div className="space-y-2.5 mt-1">
        <Skeleton className="h-3.5 w-full" rounded="sm" />
        <Skeleton className="h-3.5 w-[88%]" rounded="sm" />
        <Skeleton className="h-3.5 w-[62%]" rounded="sm" />
      </div>
    </div>
  )
}

/** Chat / inbox list rows. */
export function ListSkeleton({ rows = 6, className = '' }) {
  return (
    <div className={cx('mt-2 space-y-1', className)} role="status" aria-label="Loading">
      {Array.from({ length: rows }, (_, i) => (
        <div key={i} className="flex items-center gap-3 px-1 py-3">
          <Skeleton className="h-14 w-14 shrink-0" rounded="full" />
          <div className="flex-1 min-w-0 space-y-2">
            <div className="flex items-center justify-between gap-3">
              <Skeleton className="h-3.5 w-[38%]" rounded="sm" />
              <Skeleton className="h-3 w-10 shrink-0" rounded="sm" />
            </div>
            <Skeleton className="h-3 w-[68%]" rounded="sm" />
          </div>
        </div>
      ))}
    </div>
  )
}

/** Discover swipe-card placeholder. */
export function CardSkeleton({ className = '' }) {
  return (
    <div
      className={cx('w-full max-w-[17rem] mx-auto', className)}
      role="status"
      aria-label="Loading"
    >
      <div className="rounded-[var(--ios-radius-lg)] overflow-hidden border border-white/10 bg-white/5">
        <Skeleton className="aspect-square w-full !rounded-none" rounded="sm" />
        <div className="px-3.5 py-3 space-y-2.5">
          <Skeleton className="h-4 w-[55%]" rounded="sm" />
          <Skeleton className="h-3 w-full" rounded="sm" />
          <Skeleton className="h-3 w-[70%]" rounded="sm" />
        </div>
      </div>
    </div>
  )
}

/** Profile / photo-hero layout. */
export function ProfileSkeleton({ className = '' }) {
  return (
    <div className={cx('h-full min-h-0 flex flex-col', className)} role="status" aria-label="Loading">
      <Skeleton className="w-full aspect-[3/4] max-h-[55vh] !rounded-none shrink-0" rounded="sm" />
      <div className="px-[var(--ios-page-x-lg)] -mt-8 relative z-[1] space-y-3 pb-8">
        <Skeleton className="h-7 w-[46%]" rounded="md" />
        <Skeleton className="h-3.5 w-[32%]" rounded="sm" />
        <div className="pt-2 space-y-2.5">
          <Skeleton className="h-3.5 w-full" rounded="sm" />
          <Skeleton className="h-3.5 w-[90%]" rounded="sm" />
          <Skeleton className="h-3.5 w-[64%]" rounded="sm" />
        </div>
        <div className="flex gap-2 pt-3">
          <Skeleton className="h-10 flex-1" rounded="full" />
          <Skeleton className="h-10 flex-1" rounded="full" />
        </div>
      </div>
    </div>
  )
}

/** Chat room: header + message bubbles. */
export function ChatRoomSkeleton({ className = '' }) {
  return (
    <div className={cx('h-full flex flex-col px-[var(--ios-page-x-lg)]', className)} role="status" aria-label="Loading">
      <div className="flex items-center gap-3 py-3 shrink-0">
        <Skeleton className="h-9 w-9 shrink-0" rounded="full" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-3.5 w-[40%]" rounded="sm" />
          <Skeleton className="h-3 w-[24%]" rounded="sm" />
        </div>
      </div>
      <div className="flex-1 min-h-0 flex flex-col justify-end gap-3 pb-6">
        <Skeleton className="h-10 w-[68%] self-start" rounded="lg" />
        <Skeleton className="h-10 w-[54%] self-end" rounded="lg" />
        <Skeleton className="h-16 w-[72%] self-start" rounded="lg" />
        <Skeleton className="h-10 w-[42%] self-end" rounded="lg" />
        <Skeleton className="h-10 w-[60%] self-start" rounded="lg" />
      </div>
      <Skeleton className="h-12 w-full mb-3 shrink-0" rounded="full" />
    </div>
  )
}

/** Generic settings / form page. */
export function FormSkeleton({ className = '' }) {
  return (
    <div
      className={cx('px-[var(--ios-page-x-lg)] pt-4 space-y-5', className)}
      role="status"
      aria-label="Loading"
    >
      <Skeleton className="h-8 w-[36%]" rounded="md" />
      <Skeleton className="h-12 w-full" rounded="full" />
      <Skeleton className="h-12 w-full" rounded="full" />
      <Skeleton className="h-28 w-full" rounded="lg" />
      <Skeleton className="h-12 w-full" rounded="full" />
    </div>
  )
}

export default Skeleton
