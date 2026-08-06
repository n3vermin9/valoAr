import { useState, useRef, useEffect, useLayoutEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import toast from 'react-hot-toast'
import {
  IconChevronRight,
  IconShield,
  IconShieldOff,
  IconUserMinus,
  IconBan,
  IconSettings,
  IconVolume,
  IconVolumeOff,
} from '@tabler/icons-react'
import {
  removeGroupMember,
  banGroupMember,
  setGroupMemberRole,
  muteGroupMember,
  unmuteGroupMember,
} from '../../services/groupChatService'
import {
  canAdmin,
  getGroupMemberRole,
  isGroupOwner,
  isGroupMemberMuted,
} from '../../utils/groupChat'
import {
  contextMenuMotion,
  dropdownMenuClass,
  dropdownMenuItemWithIconClass,
  dropdownMenuItemWithIconDangerClass,
  insetCardClass,
  navGlassMenuClass,
  settingsRowClass,
} from '../../utils/designSystem'
import CachedAvatar from '../ui/CachedAvatar'
import UsernameLabel from '../ui/UsernameLabel'
import GroupRoleBadge from './GroupRoleBadge'
import ConfirmDialog from '../ui/ConfirmDialog'
import { sad } from '../../assets'

const VIEWPORT_PADDING = 16
const MENU_GAP = 12

function ContextMenuItem({ children, onClick, icon: Icon, danger = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={danger ? dropdownMenuItemWithIconDangerClass : dropdownMenuItemWithIconClass}
    >
      {Icon ? (
        <Icon size={18} stroke={1.75} className={`shrink-0 ${danger ? 'text-[var(--ios-red)]' : 'text-[var(--ios-label-secondary)]'}`} />
      ) : null}
      {children}
    </button>
  )
}

function clampHorizontal(left, width) {
  const maxLeft = window.innerWidth - VIEWPORT_PADDING - width
  return Math.max(VIEWPORT_PADDING, Math.min(left, maxLeft))
}

export default function GroupMemberRow({
  chat,
  chatId,
  memberId,
  member,
  currentUserId,
  variant = 'info',
  showChevron = false,
  onNavigateManage,
  onSelect,
  className = '',
}) {
  const navigate = useNavigate()
  const rowRef = useRef(null)
  const pressTimerRef = useRef(null)
  const touchStartRef = useRef({ x: 0, y: 0 })
  const cardRef = useRef(null)
  const menuRef = useRef(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [originRect, setOriginRect] = useState(null)
  const [cardTop, setCardTop] = useState(0)
  const [menuTop, setMenuTop] = useState(0)
  const [confirmAction, setConfirmAction] = useState(null)
  const [acting, setActing] = useState(false)

  const role = getGroupMemberRole(chat, memberId)
  const isMuted = isGroupMemberMuted(chat, memberId)
  const isSelf = memberId === currentUserId
  const isOwnerRow = isGroupOwner(chat, memberId)
  const canManageMembers = canAdmin(chat, currentUserId, 'removeMembers')
  const canManageAdmins = canAdmin(chat, currentUserId, 'manageAdmins')
  const canShowMenu =
    !isOwnerRow &&
    !isSelf &&
    (canManageMembers || canManageAdmins) &&
    variant !== 'readonly'

  const captureOriginRect = useCallback(() => {
    const el = rowRef.current
    if (!el) return null
    const rect = el.getBoundingClientRect()
    return {
      top: rect.top,
      left: rect.left,
      width: rect.width,
      height: rect.height,
      bottom: rect.bottom,
      right: rect.right,
    }
  }, [])

  useLayoutEffect(() => {
    if (!menuOpen || !originRect) return

    const fitLayout = () => {
      const menu = menuRef.current
      const card = cardRef.current
      if (!menu) return

      const menuHeight = menu.offsetHeight
      const cardHeight = card?.offsetHeight ?? originRect.height
      const stackHeight = cardHeight + MENU_GAP + menuHeight
      const maxTop = window.innerHeight - VIEWPORT_PADDING - stackHeight

      // Prefer original row position; fall back toward vertical center if clipped.
      let nextCardTop = originRect.top
      if (nextCardTop > maxTop) {
        nextCardTop = Math.max(VIEWPORT_PADDING, Math.min(maxTop, (window.innerHeight - stackHeight) / 2))
      }
      if (nextCardTop < VIEWPORT_PADDING) {
        nextCardTop = VIEWPORT_PADDING
      }

      setCardTop(nextCardTop)
      setMenuTop(nextCardTop + cardHeight + MENU_GAP)
    }

    fitLayout()
    window.addEventListener('resize', fitLayout)
    return () => window.removeEventListener('resize', fitLayout)
  }, [menuOpen, originRect, canManageAdmins, canManageMembers, role, isMuted])

  useEffect(() => {
    if (!menuOpen) return
    const handleEscape = (e) => {
      if (e.key === 'Escape') setMenuOpen(false)
    }
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [menuOpen])

  const openMenu = (e) => {
    if (!canShowMenu) return
    e.preventDefault()
    e.stopPropagation()
    const rect = captureOriginRect()
    if (!rect) return
    setOriginRect(rect)
    setCardTop(rect.top)
    setMenuTop(rect.bottom + MENU_GAP)
    setMenuOpen(true)
  }

  const clearPressTimer = () => {
    if (pressTimerRef.current) {
      clearTimeout(pressTimerRef.current)
      pressTimerRef.current = null
    }
  }

  const handleTouchStart = (e) => {
    if (!canShowMenu) return
    const touch = e.touches[0]
    touchStartRef.current = { x: touch.clientX, y: touch.clientY }
    clearPressTimer()
    pressTimerRef.current = setTimeout(() => {
      const rect = captureOriginRect()
      if (!rect) return
      setOriginRect(rect)
      setCardTop(rect.top)
      setMenuTop(rect.bottom + MENU_GAP)
      setMenuOpen(true)
    }, 500)
  }

  const handleTouchMove = (e) => {
    const touch = e.touches[0]
    const dx = touch.clientX - touchStartRef.current.x
    const dy = touch.clientY - touchStartRef.current.y
    if (Math.abs(dx) > 8 || Math.abs(dy) > 8) clearPressTimer()
  }

  const handleTouchEnd = () => clearPressTimer()
  const handleTouchCancel = () => clearPressTimer()

  const closeMenu = () => setMenuOpen(false)

  const handleManageAdmin = () => {
    closeMenu()
    if (onNavigateManage) {
      onNavigateManage(memberId)
      return
    }
    navigate(`/groups/${chatId}/settings/admins/${memberId}`)
  }

  const openConfirm = (action) => {
    closeMenu()
    setConfirmAction(action)
  }

  const runAction = async (action) => {
    setActing(true)
    try {
      if (action === 'remove') {
        await removeGroupMember(chatId, currentUserId, memberId)
        toast.success('Member removed')
      } else if (action === 'ban') {
        await banGroupMember(chatId, currentUserId, memberId)
        toast.success('Member banned')
      } else if (action === 'promote') {
        await setGroupMemberRole(chatId, currentUserId, memberId, 'admin')
      } else if (action === 'demote') {
        await setGroupMemberRole(chatId, currentUserId, memberId, 'member')
      } else if (action === 'mute') {
        await muteGroupMember(chatId, currentUserId, memberId)
        toast.success('Member muted')
      } else if (action === 'unmute') {
        await unmuteGroupMember(chatId, currentUserId, memberId)
        toast.success('Member unmuted')
      }
      setConfirmAction(null)
      closeMenu()
    } catch (err) {
      toast.error(err.message || 'Action failed')
    } finally {
      setActing(false)
    }
  }

  const clickable = Boolean(onSelect)
  const rowClass =
    variant === 'settings' || variant === 'info' || variant === 'readonly'
      ? `${settingsRowClass} ${
          clickable
            ? 'cursor-pointer'
            : variant === 'info' || variant === 'readonly'
              ? 'cursor-default'
              : 'disabled:cursor-default'
        }`
      : 'flex items-center gap-3 py-1'

  const handleRowClick = () => {
    if (menuOpen) return
    onSelect?.(memberId)
  }

  const content = (
    <>
      <CachedAvatar
        src={member?.photos?.[0]}
        fallback={sad}
        size={variant === 'settings' || variant === 'info' || variant === 'readonly' ? 44 : 36}
        alt=""
        className={`${variant === 'settings' || variant === 'info' || variant === 'readonly' ? 'w-11 h-11' : 'w-9 h-9'} rounded-full object-cover shrink-0`}
      />
      <div className="min-w-0 flex-1 text-left">
        <div className="flex items-center gap-2 min-w-0">
          <UsernameLabel
            username={member?.username}
            className={variant === 'settings' ? undefined : 'text-[15px] font-medium'}
            badgeSize={12}
          />
          {isSelf && (
            <span className="text-xs text-[var(--ios-label-tertiary)] shrink-0">(you)</span>
          )}
        </div>
      </div>
      <GroupRoleBadge chat={chat} userId={memberId} role={role} />
      {showChevron ? (
        <IconChevronRight size={18} className="text-[var(--ios-label-tertiary)] shrink-0" stroke={1.75} />
      ) : null}
    </>
  )

  const panelWidth = originRect
    ? Math.min(Math.max(originRect.width, 260), window.innerWidth - VIEWPORT_PADDING * 2)
    : 260
  const cardLeft = originRect ? clampHorizontal(originRect.left, panelWidth) : VIEWPORT_PADDING

  const menu = createPortal(
    <AnimatePresence
      onExitComplete={() => {
        setOriginRect(null)
      }}
    >
      {menuOpen && originRect && (
        <motion.div
          key={memberId}
          className="fixed inset-0 z-[80]"
          initial={{ opacity: 1 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.06 } }}
        >
          <div
            className="absolute inset-0 bg-[var(--ios-modal-scrim)] backdrop-blur-md"
            onClick={closeMenu}
            aria-hidden
          />

          <div
            ref={cardRef}
            className={`fixed z-[81] pointer-events-auto overflow-hidden ${insetCardClass}`}
            style={{ top: cardTop, left: cardLeft, width: panelWidth }}
          >
            <div className={`${settingsRowClass} border-b-0 hover:bg-transparent active:bg-transparent`}>
              {content}
            </div>
          </div>

          <motion.div
            ref={menuRef}
            data-member-context
            {...contextMenuMotion}
            className={`fixed z-[82] pointer-events-auto ${dropdownMenuClass} ${navGlassMenuClass}`}
            style={{ top: menuTop, left: cardLeft, width: panelWidth }}
            onClick={(e) => e.stopPropagation()}
            onContextMenu={(e) => e.preventDefault()}
          >
            {canManageAdmins && (
              <ContextMenuItem icon={IconSettings} onClick={handleManageAdmin}>
                Manage admin
              </ContextMenuItem>
            )}
            {canManageAdmins && role === 'member' && (
              <ContextMenuItem icon={IconShield} onClick={() => openConfirm('promote')}>
                Make admin
              </ContextMenuItem>
            )}
            {canManageAdmins && role === 'admin' && (
              <ContextMenuItem icon={IconShieldOff} onClick={() => openConfirm('demote')}>
                Remove admin
              </ContextMenuItem>
            )}
            {canManageMembers &&
              (isMuted ? (
                <ContextMenuItem icon={IconVolume} onClick={() => runAction('unmute')}>
                  Unmute member
                </ContextMenuItem>
              ) : (
                <ContextMenuItem icon={IconVolumeOff} onClick={() => runAction('mute')}>
                  Mute member
                </ContextMenuItem>
              ))}
            {canManageMembers && (
              <ContextMenuItem icon={IconUserMinus} onClick={() => openConfirm('remove')} danger>
                Remove from group
              </ContextMenuItem>
            )}
            {canManageMembers && (
              <ContextMenuItem icon={IconBan} onClick={() => openConfirm('ban')} danger>
                Ban from group
              </ContextMenuItem>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  )

  const confirmCopy = {
    remove: {
      title: 'Remove member?',
      message: `${member?.username || 'This member'} will be removed from the group.`,
      confirmLabel: 'Remove',
      danger: true,
    },
    ban: {
      title: 'Ban member?',
      message: `${member?.username || 'This member'} will be removed and cannot rejoin.`,
      confirmLabel: 'Ban',
      danger: true,
    },
    promote: {
      title: 'Make admin?',
      message: `${member?.username || 'This member'} will get admin access with default permissions.`,
      confirmLabel: 'Make admin',
    },
    demote: {
      title: 'Remove admin access?',
      message: `${member?.username || 'This member'} will become a regular member.`,
      confirmLabel: 'Remove admin',
      danger: true,
    },
  }

  const confirm = confirmAction ? confirmCopy[confirmAction] : null
  const hiddenWhileFocused = menuOpen ? 'invisible' : ''

  if (variant === 'settings' && showChevron && canManageAdmins && !isOwnerRow) {
    return (
      <>
        <button
          type="button"
          ref={rowRef}
          data-allow-contextmenu={canShowMenu ? true : undefined}
          onContextMenu={openMenu}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onTouchCancel={handleTouchCancel}
          onClick={handleManageAdmin}
          className={`${rowClass} ${hiddenWhileFocused} ${className}`}
        >
          {content}
        </button>
        {menu}
        <ConfirmDialog
          isOpen={Boolean(confirm)}
          onClose={() => !acting && setConfirmAction(null)}
          onConfirm={() => runAction(confirmAction)}
          title={confirm?.title}
          message={confirm?.message}
          confirmLabel={confirm?.confirmLabel}
          danger={confirm?.danger}
          loading={acting}
        />
      </>
    )
  }

  return (
    <>
      <div
        ref={rowRef}
        role={clickable ? 'button' : undefined}
        tabIndex={clickable ? 0 : undefined}
        data-allow-contextmenu={canShowMenu ? true : undefined}
        onContextMenu={openMenu}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchCancel}
        onClick={clickable ? handleRowClick : undefined}
        onKeyDown={
          clickable
            ? (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  handleRowClick()
                }
              }
            : undefined
        }
        className={`${rowClass} ${hiddenWhileFocused} ${className}`}
      >
        {content}
      </div>
      {menu}
      <ConfirmDialog
        isOpen={Boolean(confirm)}
        onClose={() => !acting && setConfirmAction(null)}
        onConfirm={() => runAction(confirmAction)}
        title={confirm?.title}
        message={confirm?.message}
        confirmLabel={confirm?.confirmLabel}
        danger={confirm?.danger}
        loading={acting}
      />
    </>
  )
}
