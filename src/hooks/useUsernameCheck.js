import { useState, useEffect } from 'react'
import { checkUsernameAvailable } from '../services/userService'
import { normalizeUsername, validateUsername } from '../utils/helpers'

export function useUsernameCheck(username, currentUserId, enabled = true) {
  const [status, setStatus] = useState('idle')
  const [error, setError] = useState(null)

  useEffect(() => {
    const normalized = normalizeUsername(username)

    if (!enabled || !normalized) {
      setStatus('idle')
      setError(null)
      return
    }

    const validationError = validateUsername(normalized)
    if (validationError) {
      setStatus('invalid')
      setError(validationError)
      return
    }

    setStatus('checking')
    const timer = setTimeout(async () => {
      try {
        const available = await checkUsernameAvailable(normalized, currentUserId)
        setStatus(available ? 'available' : 'taken')
        setError(available ? null : 'Username is taken')
      } catch {
        setStatus('error')
        setError('Could not check username')
      }
    }, 500)

    return () => clearTimeout(timer)
  }, [username, currentUserId, enabled])

  return { status, error }
}
