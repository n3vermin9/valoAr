import { forwardRef, useCallback, useEffect, useLayoutEffect, useRef } from 'react'
import { getAppleEmojiUrl, splitTextAndEmojis } from '../../utils/iosEmoji'

function escapeHtml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function valueToHtml(value, multiline) {
  if (!value) return ''

  return splitTextAndEmojis(value)
    .map((segment) => {
      if (segment.type === 'emoji') {
        const url = getAppleEmojiUrl(segment.value)
        return `<img src="${url}" alt="${escapeHtml(segment.value)}" data-emoji="${escapeHtml(segment.value)}" class="ios-emoji-inline" draggable="false" />`
      }
      const text = escapeHtml(segment.value)
      return multiline ? text.replace(/\n/g, '<br>') : text.replace(/\n/g, ' ')
    })
    .join('')
}

export function domToValue(root, multiline = true) {
  if (!root) return ''

  let value = ''

  const walk = (node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      value += node.textContent
      return
    }

    if (node.nodeName === 'BR') {
      if (multiline) value += '\n'
      return
    }

    if (node.nodeName === 'IMG') {
      value += node.dataset.emoji || node.alt || ''
      return
    }

    node.childNodes.forEach(walk)
  }

  root.childNodes.forEach(walk)
  return multiline ? value : value.replace(/\n/g, ' ')
}

function isVisuallyEmpty(value) {
  // Ignore zero-width chars / lone newlines browsers leave in contentEditable.
  return !String(value || '').replace(/[\u200b\n\r]/g, '')
}

function syncEmptyDom(el, nextValue) {
  if (!el) return
  const empty = isVisuallyEmpty(nextValue)
  el.classList.toggle('is-empty', empty)
  // Browsers leave a <br> or zero-width text after clearing contentEditable,
  // which breaks :empty placeholder styling — wipe those remnants.
  if (empty && el.innerHTML !== '') {
    el.innerHTML = ''
  }
}

const IosEmojiField = forwardRef(function IosEmojiField(
  {
    value = '',
    onChange,
    onInput,
    onFocus,
    onBlur,
    onKeyDown,
    className = '',
    placeholder,
    multiline = false,
    maxLength,
    ...props
  },
  ref
) {
  const innerRef = useRef(null)
  const composingRef = useRef(false)

  const setRefs = (node) => {
    innerRef.current = node
    if (typeof ref === 'function') ref(node)
    else if (ref) ref.current = node
  }

  const emitChange = useCallback(() => {
    const el = innerRef.current
    if (!el) return

    let next = domToValue(el, multiline)
    if (maxLength != null && next.length > maxLength) {
      next = next.slice(0, maxLength)
      el.innerHTML = valueToHtml(next, multiline)
    }

    syncEmptyDom(el, next)
    onChange?.({ target: { value: next } })
    onInput?.({ target: { value: next } })
  }, [maxLength, multiline, onChange, onInput])

  useLayoutEffect(() => {
    const el = innerRef.current
    if (!el || composingRef.current) return

    const current = domToValue(el, multiline)
    if (current !== value) {
      el.innerHTML = valueToHtml(value, multiline)
    }
    syncEmptyDom(el, value)
  }, [multiline, value])

  useEffect(() => {
    const el = innerRef.current
    if (!el) return
    if (!el.innerHTML && !isVisuallyEmpty(value)) {
      el.innerHTML = valueToHtml(value, multiline)
    }
    syncEmptyDom(el, value)
  }, [multiline, value])

  const handlePaste = (event) => {
    event.preventDefault()
    const pasted = event.clipboardData.getData('text/plain')
    const selection = window.getSelection()
    if (!selection?.rangeCount) return

    selection.deleteFromDocument()
    selection.getRangeAt(0).insertNode(document.createTextNode(pasted))
    selection.collapseToEnd()
    emitChange()
  }

  const editable = !(props.readOnly || props.disabled)

  return (
    <div
      {...props}
      ref={setRefs}
      contentEditable={editable}
      suppressContentEditableWarning
      role="textbox"
      tabIndex={editable ? 0 : -1}
      enterKeyHint={multiline ? 'enter' : 'done'}
      inputMode="text"
      aria-multiline={multiline || undefined}
      aria-placeholder={placeholder}
      data-placeholder={placeholder}
      data-allow-copy
      className={`ios-emoji-field outline-none ${isVisuallyEmpty(value) ? 'is-empty' : ''} ${className}`}
      onInput={() => {
        if (composingRef.current) return
        emitChange()
      }}
      onPaste={handlePaste}
      onFocus={onFocus}
      onBlur={onBlur}
      onKeyDown={(event) => {
        if (!multiline && event.key === 'Enter') {
          event.preventDefault()
        }
        onKeyDown?.(event)
      }}
      onCompositionStart={() => {
        composingRef.current = true
      }}
      onCompositionEnd={() => {
        composingRef.current = false
        emitChange()
      }}
    />
  )
})

export default IosEmojiField
