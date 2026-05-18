const toneClass = {
  pink: 'clay-chip-pink',
  blue: 'clay-chip-blue',
  purple: 'clay-chip-purple',
  green: 'clay-chip-green',
  yellow: 'clay-chip-yellow',
  inset: 'clay-chip-inset',
}

const dotToneClass = {
  pink: 'bg-clay-pink-300',
  blue: 'bg-clay-blue-200',
  purple: 'bg-clay-purple-200',
  green: 'bg-clay-green-300',
  yellow: 'bg-clay-yellow-300',
  inset: 'bg-clay-faint/70',
  faint: 'bg-clay-faint/60',
}

export default function ClayBadge({
  tone = 'blue',
  icon = null,
  dot = false,
  className = '',
  children,
  ...rest
}) {
  const cls = toneClass[tone] ?? toneClass.blue
  return (
    <span className={`${cls} ${className}`} {...rest}>
      {dot && (
        <span className={`inline-block w-2 h-2 rounded-full shadow-clay-xs ${dotToneClass[tone] ?? dotToneClass.faint}`} aria-hidden="true" />
      )}
      {icon && !dot && <span className="inline-flex items-center [&_svg]:w-3 [&_svg]:h-3 [&_svg]:stroke-[2.4]">{icon}</span>}
      {children}
    </span>
  )
}

export function ClayStatusDot({ tone = 'green', children, className = '' }) {
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-extrabold text-clay-faint ${className}`}>
      <span className={`inline-block w-2 h-2 rounded-full shadow-clay-xs ${dotToneClass[tone] ?? dotToneClass.faint}`} aria-hidden="true" />
      {children}
    </span>
  )
}
