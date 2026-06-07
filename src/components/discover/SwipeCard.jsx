import { motion, useMotionValue, useTransform, animate } from 'framer-motion'
import { IconHeart, IconX, IconMessageCircle } from '@tabler/icons-react'
import { sad } from '../../assets'
import ProfileLookingFor from '../profile/ProfileLookingFor'
import SocialLinksDisplay from '../profile/SocialLinksDisplay'

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
  const friendCount = profile.matches?.length || 0

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
      <div className="relative h-full flex flex-col rounded-3xl overflow-hidden bg-white/5 border border-white/10 shadow-2xl">
        <img
          src={profile.photos?.[0] || sad}
          alt=""
          draggable={false}
          className="w-full h-[52%] shrink-0 object-cover cursor-pointer"
          onClick={() => onViewProfile?.(profile)}
        />

        <motion.div
          style={{ opacity: likeOpacity }}
          className="absolute top-8 left-8 px-4 py-2 border-4 border-green-500 rounded-lg rotate-[-15deg] pointer-events-none"
        >
          <span className="text-green-500 font-bold text-2xl">ADD</span>
        </motion.div>
        <motion.div
          style={{ opacity: passOpacity }}
          className="absolute top-8 right-8 px-4 py-2 border-4 border-red-500 rounded-lg rotate-[15deg] pointer-events-none"
        >
          <span className="text-red-500 font-bold text-2xl">NOPE</span>
        </motion.div>

        <div className="flex-1 min-h-0 px-5 pt-3 pb-24 overflow-y-auto">
          <button type="button" onClick={() => onViewProfile?.(profile)} className="text-left">
            <h3 className="text-2xl font-bold">
              {profile.username}, {profile.age}
            </h3>
          </button>

          <p className="text-sm text-white/70 mt-2 leading-relaxed line-clamp-3">
            {profile.bio?.trim() || 'No bio yet'}
          </p>

          <ProfileLookingFor
            gender={profile.gender}
            interestedIn={profile.interestedIn}
            className="text-sm text-white/50 mt-2"
          />

          {profile.showFriendCount !== false && (
            <p className="text-xs text-white/45 mt-2">
              Has {friendCount} {friendCount === 1 ? 'friend' : 'friends'}
            </p>
          )}

          <SocialLinksDisplay socials={profile.socials} compact />
        </div>

        <div className="absolute bottom-6 left-0 right-0 flex justify-center gap-6">
          <button
            type="button"
            onClick={() => onSwipe('pass')}
            disabled={alreadyMatched}
            className="w-14 h-14 rounded-full bg-white/10 hover:bg-red-500/20 flex items-center justify-center border border-white/10 transition-colors disabled:opacity-40"
          >
            <IconX size={28} className="text-red-400" />
          </button>
          <button
            type="button"
            onClick={onLikeWithMessage}
            disabled={alreadyLikedYou || alreadyMatched}
            className="w-14 h-14 rounded-full bg-white/10 hover:bg-blue-500/20 flex items-center justify-center border border-white/10 transition-colors disabled:opacity-40"
            title={
              alreadyMatched
                ? 'Already friends'
                : alreadyLikedYou
                  ? 'They already sent a request — check Friend Requests'
                  : 'Send friend request with message'
            }
          >
            <IconMessageCircle size={28} className="text-blue-400" />
          </button>
          <button
            type="button"
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
