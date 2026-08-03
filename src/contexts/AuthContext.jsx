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
import { clearAllAppCaches } from '../services/appCacheClear'

const AuthContext = createContext(null)

const AUTH_BOOT_TIMEOUT_MS = 10000
const PROFILE_FETCH_TIMEOUT_MS = 8000

function withTimeout(promise, ms, label) {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => {
      reject(new Error(`${label} timed out after ${ms}ms`))
    }, ms)
    promise.then(
      (value) => {
        window.clearTimeout(timer)
        resolve(value)
      },
      (err) => {
        window.clearTimeout(timer)
        reject(err)
      }
    )
  })
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let settled = false
    const failSafe = window.setTimeout(() => {
      if (settled) return
      console.warn('Auth boot timed out — continuing without blocking the UI')
      setLoading(false)
    }, AUTH_BOOT_TIMEOUT_MS)

    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      try {
        if (firebaseUser) {
          const userProfile = await withTimeout(
            fetchUser(firebaseUser.uid),
            PROFILE_FETCH_TIMEOUT_MS,
            'fetchUser'
          )
          if (!userProfile) {
            const deleted = await withTimeout(
              fetchDeletedUser(firebaseUser.uid),
              PROFILE_FETCH_TIMEOUT_MS,
              'fetchDeletedUser'
            )
            if (deleted) {
              try {
                await signOut(auth)
              } catch {
                // Session may already be cleared.
              }
              setUser(null)
              setProfile(null)
              clearAllAppCaches()
              return
            }
            setUser(firebaseUser)
            setProfile(null)
            return
          }
          setUser(firebaseUser)
          setProfile(userProfile)
          setupPresence(firebaseUser.uid)
        } else {
          setUser(null)
          setProfile(null)
          clearAllAppCaches()
        }
      } catch (err) {
        console.error('Failed to initialize auth session', err)
        // Keep a restored Firebase session so the shell can still render;
        // profile can hydrate on the next refresh.
        if (firebaseUser) {
          setUser(firebaseUser)
          setProfile(null)
        } else {
          setUser(null)
          setProfile(null)
          clearAllAppCaches()
        }
      } finally {
        settled = true
        window.clearTimeout(failSafe)
        setLoading(false)
      }
    })
    return () => {
      window.clearTimeout(failSafe)
      unsub()
    }
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
    clearAllAppCaches()
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
