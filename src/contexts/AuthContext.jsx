import { createContext, useContext, useEffect, useState } from 'react'
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  deleteUser,
} from 'firebase/auth'
import { auth } from '../firebase/config'
import { fetchUser, fetchDeletedUser, setupPresence, deleteAccount } from '../services/userService'
import { clearCache } from '../services/userCache'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const userProfile = await fetchUser(firebaseUser.uid)
        if (!userProfile) {
          const deleted = await fetchDeletedUser(firebaseUser.uid)
          if (deleted) {
            try {
              await signOut(auth)
            } catch {
              // Session may already be cleared.
            }
            setUser(null)
            setProfile(null)
            clearCache()
            setLoading(false)
            return
          }
          setUser(firebaseUser)
          setProfile(null)
          setLoading(false)
          return
        }
        setUser(firebaseUser)
        setProfile(userProfile)
        setupPresence(firebaseUser.uid)
      } else {
        setUser(null)
        setProfile(null)
        clearCache()
      }
      setLoading(false)
    })
    return unsub
  }, [])
  const login = (email, password) => signInWithEmailAndPassword(auth, email, password)

  const register = (email, password) => createUserWithEmailAndPassword(auth, email, password)

  const logout = () => signOut(auth)

  const refreshProfile = async () => {
    if (user) {
      const userProfile = await fetchUser(user.uid)
      setProfile(userProfile)
      return userProfile
    }
    return null
  }

  const removeAccount = async () => {
    if (!user || !profile) throw new Error('Not signed in')

    const currentUser = user
    await deleteAccount(currentUser.uid, profile.username)

    // Firestore data is gone — always end the session even if auth deletion fails.
    try {
      await deleteUser(currentUser)
    } catch {
      // e.g. auth/requires-recent-login — sign out below instead.
    }

    try {
      await signOut(auth)
    } catch {
      // Clear local state even if sign-out fails.
    }

    setUser(null)
    setProfile(null)
    clearCache()
  }

  return (
    <AuthContext.Provider
      value={{ user, profile, loading, login, register, logout, refreshProfile, setProfile, removeAccount }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
