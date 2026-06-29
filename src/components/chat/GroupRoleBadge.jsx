import { getAdminDisplayLabel, getGroupRoleLabel } from '../../utils/groupChat'

export default function GroupRoleBadge({ chat, userId, role, label, className = '' }) {
  const displayLabel =
    label ?? (chat && userId ? getAdminDisplayLabel(chat, userId) : getGroupRoleLabel(role))
  if (!displayLabel) return null

  return (
    <span
      className={`text-[11px] font-medium normal-case text-white/40 shrink-0 ${className}`}
    >
      {displayLabel}
    </span>
  )
}
