export default function EmptyState({ message = 'Nothing here yet', className = '' }) {
  return (
    <div className={`flex flex-col items-center justify-center px-4 ${className}`}>
      <p className="text-white/60 text-center">{message}</p>
    </div>
  )
}
