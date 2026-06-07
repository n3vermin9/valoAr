import { useState, useRef, useEffect, useCallback } from 'react'
import { IconPlayerPlay, IconPlayerPause } from '@tabler/icons-react'

const WAVEFORM = [4, 7, 5, 9, 6, 8, 4, 10, 7, 5, 8, 6, 9, 4, 7, 5, 8, 6, 10, 5, 7, 4, 8, 6, 9, 5, 7, 4]

let stopOtherPlayback = null

function formatDuration(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00'
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${String(s).padStart(2, '0')}`
}

export default function VoiceMessagePlayer({ src, isOwn }) {
  const audioRef = useRef(null)
  const [playing, setPlaying] = useState(false)
  const [progress, setProgress] = useState(0)
  const [duration, setDuration] = useState(0)
  const [current, setCurrent] = useState(0)

  const stopSelf = useCallback(() => {
    const audio = audioRef.current
    if (!audio) return
    audio.pause()
    setPlaying(false)
  }, [])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return

    const onLoaded = () => {
      if (Number.isFinite(audio.duration)) {
        setDuration(audio.duration)
      }
    }

    const onTimeUpdate = () => {
      setCurrent(audio.currentTime)
      if (audio.duration > 0) {
        setProgress(audio.currentTime / audio.duration)
      }
    }

    const onEnded = () => {
      setPlaying(false)
      setProgress(0)
      setCurrent(0)
      audio.currentTime = 0
      if (stopOtherPlayback === stopSelf) stopOtherPlayback = null
    }

    audio.addEventListener('loadedmetadata', onLoaded)
    audio.addEventListener('durationchange', onLoaded)
    audio.addEventListener('timeupdate', onTimeUpdate)
    audio.addEventListener('ended', onEnded)

    if (audio.readyState >= 1) onLoaded()

    return () => {
      audio.removeEventListener('loadedmetadata', onLoaded)
      audio.removeEventListener('durationchange', onLoaded)
      audio.removeEventListener('timeupdate', onTimeUpdate)
      audio.removeEventListener('ended', onEnded)
      if (stopOtherPlayback === stopSelf) stopOtherPlayback = null
    }
  }, [src, stopSelf])

  const togglePlay = async () => {
    const audio = audioRef.current
    if (!audio) return

    if (playing) {
      stopSelf()
      if (stopOtherPlayback === stopSelf) stopOtherPlayback = null
      return
    }

    if (stopOtherPlayback && stopOtherPlayback !== stopSelf) {
      stopOtherPlayback()
    }
    stopOtherPlayback = stopSelf

    try {
      await audio.play()
      setPlaying(true)
    } catch {
      setPlaying(false)
    }
  }

  const seek = (e) => {
    const audio = audioRef.current
    if (!audio || !audio.duration) return
    const rect = e.currentTarget.getBoundingClientRect()
    const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width))
    audio.currentTime = ratio * audio.duration
    setProgress(ratio)
    setCurrent(audio.currentTime)
  }

  const playBtnClass = isOwn
    ? 'bg-white/20 hover:bg-white/30 text-white'
    : 'bg-white/10 hover:bg-white/15 text-white'

  const barBase = isOwn ? 'bg-white/35' : 'bg-white/30'
  const barActive = isOwn ? 'bg-white' : 'bg-white/90'

  const timeClass = isOwn ? 'text-white/70' : 'text-white/55'

  return (
    <div className="flex items-center gap-2.5 min-w-[200px] max-w-[240px] select-none">
      <button
        type="button"
        onClick={togglePlay}
        className={`h-9 w-9 shrink-0 flex items-center justify-center rounded-full transition-colors ${playBtnClass}`}
        aria-label={playing ? 'Pause voice message' : 'Play voice message'}
      >
        {playing ? <IconPlayerPause size={18} fill="currentColor" /> : <IconPlayerPlay size={18} fill="currentColor" />}
      </button>

      <button
        type="button"
        onClick={seek}
        className="flex-1 flex items-end gap-[2px] h-7 min-w-0 cursor-pointer"
        aria-label="Seek voice message"
      >
        {WAVEFORM.map((height, i) => {
          const filled = (i + 1) / WAVEFORM.length <= progress
          return (
            <span
              key={i}
              className={`w-[3px] rounded-full transition-colors duration-150 ${filled ? barActive : barBase} ${
                playing && filled ? 'opacity-100' : ''
              }`}
              style={{ height: `${height + 6}px` }}
            />
          )
        })}
      </button>

      <span className={`text-[11px] tabular-nums shrink-0 w-9 text-right ${timeClass}`}>
        {formatDuration(playing || current > 0 ? current : duration)}
      </span>

      <audio ref={audioRef} src={src} preload="metadata" className="hidden" />
    </div>
  )
}
