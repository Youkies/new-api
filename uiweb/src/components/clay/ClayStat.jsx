import ClayCard from './ClayCard.jsx'

const TONE = {
  default: 'bg-clay-bg text-clay-ink',
  pink: 'bg-clay-pink-100 text-clay-pink-ink',
  blue: 'bg-clay-blue-100 text-clay-blue-ink',
  green: 'bg-clay-green-100 text-clay-green-ink',
  purple: 'bg-clay-purple-100 text-clay-purple-ink',
  yellow: 'bg-clay-yellow-100 text-clay-yellow-ink',
}

const ICON_BG = {
  default: 'bg-clay-surface/60',
  pink: 'bg-white/45',
  blue: 'bg-white/45',
  green: 'bg-white/45',
  purple: 'bg-white/45',
  yellow: 'bg-white/45',
}

const PADDING = {
  comfortable: '!p-6',
  compact: '!p-5',
  tight: '!p-4',
}

export default function ClayStat({
  icon: Icon,
  label,
  value,
  hint,
  tone = 'default',
  density = 'comfortable',
  interactive = true,
  className = '',
  valueClassName = '',
}) {
  const toneCls = TONE[tone] ?? TONE.default
  const iconBg = ICON_BG[tone] ?? ICON_BG.default
  const padCls = PADDING[density] ?? PADDING.comfortable
  return (
    <ClayCard
      interactive={interactive}
      className={`${padCls} ${toneCls} ${className}`}
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <span className="text-sm font-extrabold opacity-75">{label}</span>
        {Icon && (
          <div className={`w-10 h-10 rounded-full flex items-center justify-center shadow-clay-sm ${iconBg}`}>
            <Icon className="w-5 h-5" strokeWidth={2.5} />
          </div>
        )}
      </div>
      <div className={`min-w-0 text-3xl font-black tracking-tight break-words ${valueClassName}`}>
        {value}
      </div>
      {hint && <div className="text-xs opacity-70 mt-2 font-bold">{hint}</div>}
    </ClayCard>
  )
}
