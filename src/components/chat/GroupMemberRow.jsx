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
  navGlassMenuClass,
  settingsRowClass,
} from '../../utils/designSystem'
import CachedAvatar from '../ui/CachedAvatar'
import UsernameLabel from '../ui/UsernameLabel'
import GroupRoleBadge from './GroupRoleBadge'
import ConfirmDialog from '../ui/ConfirmDialog'
import { sad } from '../../assets'

function ContextMenuItem({ children, onClick, icon: Icon, danger = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={danger ? dropdownMenuItemWithIconDangerClass : dropdownMenuItemWithIconClass}
    >
      {Icon ? (
        <Icon size={18} stroke={1.75} className={`shrink-0 ${danger ? 'text-red-400' : 'text-white/55'}`} />
      ) : null}
      {children}
    </button>
  )
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
  className = '',
}) {
  const navigate = useNavigate()
  const rowRef = useRef(null)
  const pressTimerRef = useRef(null)
  const touchStartRef = useRef({ x: 0, y: 0 })
  const [menuOpen, setMenuOpen] = useState(false)
  const [menuPos, setMenuPos] = useState(null)
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

  const updateMenuPosition = useCallback(() => {
    const el = rowRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    setMenuPos({ top: rect.bottom + 4, left: Math.min(rect.left, window.innerWidth - 200) })
  }, [])

  useLayoutEffect(() => {
    if (!menuOpen) return
    updateMenuPosition()
    const onReposition = () => updateMenuPosition()
    window.addEventListener('resize', onReposition)
    window.addEventListener('scroll', onReposition, true)
    return () => {
      window.removeEventListener('resize', onReposition)
      window.removeEventListener('scroll', onReposition, true)
    }
  }, [menuOpen, updateMenuPosition])

  useEffect(() => {
    if (!menuOpen) return
    const handleEscape = (e) => {
      if (e.key === 'Escape') setMenuOpen(false)
    }
    const handleClickOutside = (e) => {
      if (e.button === 2) return
      if (!e.target.closest('[data-member-context]')) setMenuOpen(false)
    }
    document.addEventListener('keydown', handleEscape)
    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('keydown', handleEscape)
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [menuOpen])

  const openMenu = (e) => {
    if (!canShowMenu) return
    e.preventDefault()
    e.stopPropagation()
    updateMenuPosition()
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
      updateMenuPosition()
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
        toast.success('Member is now an admin')
      } else if (action === 'demote') {
        await setGroupMemberRole(chatId, currentUserId, memberId, 'member')
        toast.success('Admin access removed')
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

  const rowClass =
    variant === 'settings'
      ? `${settingsRowClass} disabled:cursor-default`
      : 'flex items-center gap-3 py-1'

  const content = (
    <>
      <CachedAvatar
        src={member?.photos?.[0]}
        fallback={sad}
        size={variant === 'settings' ? 44 : 36}
        alt=""
        className={`${variant === 'settings' ? 'w-11 h-11' : 'w-9 h-9'} rounded-full object-cover shrink-0`}
      />
      <div className="min-w-0 flex-1 text-left">
        <div className="flex items-center gap-2 min-w-0">
          <UsernameLabel
            username={member?.username}
            className={variant === 'settings' ? undefined : 'text-sm font-medium'}
            badgeSize={12}
          />
          {isSelf && (
            <span className="text-xs text-white/45 shrink-0">(you)</span>
          )}
        </div>
      </div>
      <GroupRoleBadge chat={chat} userId={memberId} role={role} />
      {showChevron ? (
        <IconChevronRight size={18} className="text-white/35 shrink-0" stroke={1.75} />
      ) : null}
    </>
  )

  const menu = createPortal(
    <AnimatePresence onExitComplete={() => setMenuPos(null)}>
      {menuOpen && menuPos && (
        <motion.div
          key={memberId}
          data-member-context
          {...contextMenuMotion}
          className={`fixed z-[80] ${dropdownMenuClass} ${navGlassMenuClass}`}
          style={{ top: menuPos.top, left: menuPos.left }}
          onClick={(e) => e.stopPropagation()}
          onContextMenu={(e) => e.preventDefault()}
        >
          {canManageAdmins && (
            <ContextMenuItem icon={IconSettings} onClick={handleManageAdmin}>
              Manage admin
            </ContextMenuItem>
          )}
          {canManageAdmins && role === 'member' && (
            <ContextMenuItem icon={IconShield} onClick={() => setConfirmAction('promote')}>
              Make admin
            </ContextMenuItem>
          )}
          {canManageAdmins && role === 'admin' && (
            <ContextMenuItem icon={IconShieldOff} onClick={() => setConfirmAction('demote')}>
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
            <ContextMenuItem icon={IconUserMinus} onClick={() => setConfirmAction('remove')} danger>
              Remove from group
            </ContextMenuItem>
          )}
          {canManageMembers && (
            <ContextMenuItem icon={IconBan} onClick={() => setConfirmAction('ban')} danger>
              Ban from group
            </ContextMenuItem>
          )}
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
          className={`${rowClass} ${className}`}
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
        data-allow-contextmenu={canShowMenu ? true : undefined}
        onContextMenu={openMenu}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchCancel}
        className={`${rowClass} ${className}`}
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
