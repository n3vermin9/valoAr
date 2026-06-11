export default function ChevronBack({ className = 'w-6 h-6', onClick, buttonClassName }) {
  return (
    <button
      onClick={onClick}
      className={buttonClassName || 'p-2 -ml-2 hover:bg-white/10 rounded-full transition-colors'}
    >
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  )
}
