import { useState, useEffect } from 'react'
import { getGroupUsernameAvailability } from '../services/groupChatService'
import { normalizeUsername, validateUsername } from '../utils/helpers'

/** Pause after typing before showing validation / availability. */
const USERNAME_CHECK_DELAY_MS = 750

export function useGroupUsernameCheck(username, chatId = null, enabled = true) {
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
        const { available, error: availabilityError } = await getGroupUsernameAvailability(
          normalized,
          chatId
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
  }, [username, chatId, enabled])

  return { status, error }
}
