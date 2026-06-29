import VerifiedBadge from './VerifiedBadge'

export default function UsernameLabel({
  username,
  fallback = 'User',
  className = '',
  badgeSize = 14,
  as: Tag = 'span',
  truncate = true,
}) {
  const display = username?.trim() || fallback

  return (
    <Tag className={`inline-flex items-center gap-1 min-w-0 max-w-full ${className}`}>
      <span className={truncate ? 'truncate' : 'break-words'}>{display}</span>
      <VerifiedBadge username={username} size={badgeSize} className="pointer-events-none shrink-0" />
    </Tag>
  )
}
