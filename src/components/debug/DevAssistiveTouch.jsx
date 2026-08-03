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

/**
 * TEMP floating assistive-touch menu for seed accounts / wipes.
 * Remove when demo shortcuts are no longer needed.
 */
export default function DevAssistiveTouch() {
  const navigate = useNavigate()
  const { user, profile, enterSeedAccount, wipeAllAccounts, removeAccount } = useAuth()
  const [revealed, setRevealed] = useState(false)
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [confirm, setConfirm] = useState(null) // 'wipe' | 'delete-me' | null
  const rootRef = useRef(null)
  const holdTimerRef = useRef(null)

  useEffect(() => {
    const startPositions = new Map()
    let secondaryStart = null
    let suppressContextMenuUntil = 0

    const toggleVisibility = () => {
      holdTimerRef.current = null
      setOpen(false)
      setConfirm(null)
      setRevealed((visible) => !visible)
    }

    const cancelHold = () => {
      window.clearTimeout(holdTimerRef.current)
      holdTimerRef.current = null
      startPositions.clear()
      secondaryStart = null
    }

    const armHold = (touches) => {
      cancelHold()
      if (touches.length !== 2) return

      for (const touch of touches) {
        startPositions.set(touch.identifier, { x: touch.clientX, y: touch.clientY })
      }

      holdTimerRef.current = window.setTimeout(toggleVisibility, 3000)
    }

    const onTouchStart = (event) => {
      if (event.touches.length === 2) {
        armHold(event.touches)
      } else {
        cancelHold()
      }
    }

    const onTouchMove = (event) => {
      if (!holdTimerRef.current || event.touches.length !== 2) {
        cancelHold()
        return
      }

      for (const touch of event.touches) {
        const start = startPositions.get(touch.identifier)
        if (
          !start ||
          Math.hypot(touch.clientX - start.x, touch.clientY - start.y) > 16
        ) {
          cancelHold()
          return
        }
      }
    }

    const onTouchEnd = (event) => {
      if (event.touches.length !== 2) cancelHold()
    }

    // A two-finger press on a Mac trackpad is exposed as a secondary pointer,
    // not as two independent touches.
    const onPointerDown = (event) => {
      if (event.pointerType !== 'mouse' || event.button !== 2) return
      cancelHold()
      secondaryStart = { x: event.clientX, y: event.clientY }
      holdTimerRef.current = window.setTimeout(() => {
        suppressContextMenuUntil = Date.now() + 1000
        toggleVisibility()
      }, 3000)
    }

    const onPointerMove = (event) => {
      if (!holdTimerRef.current || !secondaryStart) return
      if (Math.hypot(event.clientX - secondaryStart.x, event.clientY - secondaryStart.y) > 16) {
        cancelHold()
      }
    }

    const onPointerEnd = (event) => {
      if (event.pointerType === 'mouse' && event.button === 2) cancelHold()
    }

    const onContextMenu = (event) => {
      if (holdTimerRef.current || Date.now() < suppressContextMenuUntil) {
        event.preventDefault()
      }
    }

    document.addEventListener('touchstart', onTouchStart, { capture: true, passive: true })
    document.addEventListener('touchmove', onTouchMove, { capture: true, passive: true })
    document.addEventListener('touchend', onTouchEnd, { capture: true, passive: true })
    document.addEventListener('touchcancel', cancelHold, { capture: true, passive: true })
    document.addEventListener('pointerdown', onPointerDown, true)
    document.addEventListener('pointermove', onPointerMove, true)
    document.addEventListener('pointerup', onPointerEnd, true)
    document.addEventListener('pointercancel', onPointerEnd, true)
    document.addEventListener('contextmenu', onContextMenu, true)

    return () => {
      cancelHold()
      document.removeEventListener('touchstart', onTouchStart, true)
      document.removeEventListener('touchmove', onTouchMove, true)
      document.removeEventListener('touchend', onTouchEnd, true)
      document.removeEventListener('touchcancel', cancelHold, true)
      document.removeEventListener('pointerdown', onPointerDown, true)
      document.removeEventListener('pointermove', onPointerMove, true)
      document.removeEventListener('pointerup', onPointerEnd, true)
      document.removeEventListener('pointercancel', onPointerEnd, true)
      document.removeEventListener('contextmenu', onContextMenu, true)
    }
  }, [])

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

  const menu = (
    <div ref={rootRef} className="fixed z-[320] pointer-events-auto" style={{ left: 16, bottom: 110 }}>
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
    </div>
  )

  if (typeof document === 'undefined') return null
  if (!revealed) return null
  return createPortal(menu, document.body)
}
