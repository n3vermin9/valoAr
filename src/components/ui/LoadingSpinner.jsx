/** Compact blink for inline/button loading. Prefer PageSkeleton / ListSkeleton for screens. */
export default function LoadingSpinner({ size = 'w-12 h-12' }) {
  return (
    <div className="flex items-center justify-center" role="status" aria-label="Loading">
      <div className={`skeleton-block shrink-0 rounded-full ${size}`} />
    </div>
  )
}
