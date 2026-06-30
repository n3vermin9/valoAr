const listeners = new Set()

export function setProfileEditorOpen(open) {
  listeners.forEach((listener) => listener(open))
}

export function subscribeProfileEditorOpen(listener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}
