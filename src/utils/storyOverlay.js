const listeners = new Set()

export function setStoryComposerOpen(open) {
  listeners.forEach((listener) => listener(open))
}

export function subscribeStoryComposerOpen(listener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}
