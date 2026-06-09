import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { useAuth } from '../../contexts/AuthContext'
import { logo } from '../../assets'
import { APP_NAME } from '../../utils/helpers'
import { generateRandomCredentials } from '../../utils/devAuth'
import LoadingSpinner from '../ui/LoadingSpinner'

export default function AuthLogo({ className = 'w-12 h-12 mb-4' }) {
  const { register } = useAuth()
  const navigate = useNavigate()
  const [busy, setBusy] = useState(false)

  const handleClick = async () => {
    if (busy) return
    setBusy(true)
    try {
      const { email, password } = generateRandomCredentials()
      await register(email, password)
      toast.success('Dev account created')
      navigate('/setup')
    } catch (err) {
      toast.error(err.message || 'Failed to create dev account')
    } finally {
      setBusy(false)
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={busy}
      title="Create dev account"
      className="cursor-pointer disabled:opacity-50"
    >
      {busy ? (
        <div className={`flex items-center justify-center ${className}`}>
          <LoadingSpinner size="w-8 h-8" />
        </div>
      ) : (
        <img src={logo} alt={APP_NAME} className={className} />
      )}
    </button>
  )
}
