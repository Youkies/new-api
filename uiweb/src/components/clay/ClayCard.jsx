const densityClass = {
  comfortable: '',
  cozy: '!p-6',
  compact: '!p-5',
  tight: '!p-4',
  flush: '!p-0',
}

const toneClass = {
  default: '',
  pink: '!bg-clay-pink-50',
  blue: '!bg-clay-blue-50',
  purple: '!bg-clay-purple-50',
  green: '!bg-clay-green-50',
  yellow: '!bg-clay-yellow-50',
}

export default function ClayCard({
  interactive = false,
  density = 'comfortable',
  tone = 'default',
  className = '',
  children,
  ...rest
}) {
  const base = interactive ? 'clay-card-interactive' : 'clay-card'
  const dn = densityClass[density] ?? densityClass.comfortable
  const tn = toneClass[tone] ?? toneClass.default
  return (
    <div className={`${base} ${dn} ${tn} ${className}`} {...rest}>
      {children}
    </div>
  )
}
