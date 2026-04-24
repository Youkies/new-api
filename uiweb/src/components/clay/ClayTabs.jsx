export default function ClayTabs({ value, onChange, items = [], className = '' }) {
  return (
    <div
      className={`inline-flex p-2 rounded-clay-pill bg-clay-bg shadow-clay-inset gap-1 ${className}`}
    >
      {items.map((it) => {
        const active = it.value === value
        const Icon = it.icon
        return (
          <button
            key={it.value}
            type="button"
            onClick={() => onChange?.(it.value)}
            className={`inline-flex items-center gap-2 px-5 py-2 rounded-clay-pill text-sm font-extrabold transition-all ${
              active
                ? 'bg-clay-pink-100 text-[#8a4860] shadow-clay'
                : 'text-clay-faint hover:text-clay-ink'
            }`}
          >
            {Icon && <Icon className="w-4 h-4" strokeWidth={2.5} />}
            {it.label}
          </button>
        )
      })}
    </div>
  )
}
