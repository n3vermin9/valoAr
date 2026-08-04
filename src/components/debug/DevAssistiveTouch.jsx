import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import toast from 'react-hot-toast'
import { IconDots, IconTrash, IconUserMinus, IconX } from '@tabler/icons-react'
import { useAuth } from '../../contexts/AuthContext'
import { SEED_ACCOUNTS } from '../../utils/seedAccounts'
import ConfirmDialog from '../ui/ConfirmDialog'
import CachedAvatar from '../ui/CachedAvatar'
import {
  navGlassMenuClass,
  dropdownMenuItemClass,
  dropdownMenuItemDangerClass,
  typoCaptionClass,
} from '../../utils/designSystem'

const FAB_LEFT = 16
const FAB_BOTTOM = 110
const FAB_SIZE = 56
const TAP_TARGET = 5
const TAP_WINDOW_MS = 2000

/**
 * TEMP floating assistive-touch menu for seed accounts / wipes.
 * Reveal: tap 5 times on the fab’s corner position (invisible until revealed).
 */
export default function DevAssistiveTouch() {
  const navigate = useNavigate()
  const { user, profile, enterSeedAccount, wipeAllAccounts, removeAccount } = useAuth()
  const [revealed, setRevealed] = useState(false)
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [confirm, setConfirm] = useState(null) // 'wipe' | 'delete-me' | null
  const rootRef = useRef(null)
  const tapCountRef = useRef(0)
  const tapTimerRef = useRef(null)

  const resetTapCount = () => {
    tapCountRef.current = 0
    window.clearTimeout(tapTimerRef.current)
    tapTimerRef.current = null
  }

  const registerHotspotTap = () => {
    tapCountRef.current += 1
    window.clearTimeout(tapTimerRef.current)
    tapTimerRef.current = window.setTimeout(resetTapCount, TAP_WINDOW_MS)

    if (tapCountRef.current >= TAP_TARGET) {
      resetTapCount()
      setOpen(false)
      setConfirm(null)
      setRevealed((visible) => !visible)
    }
  }

  useEffect(() => () => resetTapCount(), [])

  useEffect(() => {
    if (!open) return undefined
    const onPointerDown = (e) => {
      if (!rootRef.current?.contains(e.target)) setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown, true)
    return () => document.removeEventListener('pointerdown', onPointerDown, true)
  }, [open])

  const run = async (fn) => {
    if (busy) return
    setBusy(true)
    try {
      await fn()
    } catch (err) {
      console.error(err)
      toast.error(err?.message || 'Action failed')
    } finally {
      setBusy(false)
    }
  }

  const handleWipeAll = () =>
    run(async () => {
      setConfirm(null)
      setOpen(false)
      const result = await wipeAllAccounts()
      toast.success(
        `Wiped ${result?.wipedCount ?? 0} profiles (${result?.deletedDocs ?? 0} docs)`
      )
      navigate('/login', { replace: true })
    })

  const handleDeleteThis = () =>
    run(async () => {
      setConfirm(null)
      setOpen(false)
      await removeAccount()
      toast.success('This account deleted')
      navigate('/login', { replace: true })
    })

  const handleSeed = (seed) =>
    run(async () => {
      setOpen(false)
      await enterSeedAccount(seed)
      toast.success(`Logged in as @${seed.username}`)
      navigate('/discover', { replace: true })
    })

  const otherSeeds = SEED_ACCOUNTS.filter((s) => s.username !== profile?.username)

  if (typeof document === 'undefined') return null

  // Invisible hotspot — always present so 5 taps on this corner reveal the menu.
  if (!revealed) {
    return createPortal(
      <button
        type="button"
        aria-label="Reveal dev menu"
        onClick={registerHotspotTap}
        className="fixed z-[320] opacity-0"
        style={{
          left: FAB_LEFT,
          bottom: FAB_BOTTOM,
          width: FAB_SIZE,
          height: FAB_SIZE,
        }}
      />,
      document.body
    )
  }

  return createPortal(
    <div
      ref={rootRef}
      className="fixed z-[320] pointer-events-auto"
      style={{ left: FAB_LEFT, bottom: FAB_BOTTOM }}
    >
      {open ? (
        <div
          className={`${navGlassMenuClass} mb-3 w-56 overflow-hidden shadow-2xl`}
          role="menu"
        >
          <p className={`${typoCaptionClass} px-3.5 pt-2.5 pb-1 uppercase tracking-wide`}>
            Dev menu
          </p>

          <button
            type="button"
            disabled={busy}
            className={dropdownMenuItemDangerClass}
            onClick={() => setConfirm('wipe')}
          >
            <span className="inline-flex items-center gap-2">
              <IconTrash size={16} stroke={1.75} />
              Delete all accounts
            </span>
          </button>

          <button
            type="button"
            disabled={busy || !user || !profile?.username}
            className={`${dropdownMenuItemDangerClass} disabled:opacity-40`}
            onClick={() => setConfirm('delete-me')}
          >
            <span className="inline-flex items-center gap-2">
              <IconUserMinus size={16} stroke={1.75} />
              Delete this account
            </span>
          </button>

          <div className="mx-3 my-1.5 h-px bg-white/10" />

          <p className={`${typoCaptionClass} px-3.5 pb-1`}>Login as</p>
          {otherSeeds.map((seed) => (
            <button
              key={seed.id}
              type="button"
              disabled={busy}
              className={`${dropdownMenuItemClass} flex items-center gap-2.5`}
              onClick={() => handleSeed(seed)}
            >
              <CachedAvatar
                src={seed.photos?.[0]}
                size={28}
                alt=""
                className="w-7 h-7 rounded-full object-cover shrink-0"
              />
              <span className="truncate">@{seed.username}</span>
            </button>
          ))}
        </div>
      ) : null}

      <button
        type="button"
        aria-label={open ? 'Close dev menu' : 'Open dev menu'}
        disabled={busy}
        onClick={() => setOpen((v) => !v)}
        onPointerDown={(e) => {
          if (e.button !== 0) return
          const timer = window.setTimeout(() => {
            setOpen(false)
            setConfirm(null)
            setRevealed(false)
          }, 900)
          const clear = () => {
            window.clearTimeout(timer)
            window.removeEventListener('pointerup', clear, true)
            window.removeEventListener('pointercancel', clear, true)
          }
          window.addEventListener('pointerup', clear, true)
          window.addEventListener('pointercancel', clear, true)
        }}
        className="w-14 h-14 rounded-full bg-white/15 border border-white/25 backdrop-blur-xl shadow-lg flex items-center justify-center text-white active:scale-95 transition-transform disabled:opacity-60"
      >
        {busy ? (
          <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
        ) : open ? (
          <IconX size={22} stroke={2} />
        ) : (
          <IconDots size={22} stroke={2} />
        )}
      </button>

      <ConfirmDialog
        isOpen={confirm === 'wipe'}
        onClose={() => setConfirm(null)}
        onConfirm={handleWipeAll}
        title="Delete all accounts?"
        message="Wipes Firestore + RTDB profile data. Auth emails may remain. This cannot be undone."
        confirmLabel="Delete all"
        danger
        loading={busy}
        overlayClassName="z-[400]"
      />

      <ConfirmDialog
        isOpen={confirm === 'delete-me'}
        onClose={() => setConfirm(null)}
        onConfirm={handleDeleteThis}
        title="Delete this account?"
        message={`Permanently delete @${profile?.username || 'this user'} and sign out.`}
        confirmLabel="Delete"
        danger
        loading={busy}
        overlayClassName="z-[400]"
      />
    </div>,
    document.body
  )
}
