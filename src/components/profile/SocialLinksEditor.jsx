import { SOCIAL_PLATFORMS } from '../../utils/socialLinks'

export default function SocialLinksEditor({ socials, onChange }) {
  return (
    <div>
      <label className="text-sm text-white/60 mb-2 block">Social links</label>
      <div className="space-y-2">
        {SOCIAL_PLATFORMS.map(({ id, label }) => (
          <div key={id} className="flex items-center gap-2">
            <span className="w-20 shrink-0 text-xs text-white/45">{label}</span>
            <input
              value={socials[id] || ''}
              onChange={(e) => onChange({ ...socials, [id]: e.target.value })}
              placeholder="@username"
              className="flex-1 px-4 py-2.5 bg-white/10 rounded-full border border-white/10 outline-none focus:border-blue-500 text-sm"
              maxLength={80}
            />
          </div>
        ))}
      </div>
    </div>
  )
}
