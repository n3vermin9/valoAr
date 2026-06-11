import { useState, useRef, useLayoutEffect, useCallback, useEffect } from 'react'
import toast from 'react-hot-toast'
import { IconX, IconUsers, IconWorld, IconChevronDown, IconCheck } from '@tabler/icons-react'
import { motion, AnimatePresence } from 'framer-motion'
import { postStory } from '../../services/storyService'
import {
  STORY_COLORS,
  MAX_STORY_LENGTH,
  getStoryColorClass,
  STORY_PRIVACY,
} from '../../utils/storyHelpers'
import {
  navGlassMenuClass,
  contextMenuMotion,
  dropdownMenuClass,
  dropdownMenuItemWithIconClass,
  storyGlassButtonClass,
} from '../../utils/designSystem'
import Button from '../ui/Button'

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
  const [showPrivacyMenu, setShowPrivacyMenu] = useState(false)
  const textareaRef = useRef(null)
  const privacyMenuRef = useRef(null)
  const colorMenuRef = useRef(null)

  const previewClass = getStoryColorClass(color)
  const remaining = MAX_STORY_LENGTH - text.length
  const activeColor = STORY_COLORS.find((entry) => entry.id === color) || STORY_COLORS[0]
  const activePrivacy =
    privacyOptions.find((option) => option.id === privacy) || privacyOptions[0]
  const ActivePrivacyIcon = activePrivacy.icon

  const closeMenus = useCallback(() => {
    setShowColorMenu(false)
    setShowPrivacyMenu(false)
  }, [])

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

  useEffect(() => {
    if (!showColorMenu && !showPrivacyMenu) return
    const handleClickOutside = (e) => {
      if (privacyMenuRef.current?.contains(e.target)) return
      if (colorMenuRef.current?.contains(e.target)) return
      closeMenus()
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showColorMenu, showPrivacyMenu, closeMenus])

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

  const composerTriggerClass = `${storyGlassButtonClass} !p-2 flex items-center justify-center gap-1`

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
              onClick={() => {
                closeMenus()
                textareaRef.current?.focus()
              }}
              className={`relative flex-1 rounded-[var(--ios-radius-xl)] p-6 flex items-center justify-center min-h-0 overflow-hidden cursor-text ${previewClass}`}
            >
              <div className="absolute top-4 left-4 z-20" ref={privacyMenuRef}>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    setShowPrivacyMenu((open) => !open)
                    setShowColorMenu(false)
                  }}
                  className={composerTriggerClass}
                  aria-label="Story privacy"
                  aria-expanded={showPrivacyMenu}
                >
                  <ActivePrivacyIcon size={18} />
                  <IconChevronDown
                    size={14}
                    className={`text-white/70 transition-transform ${showPrivacyMenu ? 'rotate-180' : ''}`}
                  />
                </button>

                <AnimatePresence>
                  {showPrivacyMenu && (
                    <motion.div
                      {...contextMenuMotion}
                      className={`absolute left-0 top-full mt-2 z-30 min-w-[10.5rem] ${dropdownMenuClass} ${navGlassMenuClass}`}
                      onClick={(e) => e.stopPropagation()}
                    >
                      {privacyOptions.map((option) => {
                        const OptionIcon = option.icon
                        const selected = privacy === option.id
                        return (
                          <button
                            key={option.id}
                            type="button"
                            onClick={() => {
                              setPrivacy(option.id)
                              setShowPrivacyMenu(false)
                            }}
                            className={`${dropdownMenuItemWithIconClass} ${
                              selected ? 'text-white' : ''
                            }`}
                          >
                            <OptionIcon size={18} stroke={1.75} className="shrink-0 text-white/55" />
                            <span className="flex-1 text-left">{option.label}</span>
                            {selected && <IconCheck size={16} className="shrink-0 text-[var(--ios-blue)]" />}
                          </button>
                        )
                      })}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <div className="absolute top-4 right-4 z-20" ref={colorMenuRef}>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    setShowColorMenu((open) => !open)
                    setShowPrivacyMenu(false)
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
                      className={`absolute right-0 top-full mt-2 z-30 w-44 rounded-[var(--ios-radius-lg)] overflow-hidden ${navGlassMenuClass} p-3`}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="grid grid-cols-3 gap-2 justify-items-center">
                        {STORY_COLORS.map((entry) => (
                          <button
                            key={entry.id}
                            type="button"
                            onClick={() => {
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
                className="w-full max-h-full bg-transparent text-xl font-semibold leading-relaxed text-white text-center placeholder:text-white/40 outline-none resize-none border-0 whitespace-pre-wrap break-words overflow-y-auto relative z-[1]"
                autoFocus
              />
              <p
                className={`absolute bottom-4 right-4 text-xs tabular-nums z-10 ${
                  remaining < 40 ? 'text-white/90' : 'text-white/50'
                }`}
              >
                {remaining}
              </p>
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
