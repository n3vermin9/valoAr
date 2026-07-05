// emoji-datasource-apple only publishes the 64px individual PNGs on the CDN.
// Using any other folder (e.g. /32/) 404s and shows broken images.
const APPLE_EMOJI_CDN = 'https://cdn.jsdelivr.net/npm/emoji-datasource-apple/img/apple/64/'

const urlCache = new Map()

const EMOJI_SEGMENT_REGEX =
  /\p{Extended_Pictographic}(?:\uFE0F|\uFE0E)?(?:\u200D\p{Extended_Pictographic}(?:\uFE0F|\uFE0E)?)*/gu

export function emojiToUnified(emoji) {
  if (!emoji) return ''
  const codepoints = []
  for (let i = 0; i < emoji.length; ) {
    const point = emoji.codePointAt(i)
    codepoints.push(point.toString(16).toLowerCase())
    i += point > 0xffff ? 2 : 1
  }
  return codepoints.join('-')
}

export function getAppleEmojiUrl(emoji) {
  if (!emoji) return ''
  const cached = urlCache.get(emoji)
  if (cached) return cached

  const url = `${APPLE_EMOJI_CDN}${emojiToUnified(emoji)}.png`
  urlCache.set(emoji, url)
  return url
}

// Some datasource files drop a trailing FE0F presentation selector.
// Used as an onError fallback so rare emojis never render broken.
export function getAppleEmojiFallbackUrl(emoji) {
  if (!emoji) return ''
  const unified = emojiToUnified(emoji).replace(/-fe0f$/, '')
  return `${APPLE_EMOJI_CDN}${unified}.png`
}

export function splitTextAndEmojis(text = '') {
  if (!text) return [{ type: 'text', value: '' }]

  const segments = []
  let lastIndex = 0
  let match

  EMOJI_SEGMENT_REGEX.lastIndex = 0
  while ((match = EMOJI_SEGMENT_REGEX.exec(text)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ type: 'text', value: text.slice(lastIndex, match.index) })
    }
    segments.push({ type: 'emoji', value: match[0] })
    lastIndex = match.index + match[0].length
  }

  if (lastIndex < text.length) {
    segments.push({ type: 'text', value: text.slice(lastIndex) })
  }

  return segments.length > 0 ? segments : [{ type: 'text', value: text }]
}
