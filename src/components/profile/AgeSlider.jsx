import { useState, useRef } from 'react'
import { motion } from 'framer-motion'
import toast from 'react-hot-toast'

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

  return (
    <div className="py-6">
      <div className="text-center mb-6">
        <motion.span
          key={value}
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="text-5xl font-bold text-blue-500"
        >
          {value}
        </motion.span>
        <p className="text-white/50 mt-1">years old</p>
      </div>

      <div
        ref={trackRef}
        className="relative h-12 mx-4 cursor-pointer touch-none select-none"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
      >
        <div className="absolute inset-y-0 left-0 right-0 flex items-center">
          <div className="w-full h-1 bg-white/20 rounded-full" />
        </div>
        <div
          className="absolute inset-y-0 left-0 flex items-center pointer-events-none"
          style={{ width: `${percentage}%` }}
        >
          <div className="w-full h-1 bg-blue-500 rounded-full" />
        </div>
        <motion.div
          className="absolute top-1/2 -translate-y-1/2 w-8 h-8 bg-white rounded-full shadow-lg border-2 border-blue-500"
          style={{ left: `calc(${percentage}% - 16px)` }}
          animate={{ scale: dragging ? 1.2 : 1 }}
        />
        <div className="absolute -bottom-6 left-0 right-0 flex justify-between text-xs text-white/40 px-1">
          <span>{min}</span>
          <span>{max}</span>
        </div>
      </div>
    </div>
  )
}
