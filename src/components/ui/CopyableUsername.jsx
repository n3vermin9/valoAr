import toast from 'react-hot-toast'
import VerifiedBadge from './VerifiedBadge'

export default function CopyableUsername({ username, className = '', disabled = false, showVerified = true }) {
  if (!username || disabled) return null

  const handleClick = async (e) => {
    e.stopPropagation()
    e.preventDefault()
    try {
      await navigator.clipboard.writeText(username)
      toast.success('Username copied')
    } catch {
      toast.error('Could not copy username')
    }
  }

  return (
    <span className="inline-flex items-center gap-1 min-w-0 max-w-full">
      <button
        type="button"
        onClick={handleClick}
        data-allow-copy
        className={`text-left hover:opacity-80 transition-opacity truncate ${className}`}
      >
        {username}
      </button>
      {showVerified && <VerifiedBadge username={username} className="pointer-events-none" />}
    </span>
  )
}
