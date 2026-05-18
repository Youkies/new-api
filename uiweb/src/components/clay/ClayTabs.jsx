export default function ClayTabs({ value, onChange, items = [], className = '' }) {
  return (
    <div className={`max-w-full overflow-x-auto pb-1 [scrollbar-width:none] ${className}`}>
      <div className="inline-flex min-w-max p-2 rounded-clay-pill bg-clay-bg shadow-clay-inset gap-1">
        {items.map((it) => {
          const active = it.value === value
          const Icon = it.icon
          return (
            <button
              key={it.value}
              type="button"
              onClick={() => onChange?.(it.value)}
              className={`inline-flex shrink-0 items-center gap-1.5 sm:gap-2 px-4 sm:px-5 py-2 rounded-clay-pill text-sm font-extrabold whitespace-nowrap transition-all duration-200 ease-clay ${
                active
                  ? 'bg-clay-pink-100 text-clay-pink-ink shadow-clay-sm'
                  : 'text-clay-faint hover:text-clay-ink hover:shadow-clay-xs hover:bg-clay-surface/60'
              }`}
            >
              {Icon && <Icon className="w-4 h-4 shrink-0" strokeWidth={2.5} />}
              <span>{it.label}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
