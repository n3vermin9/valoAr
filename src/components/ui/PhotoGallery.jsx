import { createPortal } from 'react-dom'
import PhotoHeroView from './PhotoHeroView'

export default function PhotoGallery({ photos = [], initialIndex = 0, onClose }) {
  const validPhotos = photos.filter(Boolean)
  if (!validPhotos.length) return null

  return createPortal(
    <PhotoHeroView
      photos={validPhotos}
      initialIndex={initialIndex}
      onBack={onClose}
      showEmbeddedBack
      fullscreen
    />,
    document.body
  )
}
