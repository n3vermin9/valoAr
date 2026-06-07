import { useState } from 'react'
import { motion, useMotionValue, useTransform, animate } from 'framer-motion'
import { IconHeart, IconX, IconMessageCircle } from '@tabler/icons-react'
import { sad } from '../../assets'

export default function SwipeCard({
  profile,
  onSwipe,
  onLikeWithMessage,
  alreadyLikedYou,
  alreadyMatched,
  onViewProfile,
}) {
  const x = useMotionValue(0)
  const rotate = useTransform(x, [-200, 200], [-15, 15])
  const likeOpacity = useTransform(x, [0, 100], [0, 1])
  const passOpacity = useTransform(x, [-100, 0], [1, 0])

  const handleDragEnd = (_, info) => {
    if (alreadyMatched) return
    if (info.offset.x > 100) {
      animate(x, 300, { duration: 0.3 }).then(() => onSwipe('like'))
    } else if (info.offset.x < -100) {
      animate(x, -300, { duration: 0.3 }).then(() => onSwipe('pass'))
    } else {
      animate(x, 0, { type: 'spring', stiffness: 300 })
    }
  }

  return (
    <motion.div
      className="absolute inset-4 cursor-grab active:cursor-grabbing"
      style={{ x, rotate }}
      drag="x"
      dragConstraints={{ left: 0, right: 0 }}
      dragElastic={0.9}
      onDragEnd={handleDragEnd}
    >
      <div className="relative h-full rounded-3xl overflow-hidden bg-white/5 border border-white/10 shadow-2xl">
        <img
          src={profile.photos?.[0] || sad}
          alt=""
          className="w-full h-[65%] object-cover"
          onClick={() => onViewProfile?.(profile)}
        />

        <motion.div
          style={{ opacity: likeOpacity }}
          className="absolute top-8 left-8 px-4 py-2 border-4 border-green-500 rounded-lg rotate-[-15deg]"
        >
          <span className="text-green-500 font-bold text-2xl">ADD</span>
        </motion.div>
        <motion.div
          style={{ opacity: passOpacity }}
          className="absolute top-8 right-8 px-4 py-2 border-4 border-red-500 rounded-lg rotate-[15deg]"
        >
          <span className="text-red-500 font-bold text-2xl">NOPE</span>
        </motion.div>

        <div className="p-5">
          <button onClick={() => onViewProfile?.(profile)} className="text-left">
            <h3 className="text-2xl font-bold">
              {profile.username},{' '}
              {profile.age}
            </h3>
          </button>
          {profile.bio && <p className="text-white/70 mt-2 line-clamp-2">{profile.bio}</p>}
        </div>

        <div className="absolute bottom-6 left-0 right-0 flex justify-center gap-6">
          <button
            onClick={() => onSwipe('pass')}
            disabled={alreadyMatched}
            className="w-14 h-14 rounded-full bg-white/10 hover:bg-red-500/20 flex items-center justify-center border border-white/10 transition-colors disabled:opacity-40"
          >
            <IconX size={28} className="text-red-400" />
          </button>
          <button
            onClick={onLikeWithMessage}
            disabled={alreadyLikedYou || alreadyMatched}
            className="w-12 h-12 rounded-full bg-white/10 hover:bg-blue-500/20 flex items-center justify-center border border-white/10 transition-colors disabled:opacity-40"
            title={
              alreadyMatched
                ? 'Already friends'
                : alreadyLikedYou
                  ? 'They already sent a request — check Friend Requests'
                  : 'Send friend request with message'
            }
          >
            <IconMessageCircle size={22} className="text-blue-400" />
          </button>
          <button
            onClick={() => onSwipe('like')}
            disabled={alreadyLikedYou || alreadyMatched}
            className="w-14 h-14 rounded-full bg-white/10 hover:bg-green-500/20 flex items-center justify-center border border-white/10 transition-colors disabled:opacity-40"
          >
            <IconHeart size={28} className="text-green-400" />
          </button>
        </div>
      </div>
    </motion.div>
  )
}
