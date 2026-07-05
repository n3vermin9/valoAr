import { getAppleEmojiFallbackUrl, getAppleEmojiUrl } from '../../utils/iosEmoji'

export default function IosEmoji({ emoji, size = 20, className = '', alt }) {
  if (!emoji) return null

  return (
    <img
      src={getAppleEmojiUrl(emoji)}
      alt={alt ?? emoji}
      width={size}
      height={size}
      className={`inline-block shrink-0 object-contain select-none ${className}`}
      draggable={false}
      loading="lazy"
      decoding="async"
      onError={(event) => {
        const fallback = getAppleEmojiFallbackUrl(emoji)
        if (event.currentTarget.src !== fallback) {
          event.currentTarget.src = fallback
        }
      }}
    />
  )
}
