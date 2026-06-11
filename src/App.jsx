import { useState, useEffect } from 'react'
import { Routes, Route, Navigate, useLocation, useParams, useNavigate } from 'react-router-dom'
import { useAuth } from './contexts/AuthContext'
import BottomNav from './components/layout/BottomNav'
import Login from './components/auth/Login'
import Register from './components/auth/Register'
import ProfileSetup from './components/profile/ProfileSetup'
import ProfileView, { PublicProfileView } from './components/profile/ProfileView'
import Discover from './components/discover/Discover'
import LikedYou from './components/liked/LikedYou'
import ChatList from './components/chat/ChatList'
import ChatRoom from './components/chat/ChatRoom'
import ChatNotifications from './components/chat/ChatNotifications'
import DebugTools from './components/debug/DebugTools'
import LoadingSpinner from './components/ui/LoadingSpinner'
import Modal from './components/ui/Modal'
import { subscribeChats, getUnreadCount } from './services/chatService'
import { subscribeLikesReceived } from './services/userService'

function AppLayout() {
  const { user } = useAuth()
  const location = useLocation()
  const [badges, setBadges] = useState({ unreadChats: 0, newLikes: 0 })

  useEffect(() => {
    if (!user?.uid) return

    const unsubChats = subscribeChats(user.uid, (chats) => {
      const unread = chats.reduce((sum, chat) => {
        if (chat.mutedBy?.includes(user.uid)) return sum
        return sum + getUnreadCount(chat, user.uid)
      }, 0)
      setBadges((b) => ({ ...b, unreadChats: unread }))
    })

    const unsubLikes = subscribeLikesReceived(user.uid, (likes) => {
      setBadges((b) => ({ ...b, newLikes: likes.filter((l) => !l.read).length }))
    })

    return () => {
      unsubChats()
      unsubLikes()
    }
  }, [user?.uid])

  const hideNav = location.pathname.startsWith('/chats/') && location.pathname !== '/chats'

  return (
    <div className="h-full">
      <ChatNotifications />
      <div className="h-full">
        <Routes location={location}>
          <Route path="/discover" element={<Discover />} />
          <Route path="/chats" element={<ChatList />} />
          <Route path="/chats/:matchId" element={<ChatRoom />} />
          <Route path="/liked" element={<LikedYou />} />
          <Route path="/profile" element={<ProfileView />} />
          <Route path="/debug" element={<DebugTools />} />
          <Route path="*" element={<Navigate to="/discover" replace />} />
        </Routes>
      </div>
      {!hideNav && <BottomNav badges={badges} />}
    </div>
  )
}

function PublicProfileRoute() {
  const { userId } = useParams()
  const navigate = useNavigate()
  const { user } = useAuth()

  if (!user) return <Navigate to="/login" />

  return (
    <Modal isOpen onClose={() => navigate('/discover')} fullscreen>
      <PublicProfileView userId={userId} onClose={() => navigate('/discover')} />
    </Modal>
  )
}

export default function App() {
  const { user, profile, loading } = useAuth()

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <LoadingSpinner />
      </div>
    )
  }

  return (
    <Routes>
      <Route
        path="/login"
        element={!user ? <Login /> : <Navigate to={profile?.username ? '/discover' : '/setup'} />}
      />
      <Route path="/register" element={!user ? <Register /> : <Navigate to="/setup" />} />
      <Route
        path="/setup"
        element={user && !profile?.username ? <ProfileSetup /> : <Navigate to="/discover" />}
      />
      <Route path="/profile/:userId" element={<PublicProfileRoute />} />
      <Route
        path="/*"
        element={
          user ? (
            profile?.username ? (
              <AppLayout />
            ) : (
              <Navigate to="/setup" />
            )
          ) : (
            <Navigate to="/login" />
          )
        }
      />
    </Routes>
  )
}
