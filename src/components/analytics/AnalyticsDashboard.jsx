import { useState, useEffect } from 'react'
import toast from 'react-hot-toast'
import { fetchAppAnalytics } from '../../services/analyticsService'
import LoadingSpinner from '../ui/LoadingSpinner'
import { SubpageHeaderBar } from '../layout/SubpageShell'
import { SettingsSection } from '../ui/SettingsUI'
import { typoSubheadClass, typoHeadlineClass } from '../../utils/designSystem'

function StatRow({ label, value, hint }) {
  return (
    <div className="px-4 py-3 flex items-center justify-between gap-3 border-b border-white/5 last:border-b-0">
      <div className="min-w-0">
        <p className={typoHeadlineClass}>{label}</p>
        {hint ? <p className={`${typoSubheadClass} mt-0.5`}>{hint}</p> : null}
      </div>
      <p className="text-[17px] font-semibold tabular-nums text-[var(--ios-blue)] shrink-0">{value}</p>
    </div>
  )
}

export default function AnalyticsDashboard({ onBack }) {
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchAppAnalytics()
      setStats(data)
    } catch (err) {
      setError(err?.message || 'Could not load analytics')
      toast.error('Could not load analytics')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  return (
    <div className="fixed inset-0 z-[80] bg-black flex flex-col">
      <SubpageHeaderBar title="Analytics" onBack={onBack} />

      <div className="flex-1 overflow-y-auto pb-8">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <LoadingSpinner />
          </div>
        ) : error ? (
          <div className="px-6 py-12 text-center">
            <p className="text-white/60 mb-4">{error}</p>
            <button
              type="button"
              onClick={load}
              className="px-4 py-2 rounded-full bg-white/10 text-white text-sm font-medium"
            >
              Retry
            </button>
          </div>
        ) : stats ? (
          <div className="space-y-6 pt-2">
            <p className="px-[var(--ios-page-x-lg)] text-xs text-white/45">
              Updated {new Date(stats.fetchedAt).toLocaleString()}
            </p>

            <SettingsSection title="Users">
              <StatRow label="Total users" value={stats.users.total} hint={stats.users.capped ? 'Sample capped at 500' : undefined} />
              <StatRow label="Active in 24h" value={stats.users.active24h} />
              <StatRow label="New in 7 days" value={stats.users.new7d} />
              <StatRow label="Avg friends" value={stats.users.avgFriends} />
            </SettingsSection>

            <SettingsSection title="Chats">
              <StatRow label="Total chats" value={stats.chats.total} hint={stats.chats.capped ? 'Sample capped at 500' : undefined} />
              <StatRow label="Direct chats" value={stats.chats.direct} />
              <StatRow label="Saved Messages" value={stats.chats.saved} />
            </SettingsSection>

            <SettingsSection title="Groups">
              <StatRow label="Total groups" value={stats.groups.total} hint={stats.groups.capped ? 'Sample capped at 200' : undefined} />
              <StatRow label="Public" value={stats.groups.public} />
              <StatRow label="Private" value={stats.groups.private} />
            </SettingsSection>

            <SettingsSection title="Stories">
              <StatRow label="Sampled users" value={stats.stories.sampledUsers} />
              <StatRow label="Stories in sample" value={stats.stories.sampledTotal} />
              <StatRow label="Posted in 24h (sample)" value={stats.stories.last24hSample} />
            </SettingsSection>
          </div>
        ) : null}
      </div>
    </div>
  )
}
