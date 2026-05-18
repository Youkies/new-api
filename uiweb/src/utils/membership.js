const MEMBERSHIP_TIERS = [
  {
    key: 'default',
    rank: 0,
    label: '普通用户',
    shortLabel: '普通',
    tagline: '基础额度与标准模型权限',
    icon: 'shield',
    tone: {
      text: 'text-clay-faint',
      bg: 'bg-clay-bg',
      softBg: 'bg-white/45',
      border: 'border-white/40',
      ring: 'ring-clay-faint/30',
      dot: 'bg-clay-faint',
      shadow: 'shadow-clay-sm',
    },
  },
  {
    key: 'standard',
    rank: 1,
    label: 'Standard 优',
    shortLabel: 'Standard',
    tagline: '充值活跃用户专属签到福利',
    icon: 'badge',
    tone: {
      text: 'text-clay-green-ink',
      bg: 'bg-clay-green-100',
      softBg: 'bg-clay-green-100/55',
      border: 'border-clay-green-200/60',
      ring: 'ring-clay-green-200',
      dot: 'bg-clay-green-200',
      shadow: 'shadow-clay',
    },
  },
  {
    key: 'pro',
    rank: 2,
    label: 'Pro优',
    shortLabel: 'Pro',
    tagline: '更优价格与常用高级模型',
    icon: 'sparkles',
    tone: {
      text: 'text-clay-blue-ink',
      bg: 'bg-clay-blue-100',
      softBg: 'bg-clay-blue-100/55',
      border: 'border-clay-blue-200/60',
      ring: 'ring-clay-blue-200',
      dot: 'bg-clay-blue-200',
      shadow: 'shadow-clay',
    },
  },
  {
    key: 'super',
    rank: 3,
    label: 'Super优',
    shortLabel: 'Super',
    tagline: '更高调用优先级与扩展权益',
    icon: 'crown',
    tone: {
      text: 'text-clay-pink-ink',
      bg: 'bg-clay-pink-100',
      softBg: 'bg-clay-pink-100/55',
      border: 'border-clay-pink-200/60',
      ring: 'ring-clay-pink-200',
      dot: 'bg-clay-pink-300',
      shadow: 'shadow-clay',
    },
  },
  {
    key: 'ultra',
    rank: 4,
    label: 'Ultra优',
    shortLabel: 'Ultra',
    tagline: '最高阶权限与旗舰模型体验',
    icon: 'gem',
    tone: {
      text: 'text-clay-yellow-ink',
      bg: 'bg-clay-yellow-100',
      softBg: 'bg-clay-yellow-100/60',
      border: 'border-clay-yellow-200/70',
      ring: 'ring-clay-yellow-200',
      dot: 'bg-clay-yellow-200',
      shadow: 'shadow-clay',
    },
  },
]

let badgeOverrides = {}

function normalizeGroup(group) {
  return String(group || 'default').trim().toLowerCase().replace(/[\s_-]/g, '')
}

function canonicalMembershipKey(group) {
  const normalized = normalizeGroup(group)
  if (normalized.includes('ultra')) return 'ultra'
  if (normalized.includes('super') || normalized.includes('spuer')) return 'super'
  if (normalized.includes('pro')) return 'pro'
  if (normalized.includes('standard') || normalized.includes('stand')) return 'standard'
  return 'default'
}

function applyBadgeOverride(tier) {
  const override = badgeOverrides[tier.key]
  if (!override) return tier
  return {
    ...tier,
    label: override.label || tier.label,
    shortLabel: override.shortLabel || override.short_label || tier.shortLabel,
    tagline: override.tagline || tier.tagline,
  }
}

export function setMembershipBadgeConfig(items) {
  const next = {}
  if (Array.isArray(items)) {
    items.forEach((item) => {
      const key = canonicalMembershipKey(item?.key)
      next[key] = {
        label: String(item?.label || '').trim(),
        shortLabel: String(item?.shortLabel || item?.short_label || '').trim(),
        tagline: String(item?.tagline || '').trim(),
      }
    })
  }
  badgeOverrides = next
}

export function getMembershipTier(group) {
  const key = canonicalMembershipKey(group)
  const tier = MEMBERSHIP_TIERS.find((item) => item.key === key) || MEMBERSHIP_TIERS[0]
  return applyBadgeOverride(tier)
}

export function getMembershipTiers() {
  return MEMBERSHIP_TIERS.map(applyBadgeOverride)
}
