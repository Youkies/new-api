import { ArrowUpRight, Crown, Gem, ShieldCheck, Sparkles } from 'lucide-react'
import ClayAvatar from '../clay/ClayAvatar.jsx'
import {
  getMembershipTier,
  getMembershipUpgradeUrl,
  getNextMembershipTier,
} from '../../utils/membership.js'

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

export function MembershipBadge({ user, compact = false, showUpgrade = false, className = '' }) {
  const tier = getMembershipTier(user?.group)
  const nextTier = getNextMembershipTier(user?.group)
  const upgradeUrl = getMembershipUpgradeUrl()

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
      {showUpgrade && nextTier && upgradeUrl && (
        <a
          href={upgradeUrl}
          target="_blank"
          rel="noreferrer"
          className="ml-1 inline-flex items-center gap-1 rounded-clay-pill bg-white/45 px-2 py-0.5 text-xs font-black hover:bg-white/70"
        >
          升级
          <ArrowUpRight className="w-3 h-3" />
        </a>
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
  const nextTier = getNextMembershipTier(user?.group)
  const upgradeUrl = getMembershipUpgradeUrl()

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
        {nextTier && upgradeUrl && (
          <a
            href={upgradeUrl}
            target="_blank"
            rel="noreferrer"
            className="shrink-0 inline-flex items-center gap-1 rounded-clay-pill bg-clay-bg px-3 py-1.5 text-xs font-black shadow-clay hover:shadow-clay-hover"
          >
            升级
            <ArrowUpRight className="w-3 h-3" />
          </a>
        )}
      </div>
      {nextTier && (
        <div className="mt-3 text-xs text-clay-faint font-bold">
          下一阶层：<span className="text-clay-ink">{nextTier.label}</span>
        </div>
      )}
    </div>
  )
}
