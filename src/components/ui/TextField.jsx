import { forwardRef } from 'react'
import { textFieldClass } from '../../utils/designSystem'
import { allowAutofocus } from '../../utils/iosInput'
import { createSanitizedChangeHandler, handleInputFocusCursor } from '../../utils/inputHelpers'

/**
 * Native <input>/<textarea> — required for the iOS system keyboard.
 * (contentEditable TextField was blocked by WebKit + global user-select:none.)
 */
const TextField = forwardRef(function TextField(
  {
    className = '',
    sanitize,
    onChange,
    onFocus,
    autoFocus = false,
    multiline = false,
    ...props
  },
  ref
) {
  const handleChange = sanitize
    ? createSanitizedChangeHandler((next) => {
        onChange?.({ target: { value: next } })
      }, sanitize)
    : onChange

  const shared = {
    ref,
    className: `${textFieldClass} ${className}`,
    onChange: handleChange,
    autoFocus: Boolean(autoFocus && allowAutofocus()),
    onFocus: (event) => {
      handleInputFocusCursor(event)
      onFocus?.(event)
    },
    ...props,
  }

  if (multiline) {
    return <textarea {...shared} />
  }

  return <input {...shared} />
})

export default TextField
