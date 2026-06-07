import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { useAuth } from '../../contexts/AuthContext'
import { hero, logo, marks } from '../../assets'
import LoadingSpinner from '../ui/LoadingSpinner'

export default function Register() {
  const { register } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (password !== confirm) {
      toast.error('Passwords do not match')
      return
    }
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
      <img src={hero} alt="" className="w-40 h-40 object-contain mb-6" />
      <img src={marks} alt="" className="h-8 mb-3 opacity-90" />
      <img src={logo} alt="ArvoliO" className="w-10 h-10 mb-2" />
      <h1 className="text-3xl font-bold mb-1 bg-gradient-to-r from-blue-500 to-purple-500 bg-clip-text text-transparent">
        Join ArvoliO
      </h1>
      <p className="text-white/60 mb-8">Create your account</p>

      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4">
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
        <input
          type="password"
          placeholder="Confirm Password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          className="w-full px-5 py-3 bg-white/10 rounded-full border border-white/10 focus:border-blue-500 outline-none"
          required
        />
        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 bg-blue-500 hover:bg-blue-600 rounded-full font-medium transition-colors disabled:opacity-50"
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
