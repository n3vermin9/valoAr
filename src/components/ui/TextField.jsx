import { textFieldClass } from '../../utils/designSystem'

export default function TextField({ className = '', ...props }) {
  return <input className={`${textFieldClass} ${className}`} {...props} />
}
