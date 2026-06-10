import { useState } from 'react'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import { useAuth } from '../../contexts/AuthContext'
import AuthLogo from './AuthLogo'
import { APP_NAME } from '../../utils/helpers'
import LoadingSpinner from '../ui/LoadingSpinner'
import TextField from '../ui/TextField'
import Button from '../ui/Button'

export default function Login() {
  const { login } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      await login(email, password)
      toast.success('Welcome back!')
    } catch (err) {
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="min-h-full flex flex-col items-center justify-center px-[var(--ios-page-x-lg)]"
      style={{ paddingTop: 'var(--ios-safe-top)', paddingBottom: 'var(--ios-safe-bottom)' }}
    >
      <AuthLogo />
      <h1 className="text-[34px] font-bold mb-8 text-[var(--ios-label)] tracking-tight">
        {APP_NAME}
      </h1>

      <form onSubmit={handleSubmit} className="w-full max-w-sm">
        <div className="space-y-3">
          <TextField
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <TextField
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        <Button type="submit" fullWidth disabled={loading} className="mt-8">
          {loading ? <LoadingSpinner size="w-5 h-5" /> : 'Log In'}
        </Button>
      </form>

      <p className="mt-6 text-[var(--ios-label-secondary)] text-[15px]">
        Don't have an account?{' '}
        <Link to="/register" className="text-[var(--ios-blue)] hover:underline">
          Sign up
        </Link>
      </p>
    </div>
  )
}
