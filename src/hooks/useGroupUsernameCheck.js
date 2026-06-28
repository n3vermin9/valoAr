import { useState, useEffect } from 'react'
import { getGroupUsernameAvailability } from '../services/groupChatService'
import { normalizeUsername, validateUsername } from '../utils/helpers'

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

    const validationError = validateUsername(normalized)
    if (validationError) {
      setStatus('invalid')
      setError(validationError)
      return
    }

    setStatus('checking')
    const timer = setTimeout(async () => {
      try {
        const { available, error: availabilityError } = await getGroupUsernameAvailability(
          normalized,
          chatId
        )
        setStatus(available ? 'available' : 'taken')
        setError(available ? null : availabilityError || 'Username is taken')
      } catch {
        setStatus('error')
        setError('Could not check username')
      }
    }, 500)

    return () => clearTimeout(timer)
  }, [username, chatId, enabled])

  return { status, error }
}
