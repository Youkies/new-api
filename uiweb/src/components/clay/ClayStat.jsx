import ClayCard from './ClayCard.jsx'

const TONE = {
  default: 'bg-clay-bg text-clay-ink',
  pink: 'bg-clay-pink-100 text-[#8a4860]',
  blue: 'bg-clay-blue-100 text-[#43658b]',
  green: 'bg-clay-green-100 text-[#3d6b4f]',
  purple: 'bg-clay-purple-100 text-[#6b4d83]',
  yellow: 'bg-clay-yellow-100 text-[#8a6a32]',
}

export default function ClayStat({
  icon: Icon,
  label,
  value,
  hint,
  tone = 'default',
  className = '',
}) {
  const toneCls = TONE[tone] ?? TONE.default
  return (
    <ClayCard
      interactive
      className={`!p-6 ${tone !== 'default' ? '!border-0' : ''} ${toneCls} ${className}`}
    >
      <div className="flex items-start justify-between gap-3 mb-4">
        <span className="text-sm font-bold opacity-75">{label}</span>
        {Icon && (
          <div className="w-10 h-10 rounded-full flex items-center justify-center bg-white/40">
            <Icon className="w-5 h-5" strokeWidth={2.5} />
          </div>
        )}
      </div>
      <div className="text-3xl font-black tracking-tight break-all">{value}</div>
      {hint && <div className="text-xs opacity-70 mt-2 font-semibold">{hint}</div>}
    </ClayCard>
  )
}
