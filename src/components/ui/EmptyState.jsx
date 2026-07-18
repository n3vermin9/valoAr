export default function EmptyState({ message = 'Nothing here yet', className = '' }) {
  return (
    <div className={`flex w-full max-w-full flex-col items-center justify-center px-6 ${className}`}>
      <p className="w-full max-w-[17.5rem] text-center text-sm leading-snug text-white/60 break-words">
        {message}
      </p>
    </div>
  )
}
