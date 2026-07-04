export function handleInputFocusCursor(event) {
  const { target } = event
  requestAnimationFrame(() => {
    if (document.activeElement !== target) return
    const { value, selectionStart, selectionEnd } = target
    if (!value?.length) return
    if (selectionStart === 0 && selectionEnd === 0) {
      const len = value.length
      target.setSelectionRange(len, len)
    }
  })
}

export function createSanitizedChangeHandler(setValue, sanitize = (value) => value) {
  return (event) => {
    const { target } = event
    const { value, selectionStart = value.length, selectionEnd = value.length } = target
    const next = sanitize(value)
    const nextStart = sanitize(value.slice(0, selectionStart)).length
    const nextEnd = sanitize(value.slice(0, selectionEnd)).length
    setValue(next)
    requestAnimationFrame(() => {
      if (document.activeElement === target) {
        target.setSelectionRange(nextStart, nextEnd)
      }
    })
  }
}

export function focusInputAtEnd(element) {
  if (!element || element.disabled) return
  element.focus()
  const len = element.value?.length ?? 0
  element.setSelectionRange(len, len)
}

export function focusInputRefAtEnd(ref) {
  requestAnimationFrame(() => focusInputAtEnd(ref.current))
}
