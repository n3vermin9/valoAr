import { useEffect, useId, useRef } from 'react'
import { useAppKeyboard } from './AppKeyboard'
import { allowAutofocus } from '../../utils/iosInput'
import { handleInputFocusCursor } from '../../utils/inputHelpers'
import { scrollFieldAboveKeyboard } from '../../utils/keyboardFocus'
import { compactInputClass, compactInputInnerClass } from '../../utils/designSystem'

/**
 * Text field that uses an in-app keyboard on iOS Safari/PWA (no system ↑↓ Done bar).
 * Falls back to a normal <input> on desktop and Capacitor.
 *
 * bare — render only the inner control (parent supplies affix chrome / border).
 */
export default function AppTextInput({
  value = '',
  onChange,
  placeholder = '',
  maxLength,
  className = '',
  label = 'Text',
  layout = 'text',
  autoFocus = false,
  disabled = false,
  bare = false,
  id: idProp,
  onKeyDown,
  autoCapitalize = 'off',
  autoCorrect = 'off',
  spellCheck = false,
  inputMode,
}) {
  const reactId = useId()
  const id = idProp || reactId
  const { enabled, open, activeId, close, patch } = useAppKeyboard()
  const inputRef = useRef(null)
  const active = activeId === id
  const focusOnMount = Boolean(autoFocus && allowAutofocus())

  const openSession = (el) => {
    open({
      id,
      value,
      onChange: (next) => onChange?.({ target: { value: next } }),
      maxLength,
      label,
      layout,
      element: el || inputRef.current,
    })
    window.setTimeout(() => {
      scrollFieldAboveKeyboard(el || inputRef.current, { extraPad: 300 })
    }, 40)
    window.setTimeout(() => {
      scrollFieldAboveKeyboard(el || inputRef.current, { extraPad: 300 })
    }, 220)
  }

  useEffect(() => {
    if (!enabled || !focusOnMount || disabled) return undefined
    const t = window.setTimeout(() => openSession(inputRef.current), 0)
    return () => window.clearTimeout(t)
    // intentionally only on mount for autofocus
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, focusOnMount])

  useEffect(() => {
    if (enabled && active) patch(id, { value })
  }, [enabled, active, id, value, patch])

  useEffect(() => {
    if (!enabled) return undefined
    return () => {
      if (activeId === id) close()
    }
  }, [enabled, activeId, id, close])

  if (!enabled) {
    if (layout === 'multiline' && !bare) {
      return (
        <textarea
          ref={inputRef}
          id={id}
          value={value}
          onChange={onChange}
          onFocus={handleInputFocusCursor}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          maxLength={maxLength}
          autoFocus={focusOnMount}
          disabled={disabled}
          autoCapitalize={autoCapitalize}
          autoCorrect={autoCorrect}
          spellCheck={spellCheck}
          className={`w-full px-5 py-3 bg-[var(--ios-fill-tertiary)] rounded-2xl border border-[var(--ios-hairline)] outline-none focus:border-[var(--ios-blue)] resize-none min-h-24 whitespace-pre-wrap text-[15px] text-[var(--ios-label)] placeholder:text-[var(--ios-label-tertiary)] ${className}`}
        />
      )
    }
    const nativeClass = bare
      ? `${compactInputInnerClass} ${className}`
      : `${compactInputClass} ${className}`
    return (
      <input
        ref={inputRef}
        id={id}
        value={value}
        onChange={onChange}
        onFocus={handleInputFocusCursor}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        maxLength={maxLength}
        autoFocus={focusOnMount}
        disabled={disabled}
        autoCapitalize={autoCapitalize}
        autoCorrect={autoCorrect}
        spellCheck={spellCheck}
        inputMode={inputMode}
        className={nativeClass}
      />
    )
  }

  const openKeyboard = (e) => {
    if (disabled) return
    openSession(e.currentTarget)
  }

  const display = value || ''
  const showPlaceholder = !display
  const softClass = bare
    ? `${compactInputInnerClass} flex items-center text-left ${className} ${
        showPlaceholder ? 'text-[var(--ios-label-tertiary)]' : ''
      }`
    : layout === 'multiline'
      ? `w-full px-5 py-3 min-h-24 rounded-2xl border border-[var(--ios-hairline)] bg-[var(--ios-fill-tertiary)] text-left text-[15px] whitespace-pre-wrap ${className} ${
          active ? '!border-[var(--ios-blue)]' : ''
        } ${showPlaceholder ? 'text-[var(--ios-label-tertiary)]' : 'text-[var(--ios-label)]'}`
      : `${compactInputClass} text-left ${className} ${
          active ? '!border-[var(--ios-blue)]' : ''
        } ${showPlaceholder ? 'text-[var(--ios-label-tertiary)]' : ''}`

  return (
    <button
      ref={inputRef}
      type="button"
      disabled={disabled}
      onClick={openKeyboard}
      aria-label={label}
      aria-expanded={active}
      data-app-keyboard-field="true"
      className={softClass}
    >
      <span
        className={`block w-full ${layout === 'multiline' ? 'whitespace-pre-wrap break-words' : 'truncate'}`}
      >
        {showPlaceholder ? placeholder : display}
      </span>
    </button>
  )
}
