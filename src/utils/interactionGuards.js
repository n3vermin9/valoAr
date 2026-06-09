export function setupInteractionGuards() {
  document.addEventListener(
    'copy',
    (e) => {
      if (!e.target.closest('[data-allow-copy]')) {
        e.preventDefault()
      }
    },
    true
  )

  document.addEventListener(
    'cut',
    (e) => {
      if (!e.target.closest('[data-allow-copy]')) {
        e.preventDefault()
      }
    },
    true
  )

  document.addEventListener('contextmenu', (e) => {
    if (e.target.closest('[data-allow-contextmenu]')) return
    e.preventDefault()
  })

  document.addEventListener(
    'dragstart',
    (e) => {
      const tag = e.target?.tagName
      if (tag === 'IMG' || tag === 'SVG' || tag === 'VIDEO' || e.target?.closest('picture')) {
        e.preventDefault()
      }
    },
    true
  )

  const blockGesture = (e) => e.preventDefault()
  for (const type of ['gesturestart', 'gesturechange', 'gestureend']) {
    document.addEventListener(type, blockGesture, { passive: false })
  }

  document.addEventListener(
    'wheel',
    (e) => {
      if (e.ctrlKey) e.preventDefault()
    },
    { passive: false }
  )

  document.addEventListener(
    'touchmove',
    (e) => {
      if (e.touches.length > 1) e.preventDefault()
    },
    { passive: false }
  )
}
