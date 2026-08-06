import { getAdminDisplayLabel, getGroupRoleLabel } from '../../utils/groupChat'

export default function GroupRoleBadge({ chat, userId, role, label, className = '' }) {
  const displayLabel =
    label ?? (chat && userId ? getAdminDisplayLabel(chat, userId) : getGroupRoleLabel(role))
  if (!displayLabel) return null

  return (
    <span
      className={`text-xs font-medium normal-case text-[var(--ios-label-tertiary)] shrink-0 ${className}`}
    >
      {displayLabel}
    </span>
  )
}
