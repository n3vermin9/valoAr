import { useState, useEffect } from 'react'
import { Routes, Route, Navigate, useLocation, useParams, useNavigate } from 'react-router-dom'
import { useAuth } from './contexts/AuthContext'
import BottomNav from './components/layout/BottomNav'
import AnimatedNavRoutes from './components/layout/AnimatedNavRoutes'
import Login from './components/auth/Login'
import Register from './components/auth/Register'
import ProfileSetup from './components/profile/ProfileSetup'
import { PublicProfileView } from './components/profile/ProfileView'
import ChatNotifications from './components/chat/ChatNotifications'
import GroupJoinPage from './components/chat/GroupJoinPage'
import GroupInfoView from './components/chat/GroupInfoView'
import GroupSettingsRoutes from './components/chat/groupSettings/GroupSettingsRoutes'
import LoadingSpinner from './components/ui/LoadingSpinner'
import Modal from './components/ui/Modal'
import { subscribeChats, getUnreadCount } from './services/chatService'
import { isChatFullyMuted } from './utils/chatMute'
import { subscribeLikesReceived } from './services/userService'
import { subscribeInbox } from './services/inboxService'
import { subscribeStoryComposerOpen } from './utils/storyOverlay'
import { subscribeProfileEditorOpen } from './utils/profileOverlay'

function AppLayout() {
  const { user } = useAuth()
  const location = useLocation()
  const [badges, setBadges] = useState({ unreadChats: 0, newLikes: 0, inboxUnread: 0 })
  const [storyComposerOpen, setStoryComposerOpenState] = useState(false)
  const [profileEditorOpen, setProfileEditorOpenState] = useState(false)

  useEffect(() => {
    return subscribeStoryComposerOpen(setStoryComposerOpenState)
  }, [])

  useEffect(() => {
    return subscribeProfileEditorOpen(setProfileEditorOpenState)
  }, [])

  useEffect(() => {
    if (!user?.uid) return

    const unsubChats = subscribeChats(user.uid, (chats) => {
      const unread = chats.reduce((sum, chat) => {
        if (isChatFullyMuted(chat, user.uid)) return sum
        return sum + getUnreadCount(chat, user.uid)
      }, 0)
      setBadges((b) => ({ ...b, unreadChats: unread }))
    })

    const unsubLikes = subscribeLikesReceived(user.uid, (likes) => {
      setBadges((b) => ({ ...b, newLikes: likes.filter((l) => !l.read).length }))
    })

    const unsubInbox = subscribeInbox(user.uid, (items) => {
      setBadges((b) => ({ ...b, inboxUnread: items.filter((i) => !i.read).length }))
    })

    return () => {
      unsubChats()
      unsubLikes()
      unsubInbox()
    }
  }, [user?.uid])

  const hideNav =
    (location.pathname.startsWith('/chats/') && location.pathname !== '/chats') ||
    location.pathname.startsWith('/groups/') ||
    storyComposerOpen ||
    profileEditorOpen

  return (
    <div className="h-full">
      <ChatNotifications />
      <div className="h-full overflow-hidden">
        <AnimatedNavRoutes />
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
        path="/join/:inviteCode"
        element={
          user ? (
            profile?.username ? (
              <GroupJoinPage />
            ) : (
              <Navigate to="/setup" />
            )
          ) : (
            <Navigate to="/login" />
          )
        }
      />
      <Route
        path="/groups/:chatId/settings/*"
        element={
          user ? (
            profile?.username ? (
              <GroupSettingsRoutes />
            ) : (
              <Navigate to="/setup" />
            )
          ) : (
            <Navigate to="/login" />
          )
        }
      />
      <Route
        path="/groups/:chatId"
        element={
          user ? (
            profile?.username ? (
              <GroupInfoView />
            ) : (
              <Navigate to="/setup" />
            )
          ) : (
            <Navigate to="/login" />
          )
        }
      />
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
