import CachedAvatar from '../ui/CachedAvatar'
import { getGroupPhotoUrl } from '../../utils/groupChat'

export default function GroupAvatar({ photoUrl, size = 56, className = '' }) {
  const dimension = typeof size === 'number' ? `${size}px` : size
  const src = getGroupPhotoUrl(photoUrl)

  return (
    <div
      className={`shrink-0 overflow-hidden rounded-full ${className}`}
      style={{ width: dimension, height: dimension }}
    >
      <CachedAvatar
        src={src}
        fallback={src}
        size={size}
        alt=""
        className="w-full h-full rounded-full object-cover"
      />
    </div>
  )
}
