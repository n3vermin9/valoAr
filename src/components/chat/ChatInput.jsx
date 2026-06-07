import { useState, useRef, useEffect, useCallback } from 'react'
import EmojiPicker from 'emoji-picker-react'
import toast from 'react-hot-toast'
import { IconMoodSmile, IconPhoto, IconSend, IconMicrophone } from '@tabler/icons-react'
import { getVoiceMimeType } from '../../utils/helpers'

const glassClass =
  'border border-white/[0.06] bg-white/[0.08] backdrop-blur-md shadow-[0_8px_32px_rgba(0,0,0,0.3),inset_0_1px_0_rgba(255,255,255,0.2)]'

const actionButtonClass = `${glassClass} h-11 w-11 shrink-0 flex items-center justify-center rounded-full transition-colors`

const MAX_VOICE_SECONDS = 180
const MIN_VOICE_BYTES = 200
const VOICE_TIMESLICE_MS = 250

export default function ChatInput({
  onSend,
  onSendVoice,
  onTyping,
  imagePreview,
  onImageSelect,
  onClearImage,
  focusKey,
}) {
  const [text, setText] = useState('')
  const [showEmoji, setShowEmoji] = useState(false)
  const [recording, setRecording] = useState(false)
  const [recordingSeconds, setRecordingSeconds] = useState(0)
  const [sendingVoice, setSendingVoice] = useState(false)
  const emojiRef = useRef(null)
  const fileRef = useRef(null)
  const textareaRef = useRef(null)
  const mediaRecorderRef = useRef(null)
  const streamRef = useRef(null)
  const chunksRef = useRef([])
  const timerRef = useRef(null)
  const finishingRef = useRef(false)

  const showSend = Boolean(text.trim() || imagePreview)

  const releaseStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
  }, [])

  const resetRecordingState = useCallback(() => {
    clearInterval(timerRef.current)
    timerRef.current = null
    mediaRecorderRef.current = null
    finishingRef.current = false
    setRecording(false)
    setRecordingSeconds(0)
  }, [])

  const cancelRecording = useCallback(() => {
    const recorder = mediaRecorderRef.current
    if (recorder && recorder.state !== 'inactive') {
      recorder.onstop = () => {
        chunksRef.current = []
        releaseStream()
        resetRecordingState()
      }
      try {
        recorder.stop()
      } catch {
        chunksRef.current = []
        releaseStream()
        resetRecordingState()
      }
      return
    }
    chunksRef.current = []
    releaseStream()
    resetRecordingState()
  }, [releaseStream, resetRecordingState])

  const finishRecording = useCallback(
    async (send) => {
      if (finishingRef.current) return

      const recorder = mediaRecorderRef.current
      if (!recorder || recorder.state === 'inactive') {
        if (!send) cancelRecording()
        return
      }

      finishingRef.current = true
      clearInterval(timerRef.current)
      timerRef.current = null

      const mimeType = recorder.mimeType || getVoiceMimeType() || 'audio/webm'

      const blob = await new Promise((resolve) => {
        recorder.onstop = () => {
          const recorded = new Blob(chunksRef.current, { type: mimeType })
          chunksRef.current = []
          resolve(recorded)
        }
        try {
          if (typeof recorder.requestData === 'function') {
            recorder.requestData()
          }
          recorder.stop()
        } catch {
          resolve(new Blob([], { type: mimeType }))
        }
      })

      releaseStream()
      mediaRecorderRef.current = null
      setRecording(false)
      setRecordingSeconds(0)
      finishingRef.current = false

      if (!send) return

      if (blob.size < MIN_VOICE_BYTES) {
        toast.error('Recording too short')
        return
      }

      setSendingVoice(true)
      try {
        await onSendVoice?.(blob)
      } catch (err) {
        toast.error(err?.message || 'Failed to send voice message')
      } finally {
        setSendingVoice(false)
      }
    },
    [cancelRecording, onSendVoice, releaseStream]
  )

  useEffect(() => {
    const timer = setTimeout(() => textareaRef.current?.focus(), 0)
    return () => clearTimeout(timer)
  }, [focusKey])

  useEffect(() => {
    return () => {
      cancelRecording()
    }
  }, [cancelRecording])

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (emojiRef.current && !emojiRef.current.contains(e.target)) {
        setShowEmoji(false)
      }
    }
    if (showEmoji) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showEmoji])

  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    const nextHeight = Math.min(el.scrollHeight, 128)
    el.style.height = `${nextHeight}px`
  }, [text])

  useEffect(() => {
    if (!recording) return
    if (text.trim()) {
      cancelRecording()
    }
  }, [text, recording, cancelRecording])

  useEffect(() => {
    if (recording && recordingSeconds >= MAX_VOICE_SECONDS) {
      finishRecording(true)
    }
  }, [recording, recordingSeconds, finishRecording])

  const startRecording = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      toast.error('Voice recording is not supported in this browser')
      return
    }
    if (!MediaRecorder) {
      toast.error('Voice recording is not supported in this browser')
      return
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mimeType = getVoiceMimeType()
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
      chunksRef.current = []
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }
      streamRef.current = stream
      mediaRecorderRef.current = recorder
      recorder.start(VOICE_TIMESLICE_MS)
      setRecording(true)
      setRecordingSeconds(0)
      timerRef.current = setInterval(() => {
        setRecordingSeconds((seconds) => seconds + 1)
      }, 1000)
    } catch {
      toast.error('Microphone access denied')
      cancelRecording()
    }
  }

  const handleVoiceClick = () => {
    if (sendingVoice) return
    if (recording) {
      finishRecording(true)
      return
    }
    startRecording()
  }

  const handleSend = () => {
    if (!text.trim() && !imagePreview) return
    onSend({ text: text.trim(), imageUrl: imagePreview })
    setText('')
    onClearImage?.()
    setShowEmoji(false)
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
    <div className="relative">
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

      {showEmoji && (
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

      <div className="flex items-center gap-2 px-4 py-3">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className={`${actionButtonClass} text-white/70 hover:text-white`}
          disabled={recording || sendingVoice}
        >
          <IconPhoto size={22} />
        </button>
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

        <div className={`${glassClass} flex flex-1 items-center gap-1.5 rounded-[30px] pl-2 pr-3 py-2 min-h-11`}>
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
            placeholder={recording ? `Recording ${formatRecordingTime(recordingSeconds)}…` : 'Type a message...'}
            className="flex-1 min-w-0 py-0 pr-1 bg-transparent outline-none placeholder:text-white/40 resize-none overflow-y-auto leading-5 max-h-32"
            disabled={sendingVoice}
          />
        </div>

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
      </div>
    </div>
  )
}
