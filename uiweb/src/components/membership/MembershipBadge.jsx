import { Crown, Gem, ShieldCheck, Sparkles } from 'lucide-react'
import ClayAvatar from '../clay/ClayAvatar.jsx'
import { getMembershipTier } from '../../utils/membership.js'

const ICONS = {
  shield: ShieldCheck,
  sparkles: Sparkles,
  crown: Crown,
  gem: Gem,
}

function TierIcon({ tier, className = 'w-4 h-4' }) {
  const Icon = ICONS[tier.icon] || ShieldCheck
  return <Icon className={className} strokeWidth={2.5} />
}

export function MembershipBadge({ user, compact = false, className = '' }) {
  const tier = getMembershipTier(user?.group)

  return (
    <div
      className={`inline-flex items-center gap-2 rounded-clay-pill border ${tier.tone.border} ${tier.tone.bg} ${tier.tone.text} ${tier.tone.shadow} px-3 py-1.5 font-black ${className}`}
      title={`当前身份：${tier.label}`}
    >
      <TierIcon tier={tier} />
      <span className={compact ? 'text-xs' : 'text-sm'}>{tier.label}</span>
      {!compact && (
        <span className="hidden sm:inline text-xs font-bold opacity-70">{tier.tagline}</span>
      )}
    </div>
  )
}

export function MembershipAvatar({ user, name, src, size = 40, className = '' }) {
  const tier = getMembershipTier(user?.group)
  const dotSize = Math.max(10, Math.round(size * 0.28))

  return (
    <div
      className={`relative inline-flex rounded-full ring-2 ring-offset-2 ring-offset-clay-bg ${tier.tone.ring} ${className}`}
      title={`当前身份：${tier.label}`}
    >
      <ClayAvatar name={name} src={src} size={size} />
      <span
        className={`absolute -right-0.5 -bottom-0.5 flex items-center justify-center rounded-full border-2 border-clay-bg ${tier.tone.dot} text-white shadow-clay-sm`}
        style={{ width: dotSize, height: dotSize }}
      >
        <TierIcon tier={tier} className="w-2.5 h-2.5" />
      </span>
    </div>
  )
}

export function MembershipCard({ user }) {
  const tier = getMembershipTier(user?.group)

  return (
    <div className={`rounded-clay border ${tier.tone.border} ${tier.tone.softBg} p-4 shadow-clay-inset`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className={`inline-flex items-center gap-2 ${tier.tone.text} font-black`}>
            <TierIcon tier={tier} />
            {tier.label}
          </div>
          <div className="mt-1 text-xs text-clay-faint font-bold">{tier.tagline}</div>
          <div className="mt-2 text-[11px] text-clay-faint font-bold truncate">
            系统分组：{user?.group || 'default'}
          </div>
        </div>
      </div>
    </div>
  )
}
