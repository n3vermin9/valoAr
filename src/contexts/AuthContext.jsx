import { createContext, useContext, useEffect, useState } from 'react'
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  deleteUser,
} from 'firebase/auth'
import { auth } from '../firebase/config'
import { fetchUser, setupPresence, deleteAccount } from '../services/userService'
import { clearCache } from '../services/userCache'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser)
        const userProfile = await fetchUser(firebaseUser.uid)
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
    if (!user || !profile) return
    await deleteAccount(user.uid, profile.username)
    await deleteUser(user)
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
