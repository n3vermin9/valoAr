import { useState, useRef } from 'react'
import { motion } from 'framer-motion'

export default function AgeSlider({ value, onChange, min = 18, max = 40 }) {
  const trackRef = useRef(null)
  const [dragging, setDragging] = useState(false)

  const updateFromClientX = (clientX) => {
    if (!trackRef.current) return
    const rect = trackRef.current.getBoundingClientRect()
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
    const age = Math.round(min + ratio * (max - min))
    onChange(age)
  }

  const handlePointerDown = (e) => {
    setDragging(true)
    updateFromClientX(e.clientX)
    e.target.setPointerCapture?.(e.pointerId)
  }

  const handlePointerMove = (e) => {
    if (dragging) updateFromClientX(e.clientX)
  }

  const handlePointerUp = () => setDragging(false)

  const percentage = ((value - min) / (max - min)) * 100
  const thumbOffset = 10

  return (
    <div className="py-1">
      <p className="text-[14px] text-[var(--ios-label-secondary)] text-center mb-1">Years old</p>
      <div className="flex justify-center mb-2">
        <motion.span
          key={value}
          initial={{ scale: 0.92, opacity: 0.6 }}
          animate={{ scale: 1, opacity: 1 }}
          className="text-[24px] font-semibold text-[var(--ios-blue)] tabular-nums"
        >
          {value}
        </motion.span>
      </div>

      <div
        ref={trackRef}
        className="relative h-5 mx-1 mb-4 cursor-pointer touch-none select-none"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
      >
        <div className="absolute inset-0 flex items-center">
          <div className="w-full h-4 bg-white/20 rounded-full" />
        </div>
        <div
          className="absolute inset-y-0 left-0 flex items-center pointer-events-none overflow-hidden rounded-full"
          style={{ width: `${percentage}%` }}
        >
          <div className="w-full h-4 bg-[var(--ios-blue)] rounded-full" />
        </div>
        <motion.div
          className="absolute top-1/2 -translate-y-1/2 w-5 h-5 bg-white rounded-full shadow-md border-2 border-[var(--ios-blue)]"
          style={{ left: `calc(${percentage}% - ${thumbOffset}px)` }}
          animate={{ scale: dragging ? 1.12 : 1 }}
        />
        <div className="absolute top-full mt-1.5 left-0 right-0 flex justify-between text-[11px] text-white/40 px-0.5">
          <span>{min}</span>
          <span>{max}</span>
        </div>
      </div>
    </div>
  )
}
