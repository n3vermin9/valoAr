import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'
import PageTransition from './PageTransition'
import Discover from '../discover/Discover'
import ChatList from '../chat/ChatList'
import ChatRoom from '../chat/ChatRoom'
import LikedYou from '../liked/LikedYou'
import ProfileView from '../profile/ProfileView'
import DebugTools from '../debug/DebugTools'
import useNavTabSwipe, { NAV_TAB_PATHS, getNavTabIndex } from '../../hooks/useNavTabSwipe'

const SHOW_DEBUG_TOOLS = import.meta.env.DEV

function getRouteTransitionKey(pathname) {
  if (pathname.startsWith('/chats/') && pathname !== '/chats') return pathname
  if (SHOW_DEBUG_TOOLS && pathname.startsWith('/debug')) return '/debug'

  const index = getNavTabIndex(pathname)
  if (index !== null) return NAV_TAB_PATHS[index]
  // Fallback for unknown paths still under a tab prefix.
  const tab = NAV_TAB_PATHS.find((path) =>
    path === '/discover' ? pathname === path : pathname.startsWith(path)
  )
  return tab || pathname
}

export default function AnimatedNavRoutes() {
  const location = useLocation()
  const transitionKey = getRouteTransitionKey(location.pathname)
  const isChatRoom =
    location.pathname.startsWith('/chats/') && location.pathname !== '/chats'
  useNavTabSwipe()

  return (
    <div className="relative h-full overflow-hidden bg-[var(--ios-bg)]">
      <AnimatePresence mode="sync" initial={false}>
        <PageTransition key={transitionKey} disableTransform={isChatRoom}>
          <Routes location={location}>
            <Route path="/discover" element={<Discover />} />
            <Route path="/chats" element={<ChatList />} />
            <Route path="/chats/:matchId" element={<ChatRoom />} />
            <Route path="/liked" element={<LikedYou />} />
            <Route path="/profile" element={<ProfileView />} />
            {SHOW_DEBUG_TOOLS && <Route path="/debug" element={<DebugTools />} />}
            <Route path="*" element={<Navigate to="/discover" replace />} />
          </Routes>
        </PageTransition>
      </AnimatePresence>
    </div>
  )
}
