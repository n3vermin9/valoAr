import { useState, useEffect } from 'react'
import { getUsernameAvailability } from '../services/userService'
import { normalizeUsername, validateUsername } from '../utils/helpers'

/** Pause after typing before showing validation / availability. */
const USERNAME_CHECK_DELAY_MS = 750

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

    // Hide alerts while typing; settle after a short pause.
    setStatus('idle')
    setError(null)

    let cancelled = false
    const timer = setTimeout(async () => {
      const validationError = validateUsername(normalized)
      if (validationError) {
        if (!cancelled) {
          setStatus('invalid')
          setError(validationError)
        }
        return
      }

      if (!cancelled) setStatus('checking')

      try {
        const { available, error: availabilityError } = await getUsernameAvailability(
          normalized,
          currentUserId
        )
        if (cancelled) return
        setStatus(available ? 'available' : 'taken')
        setError(available ? null : availabilityError || 'Username is taken')
      } catch {
        if (!cancelled) {
          setStatus('error')
          setError('Could not check username')
        }
      }
    }, USERNAME_CHECK_DELAY_MS)

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [username, currentUserId, enabled])

  return { status, error }
}
