export default function ClayProgress({ value = 0, max = 100, tone = 'purple', className = '' }) {
  const pct = Math.max(0, Math.min(100, (value / (max || 1)) * 100))

  const bar = {
    pink: 'bg-clay-pink-200',
    blue: 'bg-clay-blue-200',
    green: 'bg-clay-green-200',
    purple: 'bg-clay-purple-200',
    yellow: 'bg-clay-yellow-200',
  }[tone] ?? 'bg-clay-purple-200'

  return (
    <div className={`w-full h-4 rounded-clay-pill bg-clay-bg shadow-clay-inset overflow-hidden ${className}`}>
      <div
        className={`h-full rounded-clay-pill shadow-clay ${bar} transition-all duration-500 ease-clay`}
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}
