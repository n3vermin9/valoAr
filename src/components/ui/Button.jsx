import { btnFilledClass, btnFilledDangerClass, btnBorderedClass, btnPlainClass } from '../../utils/designSystem'

const variants = {
  filled: btnFilledClass,
  danger: btnFilledDangerClass,
  bordered: btnBorderedClass,
  plain: btnPlainClass,
}

export default function Button({
  variant = 'filled',
  className = '',
  fullWidth = false,
  children,
  ...props
}) {
  return (
    <button
      type="button"
      className={`${variants[variant] || variants.filled} ${fullWidth ? 'w-full' : ''} ${className}`}
      {...props}
    >
      {children}
    </button>
  )
}
