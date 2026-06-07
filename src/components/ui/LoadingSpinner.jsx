import { star } from '../../assets'

export default function LoadingSpinner({ size = 'w-12 h-12' }) {
  return (
    <div className="flex items-center justify-center">
      <img src={star} alt="+" className={`${size} animate-spin`} />
    </div>
  )
}
