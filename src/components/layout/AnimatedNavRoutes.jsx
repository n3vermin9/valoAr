import { useLayoutEffect } from 'react'
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

function isChatRoomPath(pathname) {
  return pathname.startsWith('/chats/') && pathname !== '/chats'
}

function chatMatchIdFromPath(pathname) {
  if (!isChatRoomPath(pathname)) return null
  return pathname.slice('/chats/'.length).split('/')[0] || null
}

function getRouteTransitionKey(pathname) {
  if (isChatRoomPath(pathname)) return pathname
  if (SHOW_DEBUG_TOOLS && pathname.startsWith('/debug')) return '/debug'

  const index = getNavTabIndex(pathname)
  if (index !== null) return NAV_TAB_PATHS[index]
  const tab = NAV_TAB_PATHS.find((path) =>
    path === '/discover' ? pathname === path : pathname.startsWith(path)
  )
  return tab || pathname
}

function hideChatPortals() {
  document.querySelectorAll('[data-chat-room-portal]').forEach((el) => {
    el.style.setProperty('display', 'none', 'important')
    el.style.setProperty('pointer-events', 'none', 'important')
    el.setAttribute('aria-hidden', 'true')
  })
}

/** Show portals for the active chat only — never touch opacity (avoids Framer blink). */
function syncChatPortals(matchId) {
  document.querySelectorAll('[data-chat-room-portal]').forEach((el) => {
    const portalMatch = el.getAttribute('data-chat-id')
    const belongsToActive = !matchId || !portalMatch || portalMatch === matchId
    if (belongsToActive) {
      el.style.removeProperty('display')
      el.style.removeProperty('visibility')
      el.style.removeProperty('pointer-events')
      el.removeAttribute('aria-hidden')
    } else {
      el.style.setProperty('display', 'none', 'important')
      el.style.setProperty('pointer-events', 'none', 'important')
      el.setAttribute('aria-hidden', 'true')
    }
  })
}

export default function AnimatedNavRoutes() {
  const location = useLocation()
  const transitionKey = getRouteTransitionKey(location.pathname)
  const isChatRoom = isChatRoomPath(location.pathname)
  const chatMatchId = chatMatchIdFromPath(location.pathname)
  useNavTabSwipe()

  // Sync before paint so portaled header is never CSS-hidden while in a chat.
  useLayoutEffect(() => {
    const root = document.documentElement
    root.classList.toggle('chat-room-route', isChatRoom)
    root.classList.toggle('chat-room-active', isChatRoom)
    if (isChatRoom) {
      syncChatPortals(chatMatchId)
    } else {
      hideChatPortals()
    }
  }, [isChatRoom, chatMatchId, location.pathname])

  useLayoutEffect(() => {
    return () => {
      const root = document.documentElement
      root.classList.remove('chat-room-route', 'chat-room-active')
      hideChatPortals()
    }
  }, [])

  const routes = (
    <Routes location={location}>
      <Route path="/discover" element={<Discover />} />
      <Route path="/chats" element={<ChatList />} />
      <Route path="/chats/:matchId" element={<ChatRoom />} />
      <Route path="/liked" element={<LikedYou />} />
      <Route path="/profile" element={<ProfileView />} />
      {SHOW_DEBUG_TOOLS && <Route path="/debug" element={<DebugTools />} />}
      <Route path="*" element={<Navigate to="/discover" replace />} />
    </Routes>
  )

  return (
    <div className="relative h-full overflow-hidden bg-[var(--ios-bg)]">
      <AnimatePresence mode="sync" initial={false}>
        {/*
          Chat uses opacity-only motion (no transform) so fixed/portaled layers stay correct.
          Portals are CSS-hidden as soon as we leave a chat route (see useLayoutEffect above),
          so the exit fade cannot leave a stuck header on the next page.
        */}
        <PageTransition key={transitionKey} disableTransform={isChatRoom}>
          {routes}
        </PageTransition>
      </AnimatePresence>
    </div>
  )
}
