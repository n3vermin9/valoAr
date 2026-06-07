import toast from 'react-hot-toast'

export default function CopyableUsername({ username, className = '', disabled = false }) {
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
    <button
      type="button"
      onClick={handleClick}
      data-allow-copy
      className={`text-left hover:opacity-80 transition-opacity ${className}`}
    >
      {username}
    </button>
  )
}
