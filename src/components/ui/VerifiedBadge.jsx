import { IconRosetteDiscountCheckFilled } from '@tabler/icons-react'
import { isVerifiedUsername } from '../../utils/verifiedAccount'

export default function VerifiedBadge({ username, size = 18, className = '' }) {
  if (!isVerifiedUsername(username)) return null

  return (
    <IconRosetteDiscountCheckFilled
      size={size}
      className={`text-[#1d9bf0] shrink-0 ${className}`}
      aria-label="Verified account"
    />
  )
}
