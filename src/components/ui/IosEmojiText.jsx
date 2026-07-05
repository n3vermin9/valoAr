import { useMemo } from 'react'
import { splitTextAndEmojis } from '../../utils/iosEmoji'
import IosEmoji from './IosEmoji'

export default function IosEmojiText({
  text = '',
  size = 16,
  className = '',
  emojiClassName = 'align-text-bottom',
}) {
  const segments = useMemo(() => splitTextAndEmojis(text), [text])

  return (
    <span className={className}>
      {segments.map((segment, index) =>
        segment.type === 'emoji' ? (
          <IosEmoji
            key={`emoji-${index}`}
            emoji={segment.value}
            size={size}
            className={emojiClassName}
          />
        ) : (
          <span key={`text-${index}`}>{segment.value}</span>
        )
      )}
    </span>
  )
}
