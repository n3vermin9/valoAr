import { createContext, useContext, useEffect, useRef, useState } from 'react'
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  deleteUser,
} from 'firebase/auth'
import { auth } from '../firebase/config'
import {
  fetchUser,
  fetchDeletedUser,
  clearDeletedUserTombstone,
  setupPresence,
  deleteAccount,
  createUserProfile,
  updateUserSettings,
  deleteAllAccountsData,
} from '../services/userService'
import { clearAllAppCaches } from '../services/appCacheClear'
import { seedProfilePayload } from '../utils/seedAccounts'
import {
  applyAppearance,
  getStoredAppearance,
  normalizeAppearance,
  subscribeSystemAppearance,
} from '../utils/appearance'

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
  const authEpochRef = useRef(0)
  const seedLoginRef = useRef(false)

  useEffect(() => {
    if (profile?.appearance) {
      applyAppearance(normalizeAppearance(profile.appearance))
    }
  }, [profile?.appearance])

  useEffect(() => {
    return subscribeSystemAppearance(() =>
      normalizeAppearance(profile?.appearance ?? getStoredAppearance())
    )
  }, [profile?.appearance])

  useEffect(() => {
    let settled = false
    const failSafe = window.setTimeout(() => {
      if (settled) return
      console.warn('Auth boot timed out — continuing without blocking the UI')
      setLoading(false)
    }, AUTH_BOOT_TIMEOUT_MS)

    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      const epoch = ++authEpochRef.current
      try {
        if (firebaseUser) {
          const userProfile = await withTimeout(
            fetchUser(firebaseUser.uid),
            PROFILE_FETCH_TIMEOUT_MS,
            'fetchUser'
          )
          if (epoch !== authEpochRef.current) return
          if (!userProfile) {
            // Seed login recreates wiped profiles; don't sign out mid-flow.
            if (seedLoginRef.current) return
            const deleted = await withTimeout(
              fetchDeletedUser(firebaseUser.uid),
              PROFILE_FETCH_TIMEOUT_MS,
              'fetchDeletedUser'
            )
            if (epoch !== authEpochRef.current) return
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
        if (epoch !== authEpochRef.current) return
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
        if (epoch === authEpochRef.current) {
          settled = true
          window.clearTimeout(failSafe)
          setLoading(false)
        }
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

  /** Sign in (or create) a fixed seed account with a complete profile. */
  const enterSeedAccount = async (seed) => {
    seedLoginRef.current = true
    try {
      let cred
      try {
        cred = await signInWithEmailAndPassword(auth, seed.email, seed.password)
      } catch (err) {
        const code = err?.code || ''
        if (
          code === 'auth/user-not-found' ||
          code === 'auth/invalid-credential' ||
          code === 'auth/wrong-password' ||
          code === 'auth/invalid-login-credentials'
        ) {
          try {
            cred = await createUserWithEmailAndPassword(auth, seed.email, seed.password)
          } catch (createErr) {
            if (createErr?.code === 'auth/email-already-in-use') {
              cred = await signInWithEmailAndPassword(auth, seed.email, seed.password)
            } else {
              throw createErr
            }
          }
        } else {
          throw err
        }
      }

      await clearDeletedUserTombstone(cred.user.uid)
      const epoch = ++authEpochRef.current

      let userProfile = await fetchUser(cred.user.uid)
      if (!userProfile?.username) {
        await createUserProfile(cred.user.uid, seedProfilePayload(seed))
        userProfile = await fetchUser(cred.user.uid)
      } else if (
        seed.photos?.[0] &&
        userProfile.photos?.[0] !== seed.photos[0]
      ) {
        // Keep seed PFPs in sync when we tweak demo photos.
        await updateUserSettings(cred.user.uid, { photos: seed.photos })
        userProfile = await fetchUser(cred.user.uid)
      }

      if (epoch !== authEpochRef.current) return userProfile

      setUser(cred.user)
      setProfile(userProfile)
      setLoading(false)
      setupPresence(cred.user.uid)
      return userProfile
    } finally {
      seedLoginRef.current = false
    }
  }

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

  /** Dev wipe of all Firestore/RTDB account data, then sign out. */
  const wipeAllAccounts = async () => {
    seedLoginRef.current = true
    const epoch = ++authEpochRef.current
    try {
      const result = await deleteAllAccountsData()
      const current = auth.currentUser
      if (current) {
        try {
          await deleteUser(current)
        } catch {
          // Other Auth users can't be deleted from the client.
        }
      }
      try {
        await signOut(auth)
      } catch {
        // ignore
      }
      if (epoch === authEpochRef.current) {
        setUser(null)
        setProfile(null)
        setLoading(false)
        clearAllAppCaches()
      }
      return result
    } finally {
      seedLoginRef.current = false
    }
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        loading,
        login,
        register,
        logout,
        enterSeedAccount,
        wipeAllAccounts,
        refreshProfile,
        setProfile,
        removeAccount,
      }}
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
