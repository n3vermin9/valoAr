import { useState } from 'react'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import { useAuth } from '../../contexts/AuthContext'
import AuthLogo from './AuthLogo'
import { APP_NAME, formatFirebaseError } from '../../utils/helpers'
import { SEED_ACCOUNTS } from '../../utils/seedAccounts'
import LoadingSpinner from '../ui/LoadingSpinner'
import TextField from '../ui/TextField'
import Button from '../ui/Button'
import StoryRing from '../stories/StoryRing'

export default function Login() {
  const { login, enterSeedAccount } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [seedBusyId, setSeedBusyId] = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      await login(email, password)
      toast.success('Welcome back!')
    } catch (err) {
      toast.error(formatFirebaseError(err, 'Login failed'))
    } finally {
      setLoading(false)
    }
  }

  const handleSeed = async (seed) => {
    if (seedBusyId || loading) return
    setSeedBusyId(seed.id)
    try {
      await enterSeedAccount(seed)
      toast.success(`Logged in as @${seed.username}`)
    } catch (err) {
      toast.error(err.message || `Couldn’t open @${seed.username}`)
    } finally {
      setSeedBusyId(null)
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
        <Button type="submit" fullWidth disabled={loading || Boolean(seedBusyId)} className="mt-8">
          {loading ? <LoadingSpinner size="w-5 h-5" /> : 'Log In'}
        </Button>
      </form>

      {/* TEMP dev: one-tap seed profiles — remove soon */}
      <div className="w-full max-w-sm mt-8 flex justify-center gap-4">
        {SEED_ACCOUNTS.map((seed) => {
          const busy = seedBusyId === seed.id
          return (
            <div key={seed.id} className="flex flex-col items-center gap-1.5 shrink-0 w-16">
              <StoryRing
                photo={seed.photos?.[0]}
                username={seed.username}
                size={64}
                hasStories
                unseen={!busy}
                seen={busy}
                onClick={() => handleSeed(seed)}
                className={loading || seedBusyId ? 'opacity-50 pointer-events-none' : ''}
              />
              <span className="text-xs text-[var(--ios-label-secondary)] truncate w-full text-center">
                {busy ? '…' : seed.username}
              </span>
            </div>
          )
        })}
      </div>

      <p className="mt-6 text-[var(--ios-label-secondary)] text-[15px]">
        Don't have an account?{' '}
        <Link to="/register" className="text-[var(--ios-blue)] hover:underline">
          Sign up
        </Link>
      </p>
    </div>
  )
}
