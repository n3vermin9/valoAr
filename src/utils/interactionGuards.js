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
    'gesturestart',
    (e) => {
      e.preventDefault()
    },
    { passive: false }
  )

  let lastTouchEnd = 0
  document.addEventListener(
    'touchend',
    (e) => {
      const now = Date.now()
      if (now - lastTouchEnd <= 300) {
        e.preventDefault()
      }
      lastTouchEnd = now
    },
    { passive: false }
  )
}
