import { useState } from 'react'
import { createUserWithEmailAndPassword, signOut } from 'firebase/auth'
import toast from 'react-hot-toast'
import { useNavigate } from 'react-router-dom'
import { auth } from '../../firebase/config'
import { useAuth } from '../../contexts/AuthContext'
import {
  createUserProfile,
  deleteAllAccountsData,
  resetAllMatchesForUser,
  suggestUniqueUsername,
} from '../../services/userService'
import { randomInt, generateRandomCredentials } from '../../utils/devAuth'
import { DEFAULT_CITY_ID, HOBBIES } from '../../utils/profileOptions'

function randomPick(list) {
  return list[randomInt(0, list.length - 1)]
}

function randomHobbies(count = 3) {
  const pool = [...HOBBIES]
  const picked = []
  const n = Math.min(count, 4)
  while (picked.length < n && pool.length) {
    const i = randomInt(0, pool.length - 1)
    picked.push(pool.splice(i, 1)[0].id)
  }
  return picked
}

function randomUserData() {
  const names = ['luna', 'milo', 'nova', 'ryan', 'zoe', 'kai', 'nora', 'leo', 'maya', 'alex']
  const bios = [
    'Coffee, walks, and late-night chats.',
    'Looking for real connection.',
    'Music lover and weekend traveler.',
    'Let us start with a hello.',
  ]
  const photos = [
    'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=800',
    'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=800',
    'https://images.unsplash.com/photo-1502685104226-ee32379fefbe?w=800',
    'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=800',
  ]
  const base = randomPick(names) + randomInt(100, 999)
  const credentials = generateRandomCredentials()
  return {
    ...credentials,
    usernameSeed: base,
    age: randomInt(18, 40),
    gender: randomPick(['male', 'female']),
    interestedIn: randomPick(['men', 'women', 'both']),
    city: DEFAULT_CITY_ID,
    hobbies: randomHobbies(randomInt(1, 4)),
    bio: randomPick(bios),
    photos: [randomPick(photos)],
  }
}

export default function DebugTools() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [busy, setBusy] = useState(false)

  const runAction = async (fn) => {
    if (busy) return
    setBusy(true)
    try {
      await fn()
    } catch (err) {
      toast.error(err.message || 'Debug action failed')
    } finally {
      setBusy(false)
    }
  }

  const handleResetMatches = () =>
    runAction(async () => {
      if (!user?.uid) throw new Error('No logged-in user')
      await resetAllMatchesForUser(user.uid)
      toast.success('All matches reset for this user')
    })

  const handleDeleteAll = () =>
    runAction(async () => {
      if (!window.confirm('Delete ALL Firestore/RTDB account data? This cannot be undone.')) {
        return
      }
      await deleteAllAccountsData()
      await signOut(auth)
      toast.success('All account data deleted (Auth logins may still exist)')
      navigate('/login', { replace: true })
    })

  const handleCreateRandomAndLogin = () =>
    runAction(async () => {
      const random = randomUserData()
      const cred = await createUserWithEmailAndPassword(auth, random.email, random.password)
      const username = await suggestUniqueUsername(random.usernameSeed, cred.user.uid)

      await createUserProfile(cred.user.uid, {
        email: random.email,
        username,
        age: random.age,
        gender: random.gender,
        interestedIn: random.interestedIn,
        city: random.city,
        hobbies: random.hobbies,
        bio: random.bio,
        photos: random.photos,
      })

      toast.success(`Logged into random user @${username}`)
      navigate('/discover')
    })

  return (
    <div className="h-full overflow-y-auto pb-24 px-5 pt-6">
      <h1 className="text-2xl font-bold">Debug Tools</h1>
      <p className="text-white/60 mt-1">Hidden tools for rapid testing.</p>

      <div className="mt-6 space-y-3">
        <button
          onClick={handleResetMatches}
          disabled={busy}
          className="w-full py-3 bg-white/10 hover:bg-white/20 rounded-full disabled:opacity-50"
        >
          Reset all matches for this user
        </button>

        <button
          onClick={handleDeleteAll}
          disabled={busy}
          className="w-full py-3 bg-red-500/80 hover:bg-red-500 rounded-full disabled:opacity-50"
        >
          Delete all accounts data
        </button>

        <button
          onClick={handleCreateRandomAndLogin}
          disabled={busy}
          className="w-full py-3 bg-blue-500 hover:bg-blue-600 rounded-full disabled:opacity-50"
        >
          Create random account and log in
        </button>
      </div>
    </div>
  )
}
