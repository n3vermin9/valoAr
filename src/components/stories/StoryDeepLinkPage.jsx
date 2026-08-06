import { useLocation, useNavigate, useParams, Navigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import ChatStoryViewer from './ChatStoryViewer'

/**
 * Deep-link entry for story share URLs: /story/:ownerId/:storyId
 */
export default function StoryDeepLinkPage() {
  const { ownerId, storyId } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const { user, profile } = useAuth()
  const storyPath =
    ownerId && storyId ? `/story/${ownerId}/${storyId}` : location.pathname

  if (!user) {
    return <Navigate to="/login" replace state={{ from: storyPath }} />
  }
  if (!profile?.username) {
    return <Navigate to="/setup" replace state={{ from: storyPath }} />
  }

  if (!ownerId || !storyId) {
    return <Navigate to="/chats" replace />
  }

  const close = () => {
    const returnTo = location.state?.returnTo
    if (returnTo && returnTo !== location.pathname) {
      navigate(returnTo, { replace: true })
      return
    }
    if (window.history.length > 1) {
      navigate(-1)
      return
    }
    navigate('/chats', { replace: true })
  }

  return (
    <div className="fixed inset-0 z-[100] bg-black">
      <ChatStoryViewer ownerId={ownerId} storyId={storyId} onClose={close} />
    </div>
  )
}
