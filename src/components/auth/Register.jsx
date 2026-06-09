import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { useAuth } from '../../contexts/AuthContext'
import AuthLogo from './AuthLogo'
import { APP_NAME } from '../../utils/helpers'
import LoadingSpinner from '../ui/LoadingSpinner'

export default function Register() {
  const { register } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (password.length < 6) {
      toast.error('Password must be at least 6 characters')
      return
    }
    setLoading(true)
    try {
      await register(email, password)
      toast.success('Account created!')
      navigate('/setup')
    } catch (err) {
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-full flex flex-col items-center justify-center px-6">
      <AuthLogo />
      <h1 className="text-3xl font-bold mb-8 text-white">
        {APP_NAME}
      </h1>

      <form onSubmit={handleSubmit} className="w-full max-w-sm">
        <div className="space-y-4">
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full px-5 py-3 bg-white/10 rounded-full border border-white/10 focus:border-blue-500 outline-none"
            required
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-5 py-3 bg-white/10 rounded-full border border-white/10 focus:border-blue-500 outline-none"
            required
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 mt-8 bg-blue-500 hover:bg-blue-600 rounded-full font-medium transition-colors disabled:opacity-50"
        >
          {loading ? <LoadingSpinner size="w-5 h-5" /> : 'Sign Up'}
        </button>
      </form>

      <p className="mt-6 text-white/60">
        Already have an account?{' '}
        <Link to="/login" className="text-blue-500 hover:underline">
          Log in
        </Link>
      </p>
    </div>
  )
}
