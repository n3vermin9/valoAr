const listeners = new Set()
let openCount = 0

export function setModalOverlayOpen(open) {
  openCount = open ? openCount + 1 : Math.max(0, openCount - 1)
  const visible = openCount > 0
  listeners.forEach((listener) => listener(visible))
}

export function subscribeModalOverlayOpen(listener) {
  listeners.add(listener)
  listener(openCount > 0)
  return () => listeners.delete(listener)
}
