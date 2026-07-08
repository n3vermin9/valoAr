const listeners = new Set()
let open = false

export function setMapModeOverlayOpen(nextOpen) {
  open = Boolean(nextOpen)
  listeners.forEach((listener) => listener(open))
}

export function subscribeMapModeOverlayOpen(listener) {
  listeners.add(listener)
  listener(open)
  return () => listeners.delete(listener)
}
