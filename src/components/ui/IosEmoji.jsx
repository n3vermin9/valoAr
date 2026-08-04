import { getAppleEmojiFallbackUrl, getAppleEmojiUrl } from '../../utils/iosEmoji'
import { getCachedAppleEmojiDataUrl } from '../../services/emojiImageCache'

export default function IosEmoji({ emoji, size = 20, className = '', alt, eager = false }) {
  if (!emoji) return null

  const cached = getCachedAppleEmojiDataUrl(emoji)
  const src = cached || getAppleEmojiUrl(emoji)

  return (
    <img
      src={src}
      alt={alt ?? emoji}
      width={size}
      height={size}
      className={`inline-block shrink-0 object-contain select-none ${className}`}
      draggable={false}
      loading={eager || cached ? 'eager' : 'lazy'}
      decoding={eager || cached ? 'sync' : 'async'}
      onError={(event) => {
        if (event.currentTarget.src.startsWith('data:')) return
        const fallback = getAppleEmojiFallbackUrl(emoji)
        if (event.currentTarget.src !== fallback) {
          event.currentTarget.src = fallback
        }
      }}
    />
  )
}
