import { useLocation, useNavigate } from 'react-router-dom'
import { useRef, useLayoutEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { IconFlame, IconMessage, IconInbox, IconUser } from '@tabler/icons-react'
import { navGlassClass, navGlassInnerClass } from '../../utils/designSystem'

const tabs = [
  { path: '/discover', icon: IconFlame, label: 'Discover' },
  { path: '/chats', icon: IconMessage, label: 'Chats', badgeKey: 'unreadChats' },
  { path: '/liked', icon: IconInbox, label: 'Inbox', badgeKey: 'inboxBadge' },
  { path: '/profile', icon: IconUser, label: 'Profile' },
]

const pillSpring = { type: 'spring', stiffness: 420, damping: 34 }
const tabSpring = { type: 'spring', stiffness: 480, damping: 24 }

export default function BottomNav({ badges = {} }) {
  const location = useLocation()
  const navigate = useNavigate()
  const activeIndex = tabs.findIndex((t) => location.pathname.startsWith(t.path))
  const containerRef = useRef(null)
  const tabRefs = useRef([])
  const [pill, setPill] = useState(null)

  useLayoutEffect(() => {
    if (activeIndex < 0) {
      setPill(null)
      return
    }

    const updatePill = () => {
      const container = containerRef.current
      const tab = tabRefs.current[activeIndex]
      if (!container || !tab) return

      const insetX = 4
      const insetY = 5
      const glowSpread = 8
      const containerRect = container.getBoundingClientRect()
      const tabRect = tab.getBoundingClientRect()

      const width = tabRect.width - insetX * 2
      const left = tabRect.left - containerRect.left + insetX

      setPill({
        width,
        height: tabRect.height - insetY,
        left,
        top: tabRect.top - containerRect.top + insetY / 2,
        glowLeft: left - glowSpread,
        glowWidth: width + glowSpread * 2,
      })
    }

    updatePill()
    window.addEventListener('resize', updatePill)
    return () => window.removeEventListener('resize', updatePill)
  }, [activeIndex, location.pathname])

  return (
    <nav
      className="fixed left-4 right-4 z-40"
      style={{ bottom: 'calc(var(--ios-safe-bottom) + var(--ios-nav-float-bottom))' }}
    >
      <div ref={containerRef} className={`relative overflow-visible ${navGlassClass}`}>
        <div
          className="absolute inset-0 nav-blur-sides rounded-full pointer-events-none overflow-hidden"
          aria-hidden
        />

        <div className="relative flex items-center justify-around px-2 py-2.5 overflow-hidden rounded-full">
          {pill && (
            <>
              <motion.div
                layoutId="nav-pill-glow-bottom"
                className="nav-pill-border-glow absolute pointer-events-none rounded-full"
                style={{
                  left: pill.glowLeft,
                  width: pill.glowWidth,
                  bottom: 2,
                  height: 1,
                }}
                transition={pillSpring}
              />
              <motion.div
                layoutId="nav-pill"
                className={`absolute pointer-events-none ${navGlassInnerClass}`}
                style={{
                  width: pill.width,
                  height: pill.height,
                  left: pill.left,
                  top: pill.top,
                }}
                transition={pillSpring}
              />
            </>
          )}

          {tabs.map((tab, index) => {
            const isActive = location.pathname.startsWith(tab.path)
            const Icon = tab.icon
            const count =
              tab.badgeKey === 'inboxBadge'
                ? (badges.newLikes || 0) + (badges.inboxUnread || 0)
                : badges[tab.badgeKey] || 0
            const isChatsTab = tab.path === '/chats'

            return (
              <motion.button
                key={tab.path}
                ref={(el) => {
                  tabRefs.current[index] = el
                }}
                type="button"
                onClick={() => navigate(tab.path)}
                onDoubleClick={() => {
                  if (isChatsTab) navigate('/debug')
                }}
                transition={{ type: 'spring', stiffness: 520, damping: 28 }}
                className="no-tap-scale relative flex-1 flex flex-col items-center justify-center py-3 z-10 min-h-[52px]"
                aria-label={tab.label}
                aria-current={isActive ? 'page' : undefined}
              >
                <motion.div
                  animate={{
                    scale: isActive ? 1.14 : 1,
                    y: isActive ? -2 : 0,
                  }}
                  transition={tabSpring}
                >
                  <Icon
                    size={26}
                    className={`transition-colors duration-200 ${
                      isActive ? 'text-white' : 'text-white/45'
                    }`}
                    stroke={1.75}
                  />
                </motion.div>
                {count > 0 && (
                  <motion.span
                    initial={{ scale: 0.6, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={tabSpring}
                    className="absolute top-1 right-1/4 min-w-[18px] h-[18px] bg-red-500 text-white text-xs rounded-full flex items-center justify-center px-1"
                  >
                    {count > 99 ? '99+' : count}
                  </motion.span>
                )}
              </motion.button>
            )
          })}
        </div>
      </div>
    </nav>
  )
}
