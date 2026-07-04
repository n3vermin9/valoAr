import { forwardRef } from 'react'
import { textFieldClass } from '../../utils/designSystem'
import { createSanitizedChangeHandler, handleInputFocusCursor } from '../../utils/inputHelpers'

const TextField = forwardRef(function TextField(
  { className = '', sanitize, onChange, onFocus, ...props },
  ref
) {
  const handleChange = sanitize
    ? createSanitizedChangeHandler((next) => {
        onChange?.({ target: { value: next } })
      }, sanitize)
    : onChange

  return (
    <input
      ref={ref}
      className={`${textFieldClass} ${className}`}
      onChange={handleChange}
      onFocus={(event) => {
        handleInputFocusCursor(event)
        onFocus?.(event)
      }}
      {...props}
    />
  )
})

export default TextField
