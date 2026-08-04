import { useEffect, useRef } from 'react'
import EmojiPicker, { EmojiStyle } from 'emoji-picker-react'
import { rememberUsedEmoji } from '../../services/emojiImageCache'

export default function EmojiPickerPopover({
  open,
  onEmojiClick,
  onClose,
  className = 'absolute bottom-full left-4 mb-2 z-20',
  width = 300,
  height = 350,
}) {
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return

    const handlePointerDown = (event) => {
      if (ref.current?.contains(event.target)) return
      onClose?.()
    }

    document.addEventListener('mousedown', handlePointerDown)
    return () => document.removeEventListener('mousedown', handlePointerDown)
  }, [open, onClose])

  if (!open) return null

  return (
    <div ref={ref} className={className}>
      <EmojiPicker
        onEmojiClick={(emojiData) => {
          const emoji = emojiData.emoji
          rememberUsedEmoji(emoji)
          onEmojiClick(emoji)
        }}
        emojiStyle={EmojiStyle.APPLE}
        theme="dark"
        previewConfig={{ showPreview: false }}
        skinTonesDisabled
        width={width}
        height={height}
      />
    </div>
  )
}
