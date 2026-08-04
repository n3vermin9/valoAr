import { useState, useRef, useLayoutEffect, useCallback, useEffect } from 'react'
import { createPortal } from 'react-dom'
import toast from 'react-hot-toast'
import { IconX, IconUsers, IconWorld, IconChevronDown, IconCheck } from '@tabler/icons-react'
import { motion, AnimatePresence } from 'framer-motion'
import { postStory } from '../../services/storyService'
import { setStoryComposerOpen } from '../../utils/storyOverlay'
import {
  STORY_COLORS,
  MAX_STORY_LENGTH,
  getStoryColorClass,
  STORY_PRIVACY,
} from '../../utils/storyHelpers'
import {
  navGlassMenuClass,
  contextMenuMotion,
  storyGlassButtonClass,
} from '../../utils/designSystem'
import Button from '../ui/Button'
import { useOverlayKeyboardInset } from '../../hooks/useOverlayKeyboardInset'

const privacyOptions = [
  { id: STORY_PRIVACY.FRIENDS, label: 'Friends', icon: IconUsers },
  { id: STORY_PRIVACY.ALL, label: 'Everyone', icon: IconWorld },
]

export default function StoryComposer({ isOpen, onClose, userId }) {
  const [text, setText] = useState('')
  const [color, setColor] = useState(STORY_COLORS[0].id)
  const [privacy, setPrivacy] = useState(STORY_PRIVACY.FRIENDS)
  const [posting, setPosting] = useState(false)
  const [showColorMenu, setShowColorMenu] = useState(false)
  const textareaRef = useRef(null)
  const previewRef = useRef(null)
  const colorMenuRef = useRef(null)

  const previewClass = getStoryColorClass(color)
  const remaining = MAX_STORY_LENGTH - text.length
  const activeColor = STORY_COLORS.find((entry) => entry.id === color) || STORY_COLORS[0]
  const activePrivacy =
    privacyOptions.find((option) => option.id === privacy) || privacyOptions[0]
  const ActivePrivacyIcon = activePrivacy.icon
  const {
    inset: keyboardInset,
    keyboardOpen,
    ease: keyboardEase,
    ms: keyboardMs,
  } = useOverlayKeyboardInset(isOpen)

  const closeMenus = useCallback(() => {
    setShowColorMenu(false)
  }, [])

  const togglePrivacy = useCallback(() => {
    setPrivacy((current) =>
      current === STORY_PRIVACY.FRIENDS ? STORY_PRIVACY.ALL : STORY_PRIVACY.FRIENDS
    )
  }, [])

  const syncTextareaHeight = useCallback(() => {
    const el = textareaRef.current
    const preview = previewRef.current
    if (!el || !preview) return
    const maxHeight = preview.clientHeight
    if (maxHeight <= 0) return
    // Grow with content without collapsing to 0 (avoids jump during keyboard animation).
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, maxHeight)}px`
  }, [])

  useLayoutEffect(() => {
    if (!isOpen) return
    syncTextareaHeight()
  }, [isOpen, text, syncTextareaHeight])

  // Open the system keyboard as soon as the composer mounts (mobile + desktop).
  useLayoutEffect(() => {
    if (!isOpen) return undefined
    const el = textareaRef.current
    if (!el) return undefined
    el.focus({ preventScroll: true })
    // Retry once after paint — portal mount can race the first focus on iOS.
    const id = window.requestAnimationFrame(() => {
      if (document.activeElement !== el) el.focus({ preventScroll: true })
    })
    return () => window.cancelAnimationFrame(id)
  }, [isOpen])

  // After the preview finishes resizing for the keyboard, reflow the textarea once.
  useEffect(() => {
    if (!isOpen) return undefined
    const id = window.setTimeout(syncTextareaHeight, keyboardMs + 16)
    return () => window.clearTimeout(id)
  }, [isOpen, keyboardInset, keyboardMs, syncTextareaHeight])

  useEffect(() => {
    if (!isOpen || !previewRef.current) return undefined
    const ro = new ResizeObserver(() => syncTextareaHeight())
    ro.observe(previewRef.current)
    return () => ro.disconnect()
  }, [isOpen, syncTextareaHeight])

  useEffect(() => {
    setStoryComposerOpen(isOpen)
    return () => setStoryComposerOpen(false)
  }, [isOpen])

  useEffect(() => {
    if (!showColorMenu) return
    const handleClickOutside = (e) => {
      if (colorMenuRef.current?.contains(e.target)) return
      closeMenus()
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showColorMenu, closeMenus])

  const handleClose = () => {
    if (posting) return
    setText('')
    setColor(STORY_COLORS[0].id)
    setPrivacy(STORY_PRIVACY.FRIENDS)
    closeMenus()
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
      closeMenus()
      onClose()
    } catch (err) {
      toast.error(err.message || 'Failed to post story')
    } finally {
      setPosting(false)
    }
  }

  const keepKeyboard = useCallback(
    (e) => {
      if (!keyboardOpen) return
      e.preventDefault()
    },
    [keyboardOpen]
  )

  const composerTriggerClass = `${storyGlassButtonClass} !p-2 flex items-center justify-center gap-1`

  if (typeof document === 'undefined') return null

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div
          data-story-composer
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[90] bg-black/80 backdrop-blur-sm flex flex-col"
        >
          <div className="flex items-center justify-between px-4 pt-[calc(var(--ios-safe-top)+12px)] pb-3 shrink-0">
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

          <div
            className="flex-1 flex flex-col px-4 min-h-0"
            style={{
              paddingBottom: `calc(${keyboardOpen ? '0.5rem' : '1.5rem'} + ${keyboardInset}px)`,
              transition: `padding-bottom ${keyboardMs}ms ${keyboardEase}`,
            }}
          >
            <div
              ref={previewRef}
              role="presentation"
              onClick={() => {
                closeMenus()
                textareaRef.current?.focus({ preventScroll: true })
              }}
              className={`relative flex-1 rounded-[var(--ios-radius-xl)] p-5 flex items-center justify-center min-h-0 overflow-hidden cursor-text ${previewClass}`}
            >
              <div className="absolute top-4 left-4 z-20">
                <button
                  type="button"
                  onMouseDown={keepKeyboard}
                  onPointerDown={keepKeyboard}
                  onClick={(e) => {
                    e.stopPropagation()
                    togglePrivacy()
                    setShowColorMenu(false)
                  }}
                  className={composerTriggerClass}
                  aria-label={`Story privacy: ${activePrivacy.label}. Click to switch.`}
                >
                  <ActivePrivacyIcon size={18} />
                </button>
              </div>

              <div className="absolute top-4 right-4 z-20" ref={colorMenuRef}>
                <button
                  type="button"
                  onMouseDown={keepKeyboard}
                  onPointerDown={keepKeyboard}
                  onClick={(e) => {
                    e.stopPropagation()
                    setShowColorMenu((open) => !open)
                  }}
                  className={`${composerTriggerClass} !gap-1.5`}
                  aria-label="Story color"
                  aria-expanded={showColorMenu}
                >
                  <span
                    className={`w-5 h-5 rounded-full shrink-0 ${activeColor.className} ring-1 ring-white/30`}
                  />
                  <IconChevronDown
                    size={14}
                    className={`text-white/70 transition-transform ${showColorMenu ? 'rotate-180' : ''}`}
                  />
                </button>

                <AnimatePresence>
                  {showColorMenu && (
                    <motion.div
                      {...contextMenuMotion}
                      className={`absolute right-0 top-full mt-2 z-30 rounded-[var(--ios-radius-lg)] overflow-hidden ${navGlassMenuClass} p-2`}
                      onMouseDown={keepKeyboard}
                      onPointerDown={keepKeyboard}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div
                        className={`flex gap-2 items-center ${
                          keyboardOpen ? 'flex-row' : 'flex-col'
                        }`}
                      >
                        {STORY_COLORS.map((entry) => (
                          <button
                            key={entry.id}
                            type="button"
                            onMouseDown={keepKeyboard}
                            onPointerDown={keepKeyboard}
                            onClick={(e) => {
                              e.stopPropagation()
                              setColor(entry.id)
                              setShowColorMenu(false)
                            }}
                            className={`shrink-0 w-9 h-9 rounded-full ${entry.className} flex items-center justify-center ${
                              color === entry.id
                                ? 'ring-2 ring-white ring-offset-2 ring-offset-black/40'
                                : 'opacity-80 hover:opacity-100'
                            }`}
                            aria-label={`Color ${entry.id}`}
                          >
                            {color === entry.id && <IconCheck size={14} className="text-white drop-shadow" />}
                          </button>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <textarea
                ref={textareaRef}
                value={text}
                onChange={(e) => setText(e.target.value.slice(0, MAX_STORY_LENGTH))}
                onClick={(e) => e.stopPropagation()}
                placeholder="What's on your mind?"
                rows={1}
                enterKeyHint="done"
                autoCapitalize="sentences"
                className="w-full max-h-full bg-transparent text-[22px] font-semibold leading-snug text-white text-center placeholder:text-white/45 outline-none resize-none border-0 whitespace-pre-wrap break-words overflow-y-auto relative z-[1]"
                autoFocus
              />
              <p
                className={`absolute bottom-3 right-3 text-xs tabular-nums z-10 ${
                  remaining < 40 ? 'text-white/90' : 'text-white/50'
                }`}
              >
                {remaining}
              </p>
            </div>

            <Button
              fullWidth
              onClick={handlePost}
              disabled={posting || !text.trim()}
              className={`${keyboardOpen ? 'mt-3' : 'mt-4'} shrink-0`}
            >
              {posting ? 'Posting...' : 'Share story'}
            </Button>
            <p
              className={`text-center text-xs text-[var(--ios-label-tertiary)] shrink-0 ${
                keyboardOpen ? 'mt-1.5' : 'mt-2'
              }`}
            >
              Disappears after 24 hours
            </p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  )
}
