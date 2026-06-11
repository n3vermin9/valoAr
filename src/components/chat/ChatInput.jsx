import { useState, useRef, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import EmojiPicker from 'emoji-picker-react'
import toast from 'react-hot-toast'
import { IconMoodSmile, IconPhoto, IconSend, IconMicrophone, IconX } from '@tabler/icons-react'
import { getVoiceMimeType, getMessagePreviewText } from '../../utils/helpers'
import {
  chatFloatingButtonClass,
  chatFloatingInputBarClass,
  chatFloatingPanelClass,
} from '../../utils/designSystem'
import ChatSearchControls from './ChatSearchControls'
import { getChatDraft, setChatDraft, clearChatDraft } from '../../utils/chatDrafts'

const actionButtonClass = chatFloatingButtonClass

const MAX_VOICE_SECONDS = 180
const MIN_VOICE_BYTES = 100
const STOP_TIMEOUT_MS = 4000
const composerTransition = { type: 'spring', stiffness: 260, damping: 30, mass: 1.05 }

function focusTextarea(ref) {
  requestAnimationFrame(() => {
    const el = ref.current
    if (!el || el.disabled) return
    el.focus()
  })
}

function stopRecorder(recorder, chunks) {
  return new Promise((resolve) => {
    if (!recorder || recorder.state === 'inactive') {
      resolve(new Blob(chunks, { type: 'audio/webm' }))
      return
    }

    const mimeType = (recorder.mimeType || getVoiceMimeType() || 'audio/webm').split(';')[0]
    const collected = [...chunks]
    let settled = false

    const done = () => {
      if (settled) return
      settled = true
      clearTimeout(timeout)
      recorder.removeEventListener('dataavailable', onData)
      recorder.removeEventListener('stop', onStop)
      resolve(new Blob(collected, { type: mimeType }))
    }

    const onData = (e) => {
      if (e.data.size > 0) collected.push(e.data)
    }

    const onStop = () => done()

    const timeout = setTimeout(done, STOP_TIMEOUT_MS)

    recorder.addEventListener('dataavailable', onData)
    recorder.addEventListener('stop', onStop)

    try {
      if (typeof recorder.requestData === 'function') {
        recorder.requestData()
      }
      recorder.stop()
    } catch {
      done()
    }
  })
}

export default function ChatInput({
  onSend,
  onSendVoice,
  onTyping,
  imagePreview,
  onImageSelect,
  onClearImage,
  focusKey,
  chatId,
  replyTo,
  replyAuthorName,
  onClearReply,
  searchActive = false,
  searchMatchIndex = 0,
  searchMatchCount = 0,
  onSearchPrev,
  onSearchNext,
  onOpenSearchResults,
}) {
  const [text, setText] = useState('')
  const [trackedDraftKey, setTrackedDraftKey] = useState('')
  const [showEmoji, setShowEmoji] = useState(false)
  const [recording, setRecording] = useState(false)
  const [recordingSeconds, setRecordingSeconds] = useState(0)
  const [sendingVoice, setSendingVoice] = useState(false)
  const wasSearchActiveRef = useRef(false)
  const emojiRef = useRef(null)
  const fileRef = useRef(null)
  const textareaRef = useRef(null)
  const mediaRecorderRef = useRef(null)
  const streamRef = useRef(null)
  const chunksRef = useRef([])
  const timerRef = useRef(null)
  const busyRef = useRef(false)
  const draftTimerRef = useRef(null)

  const showSend = Boolean(text.trim() || imagePreview)
  const draftKey = `${chatId ?? ''}:${focusKey ?? ''}`

  if (draftKey !== trackedDraftKey) {
    setTrackedDraftKey(draftKey)
    setText(chatId ? getChatDraft(chatId) : '')
  }

  useEffect(() => {
    if (!chatId) return
    clearTimeout(draftTimerRef.current)
    draftTimerRef.current = setTimeout(() => {
      setChatDraft(chatId, text)
    }, 300)
    return () => clearTimeout(draftTimerRef.current)
  }, [chatId, text])

  const releaseStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
  }, [])

  const resetVoiceUi = useCallback(() => {
    clearInterval(timerRef.current)
    timerRef.current = null
    busyRef.current = false
    mediaRecorderRef.current = null
    chunksRef.current = []
    setRecording(false)
    setRecordingSeconds(0)
    setSendingVoice(false)
    releaseStream()
    focusTextarea(textareaRef)
  }, [releaseStream])

  const finishRecording = useCallback(
    async (send) => {
      if (busyRef.current) return
      busyRef.current = true

      const recorder = mediaRecorderRef.current
      const chunks = chunksRef.current

      try {
        clearInterval(timerRef.current)
        timerRef.current = null
        setRecording(false)

        const blob = await stopRecorder(recorder, chunks)

        if (!send) return

        if (blob.size < MIN_VOICE_BYTES) {
          toast.error('Recording too short — hold a little longer')
          return
        }

        setSendingVoice(true)
        if (!onSendVoice) {
          throw new Error('Voice messages are not available in this chat')
        }
        await onSendVoice(blob)
      } catch (err) {
        toast.error(err?.message || 'Failed to send voice message')
      } finally {
        resetVoiceUi()
      }
    },
    [onSendVoice, resetVoiceUi]
  )

  const startRecording = useCallback(async () => {
    if (busyRef.current || recording || sendingVoice) return

    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      toast.error('Voice recording is not supported in this browser')
      return
    }

    busyRef.current = true

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mimeType = getVoiceMimeType()
      let recorder
      try {
        recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream)
      } catch {
        recorder = new MediaRecorder(stream)
      }

      chunksRef.current = []
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }

      streamRef.current = stream
      mediaRecorderRef.current = recorder
      recorder.start(200)

      setRecording(true)
      setRecordingSeconds(0)
      timerRef.current = setInterval(() => {
        setRecordingSeconds((s) => {
          const next = s + 1
          if (next >= MAX_VOICE_SECONDS) {
            queueMicrotask(() => finishRecording(true))
          }
          return next
        })
      }, 1000)
    } catch {
      toast.error('Microphone access denied')
      resetVoiceUi()
    } finally {
      busyRef.current = false
    }
  }, [recording, sendingVoice, resetVoiceUi, finishRecording])

  useEffect(() => {
    const timer = setTimeout(() => focusTextarea(textareaRef), 0)
    return () => clearTimeout(timer)
  }, [focusKey, replyTo?.id])

  useEffect(() => {
    return () => {
      clearInterval(timerRef.current)
      releaseStream()
      if (mediaRecorderRef.current?.state !== 'inactive') {
        try {
          mediaRecorderRef.current.stop()
        } catch {
          // ignore
        }
      }
    }
  }, [releaseStream])

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (emojiRef.current && !emojiRef.current.contains(e.target)) {
        setShowEmoji(false)
      }
    }
    if (showEmoji) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showEmoji])

  const showEmojiPicker = showEmoji && !searchActive

  useEffect(() => {
    if (wasSearchActiveRef.current && !searchActive) {
      focusTextarea(textareaRef)
    }
    wasSearchActiveRef.current = searchActive
  }, [searchActive])

  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    const nextHeight = Math.min(el.scrollHeight, 128)
    el.style.height = `${nextHeight}px`
  }, [text])

  const handleVoiceClick = () => {
    if (recording) {
      finishRecording(true)
    } else {
      startRecording()
    }
  }

  const handleSend = () => {
    if (!text.trim() && !imagePreview) return
    onSend({ text: text.trim(), imageUrl: imagePreview, replyTo })
    setText('')
    if (chatId) clearChatDraft(chatId)
    onClearImage?.()
    onClearReply?.()
    setShowEmoji(false)
    focusTextarea(textareaRef)
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (showSend) handleSend()
    }
  }

  const formatRecordingTime = (seconds) => {
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${m}:${String(s).padStart(2, '0')}`
  }

  return (
    <div className="relative bg-transparent">
      {replyTo && (
        <div className="px-4 pb-2">
          <div className={`${chatFloatingPanelClass} flex items-center gap-2 rounded-2xl px-3 py-2`}>
            <div className="flex-1 min-w-0 border-l-2 border-blue-400 pl-2.5">
              <p className="text-xs font-semibold text-blue-300 truncate">
                Replying to {replyAuthorName}
              </p>
              <p className="text-xs text-white/55 truncate">{getMessagePreviewText(replyTo)}</p>
            </div>
            <button
              type="button"
              onClick={onClearReply}
              className="shrink-0 self-center p-1 text-white/50 hover:text-white rounded-full transition-colors"
              aria-label="Cancel reply"
            >
              <IconX size={16} />
            </button>
          </div>
        </div>
      )}

      {imagePreview && (
        <div className="px-4 pb-2">
          <div className="relative inline-block">
            <img src={imagePreview} alt="" className="h-20 rounded-xl object-cover" />
            <button
              onClick={onClearImage}
              className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 rounded-full text-xs"
            >
              ×
            </button>
          </div>
        </div>
      )}

      {showEmojiPicker && (
        <div ref={emojiRef} className="absolute bottom-full left-4 mb-2 z-20">
          <EmojiPicker
            onEmojiClick={(emojiData) => setText((t) => t + emojiData.emoji)}
            theme="dark"
            previewConfig={{ showPreview: false }}
            skinTonesDisabled
            width={300}
            height={350}
          />
        </div>
      )}

      <div className="overflow-hidden px-4 py-3 shrink-0 min-h-[68px]">
        {searchActive ? (
          <ChatSearchControls
            matchIndex={searchMatchIndex}
            matchCount={searchMatchCount}
            onPrev={onSearchPrev}
            onNext={onSearchNext}
            onOpenResults={onOpenSearchResults}
          />
        ) : (
        <div className="flex items-center gap-2 h-11">
          <motion.div
            className="w-11 shrink-0"
            initial={false}
            animate={{
              x: 0,
              opacity: 1,
            }}
            transition={composerTransition}
          >
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className={`${actionButtonClass} text-white/70 hover:text-white`}
              disabled={recording || sendingVoice}
            >
              <IconPhoto size={22} />
            </button>
          </motion.div>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) onImageSelect?.(file)
              e.target.value = ''
            }}
          />

          <div className="flex-1 min-w-0 overflow-hidden">
            <motion.div
              className="mx-auto overflow-hidden"
              initial={false}
              animate={{
                width: '100%',
                opacity: 1,
              }}
              transition={composerTransition}
            >
              <div
                className={`${chatFloatingInputBarClass} flex w-full items-end gap-1.5 rounded-[30px] pl-2 pr-3 py-2 min-h-11`}
              >
                <button
                  type="button"
                  onClick={() => setShowEmoji(!showEmoji)}
                  className="h-8 w-8 shrink-0 flex items-center justify-center text-white/60 hover:text-white rounded-full transition-colors"
                  disabled={recording || sendingVoice}
                >
                  <IconMoodSmile size={20} />
                </button>
                <textarea
                  ref={textareaRef}
                  value={text}
                  rows={1}
                  data-allow-copy
                  onChange={(e) => {
                    setText(e.target.value)
                    onTyping?.(true)
                  }}
                  onBlur={() => onTyping?.(false)}
                  onKeyDown={handleKeyDown}
                  placeholder={
                    sendingVoice
                      ? 'Sending voice…'
                      : recording
                        ? `Recording ${formatRecordingTime(recordingSeconds)}… tap mic to send`
                        : 'Type a message...'
                  }
                  className="flex-1 min-w-0 py-1.5 pr-1 bg-transparent outline-none placeholder:text-white/40 resize-none overflow-y-auto leading-5 max-h-32"
                />
              </div>
            </motion.div>
          </div>

          <motion.div
            className="w-11 shrink-0"
            initial={false}
            animate={{
              x: 0,
              opacity: 1,
            }}
            transition={composerTransition}
          >
            {showSend ? (
              <button
                type="button"
                onClick={handleSend}
                className={`${actionButtonClass} text-blue-400 hover:text-blue-300`}
              >
                <IconSend size={20} />
              </button>
            ) : (
              <button
                type="button"
                onClick={handleVoiceClick}
                disabled={sendingVoice}
                className={`${actionButtonClass} ${
                  recording
                    ? 'text-red-400 hover:text-red-300 animate-pulse'
                    : 'text-white/70 hover:text-white'
                } disabled:opacity-50`}
                aria-label={recording ? 'Stop and send voice message' : 'Record voice message'}
              >
                <IconMicrophone size={20} />
              </button>
            )}
          </motion.div>
        </div>
        )}
      </div>
    </div>
  )
}
