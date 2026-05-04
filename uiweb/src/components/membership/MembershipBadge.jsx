import { useEffect, useState } from 'react'
import { BadgeCheck, Crown, Gem, ShieldCheck, Sparkles } from 'lucide-react'
import ClayAvatar from '../clay/ClayAvatar.jsx'
import { getMembershipTier, setMembershipBadgeConfig } from '../../utils/membership.js'
import { getPageConfig } from '../../services/pageConfig.js'

let membershipConfigPromise = null

function loadMembershipBadgeConfig() {
  if (!membershipConfigPromise) {
    membershipConfigPromise = getPageConfig()
      .then((res) => {
        setMembershipBadgeConfig(res?.data?.membership_badges)
      })
      .catch(() => {})
  }
  return membershipConfigPromise
}

function useMembershipTier(group) {
  const [version, setVersion] = useState(0)

  useEffect(() => {
    let mounted = true
    loadMembershipBadgeConfig().then(() => {
      if (mounted) setVersion((value) => value + 1)
    })
    return () => {
      mounted = false
    }
  }, [])

  return getMembershipTier(group, version)
}

const ICONS = {
  badge: BadgeCheck,
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
  const tier = useMembershipTier(user?.group)

  return (
    <div
      className={`inline-flex items-center gap-2 rounded-clay-pill border ${tier.tone.border} ${tier.tone.bg} ${tier.tone.text} ${tier.tone.shadow} px-3 py-1.5 font-black whitespace-nowrap ${className}`}
      title={`当前身份：${tier.label}`}
    >
      <TierIcon tier={tier} className="w-4 h-4 shrink-0" />
      <span className={compact ? 'text-xs' : 'text-sm'}>{tier.label}</span>
      {!compact && (
        <span className="hidden sm:inline text-xs font-bold opacity-70">{tier.tagline}</span>
      )}
    </div>
  )
}

export function MembershipAvatar({ user, name, src, size = 40, className = '', unread = false }) {
  const tier = useMembershipTier(user?.group)
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
      {unread && (
        <span
          className="absolute -right-1 -top-1 rounded-full border-2 border-clay-bg bg-clay-pink-400 shadow-clay-sm"
          style={{ width: Math.max(11, Math.round(size * 0.26)), height: Math.max(11, Math.round(size * 0.26)) }}
        />
      )}
    </div>
  )
}

export function MembershipCard({ user }) {
  const tier = useMembershipTier(user?.group)

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
