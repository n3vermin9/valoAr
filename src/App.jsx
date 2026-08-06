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
import CreateGroupPage from './components/chat/CreateGroupPage'
import GroupSettingsRoutes from './components/chat/groupSettings/GroupSettingsRoutes'
import StoryDeepLinkPage from './components/stories/StoryDeepLinkPage'
import { PageSkeleton } from './components/ui/Skeleton'
import Modal from './components/ui/Modal'
import DevAssistiveTouch from './components/debug/DevAssistiveTouch'
import { subscribeChats, getUnreadCount } from './services/chatService'
import { isChatFullyMuted } from './utils/chatMute'
import { subscribeLikesReceived } from './services/userService'
import { subscribeInbox } from './services/inboxService'
import { subscribeStoryComposerOpen } from './utils/storyOverlay'
import { subscribeProfileEditorOpen } from './utils/profileOverlay'
import { subscribeModalOverlayOpen } from './utils/modalOverlay'
import { subscribeMapModeOverlayOpen } from './utils/mapModeOverlay'

function AppLayout() {
  const { user } = useAuth()
  const location = useLocation()
  const [badges, setBadges] = useState({ unreadChats: 0, newLikes: 0, inboxUnread: 0 })
  const [storyComposerOpen, setStoryComposerOpenState] = useState(false)
  const [profileEditorOpen, setProfileEditorOpenState] = useState(false)
  const [modalOverlayOpen, setModalOverlayOpenState] = useState(false)
  const [mapModeOverlayOpen, setMapModeOverlayOpenState] = useState(false)

  useEffect(() => {
    return subscribeStoryComposerOpen(setStoryComposerOpenState)
  }, [])

  useEffect(() => {
    return subscribeProfileEditorOpen(setProfileEditorOpenState)
  }, [])

  useEffect(() => {
    return subscribeModalOverlayOpen(setModalOverlayOpenState)
  }, [])

  useEffect(() => {
    return subscribeMapModeOverlayOpen(setMapModeOverlayOpenState)
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
    profileEditorOpen ||
    modalOverlayOpen ||
    mapModeOverlayOpen

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
  const location = useLocation()
  const { user } = useAuth()

  if (!user) return <Navigate to="/login" />

  const closeProfile = () => {
    const returnTo = location.state?.returnTo
    if (returnTo && returnTo !== location.pathname) {
      navigate(returnTo, { replace: true })
      return
    }
    if (window.history.length > 1) {
      navigate(-1)
      return
    }
    navigate('/discover', { replace: true })
  }

  return (
    <Modal isOpen onClose={closeProfile} fullscreen>
      <PublicProfileView userId={userId} onClose={closeProfile} />
    </Modal>
  )
}

export default function App() {
  const { user, profile, loading } = useAuth()
  const location = useLocation()
  const rawFrom = location.state?.from
  const postAuthTo =
    typeof rawFrom === 'string' && rawFrom.startsWith('/') && !rawFrom.startsWith('//')
      ? rawFrom
      : undefined
  const authedHome = profile?.username ? postAuthTo || '/discover' : '/setup'

  return (
    <>
      {loading ? (
        <div className="h-full">
          <PageSkeleton />
        </div>
      ) : (
    <Routes>
      <Route
        path="/login"
        element={
          !user ? (
            <Login />
          ) : (
            <Navigate
              to={authedHome}
              replace
              state={postAuthTo ? { from: postAuthTo } : undefined}
            />
          )
        }
      />
      <Route
        path="/register"
        element={
          !user ? (
            <Register />
          ) : (
            <Navigate
              to={profile?.username ? postAuthTo || '/setup' : '/setup'}
              replace
              state={postAuthTo ? { from: postAuthTo } : undefined}
            />
          )
        }
      />
      <Route
        path="/setup"
        element={
          !user ? (
            <Navigate to="/login" replace state={{ from: postAuthTo }} />
          ) : profile?.username ? (
            <Navigate to={postAuthTo || '/discover'} replace />
          ) : (
            <div className="h-full min-h-0 overflow-hidden bg-[var(--ios-bg)]">
              <ProfileSetup />
            </div>
          )
        }
      />
      <Route path="/profile/:userId" element={<PublicProfileRoute />} />
      <Route path="/story/:ownerId/:storyId" element={<StoryDeepLinkPage />} />
      <Route
        path="/join/:inviteCode"
        element={
          user ? (
            profile?.username ? (
              <GroupJoinPage />
            ) : (
              <Navigate to="/setup" state={{ from: location.pathname }} />
            )
          ) : (
            <Navigate to="/login" state={{ from: location.pathname }} />
          )
        }
      />
      <Route
        path="/groups/new"
        element={
          user ? (
            profile?.username ? (
              <CreateGroupPage />
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
      )}
      <DevAssistiveTouch />
    </>
  )
}
