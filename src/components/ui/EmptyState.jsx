import { sad } from '../../assets'

export default function EmptyState({ message = 'Nothing here yet', className = '' }) {
  return (
    <div className={`flex flex-col items-center justify-center px-4 ${className}`}>
      <img
        src={sad}
        alt=""
        draggable={false}
        className="w-24 h-24 mb-4 rounded-2xl object-cover opacity-80 grayscale pointer-events-none select-none"
      />
      <p className="text-white/60 text-center">{message}</p>
    </div>
  )
}
