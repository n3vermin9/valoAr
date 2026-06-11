import { useState, useRef, useLayoutEffect, useCallback } from 'react'
import toast from 'react-hot-toast'
import { IconX, IconUsers, IconWorld } from '@tabler/icons-react'
import { motion, AnimatePresence } from 'framer-motion'
import { postStory } from '../../services/storyService'
import {
  STORY_COLORS,
  MAX_STORY_LENGTH,
  getStoryColorClass,
  STORY_PRIVACY,
} from '../../utils/storyHelpers'
import Button from '../ui/Button'

export default function StoryComposer({ isOpen, onClose, userId }) {
  const [text, setText] = useState('')
  const [color, setColor] = useState(STORY_COLORS[0].id)
  const [privacy, setPrivacy] = useState(STORY_PRIVACY.FRIENDS)
  const [posting, setPosting] = useState(false)
  const textareaRef = useRef(null)

  const previewClass = getStoryColorClass(color)
  const remaining = MAX_STORY_LENGTH - text.length

  const syncTextareaHeight = useCallback(() => {
    const el = textareaRef.current
    if (!el?.parentElement) return
    el.style.height = '0px'
    const maxHeight = el.parentElement.clientHeight
    el.style.height = `${Math.min(el.scrollHeight, maxHeight)}px`
  }, [])

  useLayoutEffect(() => {
    if (!isOpen) return
    syncTextareaHeight()
  }, [isOpen, text, syncTextareaHeight])

  const handleClose = () => {
    if (posting) return
    setText('')
    setColor(STORY_COLORS[0].id)
    setPrivacy(STORY_PRIVACY.FRIENDS)
    onClose()
  }

  const handlePost = async () => {
    const trimmed = text.trim()
    if (!trimmed) {
      toast.error('Write something for your story')
      return
    }
    setPosting(true)
    try {
      await postStory(userId, { text: trimmed, color, privacy })
      toast.success('Story posted!')
      setText('')
      setColor(STORY_COLORS[0].id)
      setPrivacy(STORY_PRIVACY.FRIENDS)
      onClose()
    } catch (err) {
      toast.error(err.message || 'Failed to post story')
    } finally {
      setPosting(false)
    }
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[90] bg-black/80 backdrop-blur-sm flex flex-col"
        >
          <div className="flex items-center justify-between px-4 pt-[calc(var(--ios-safe-top)+12px)] pb-3">
            <button
              type="button"
              onClick={handleClose}
              className="p-2 rounded-full hover:bg-white/10"
              aria-label="Close"
            >
              <IconX size={22} />
            </button>
            <p className="text-[17px] font-semibold">New story</p>
            <div className="w-10" />
          </div>

          <div className="flex-1 flex flex-col px-4 pb-6 min-h-0">
            <div
              role="presentation"
              onClick={() => textareaRef.current?.focus()}
              className={`relative flex-1 rounded-[var(--ios-radius-xl)] p-6 flex items-center justify-center min-h-0 overflow-hidden cursor-text ${previewClass}`}
            >
              <textarea
                ref={textareaRef}
                value={text}
                onChange={(e) => setText(e.target.value.slice(0, MAX_STORY_LENGTH))}
                placeholder="What's on your mind?"
                rows={1}
                className="w-full max-h-full bg-transparent text-xl font-semibold leading-relaxed text-white text-center placeholder:text-white/40 outline-none resize-none border-0 whitespace-pre-wrap break-words overflow-y-auto"
                autoFocus
              />
              <p
                className={`absolute bottom-4 right-4 text-xs tabular-nums ${
                  remaining < 40 ? 'text-white/90' : 'text-white/50'
                }`}
              >
                {remaining}
              </p>
            </div>

            <div className="flex gap-2 mt-4 justify-center flex-wrap">
              {STORY_COLORS.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setColor(c.id)}
                  className={`shrink-0 w-9 h-9 rounded-full ${c.className} ${
                    color === c.id ? 'ring-2 ring-white ring-offset-2 ring-offset-black' : 'opacity-70'
                  }`}
                  aria-label={`Color ${c.id}`}
                />
              ))}
            </div>

            <p className="text-xs text-[var(--ios-label-secondary)] mt-4 mb-2">Who can see this?</p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setPrivacy(STORY_PRIVACY.FRIENDS)}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-full text-sm font-medium border transition-colors ${
                  privacy === STORY_PRIVACY.FRIENDS
                    ? 'bg-[var(--ios-blue)] border-[var(--ios-blue)] text-white'
                    : 'border-[var(--ios-glass-border)] bg-[var(--ios-fill-tertiary)] text-[var(--ios-label-secondary)]'
                }`}
              >
                <IconUsers size={16} />
                Friends
              </button>
              <button
                type="button"
                onClick={() => setPrivacy(STORY_PRIVACY.ALL)}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-full text-sm font-medium border transition-colors ${
                  privacy === STORY_PRIVACY.ALL
                    ? 'bg-[var(--ios-blue)] border-[var(--ios-blue)] text-white'
                    : 'border-[var(--ios-glass-border)] bg-[var(--ios-fill-tertiary)] text-[var(--ios-label-secondary)]'
                }`}
              >
                <IconWorld size={16} />
                Everyone
              </button>
            </div>

            <Button fullWidth onClick={handlePost} disabled={posting || !text.trim()} className="mt-4">
              {posting ? 'Posting...' : 'Share story'}
            </Button>
            <p className="text-center text-xs text-[var(--ios-label-tertiary)] mt-2">
              Disappears after 24 hours
            </p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
