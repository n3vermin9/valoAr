import { Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'
import PageTransition from './PageTransition'
import Discover from '../discover/Discover'
import ChatList from '../chat/ChatList'
import ChatRoom from '../chat/ChatRoom'
import LikedYou from '../liked/LikedYou'
import ProfileView from '../profile/ProfileView'
import DebugTools from '../debug/DebugTools'

const NAV_TAB_PATHS = ['/discover', '/chats', '/liked', '/profile']

function getNavTabIndex(pathname) {
  if (pathname.startsWith('/chats/') && pathname !== '/chats') return null
  if (pathname.startsWith('/debug')) return NAV_TAB_PATHS.length

  const index = NAV_TAB_PATHS.findIndex((path) =>
    path === '/discover' ? pathname === path : pathname.startsWith(path)
  )
  return index >= 0 ? index : 0
}

function getRouteTransitionKey(pathname) {
  if (pathname.startsWith('/chats/') && pathname !== '/chats') return pathname
  if (pathname.startsWith('/debug')) return '/debug'

  const index = getNavTabIndex(pathname)
  return index !== null ? NAV_TAB_PATHS[index] : pathname
}

function isChatRoomPath(pathname) {
  return pathname.startsWith('/chats/') && pathname !== '/chats'
}

export default function AnimatedNavRoutes() {
  const location = useLocation()
  const chatRoom = isChatRoomPath(location.pathname)
  const transitionKey = getRouteTransitionKey(location.pathname)

  return (
    <div className="relative h-full overflow-hidden bg-[var(--ios-bg)]">
      <AnimatePresence mode="sync" initial={false}>
        <PageTransition key={transitionKey} variant={chatRoom ? 'push' : 'tab'}>
          <Routes location={location}>
            <Route path="/discover" element={<Discover />} />
            <Route path="/chats" element={<ChatList />} />
            <Route path="/chats/:matchId" element={<ChatRoom />} />
            <Route path="/liked" element={<LikedYou />} />
            <Route path="/profile" element={<ProfileView />} />
            <Route path="/debug" element={<DebugTools />} />
            <Route path="*" element={<Navigate to="/discover" replace />} />
          </Routes>
        </PageTransition>
      </AnimatePresence>
    </div>
  )
}
