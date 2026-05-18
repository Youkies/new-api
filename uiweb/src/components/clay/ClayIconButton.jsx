const sizeClass = {
  sm: 'w-7 h-7',
  md: 'w-8 h-8',
  lg: 'w-10 h-10',
  xl: 'w-12 h-12',
}

const toneClass = {
  default: 'bg-clay-surface text-clay-ink',
  primary: 'bg-clay-blue-100 text-clay-blue-ink',
  danger: 'bg-clay-pink-100 text-clay-pink-ink',
  warning: 'bg-clay-yellow-100 text-clay-yellow-ink',
  success: 'bg-clay-green-100 text-clay-green-ink',
  purple: 'bg-clay-purple-100 text-clay-purple-ink',
  ghost: 'bg-transparent text-clay-faint hover:text-clay-ink',
}

const shadowClass = {
  sm: 'shadow-clay-sm',
  md: 'shadow-clay-sm',
  lg: 'shadow-clay-sm',
  xl: 'shadow-clay',
}

export default function ClayIconButton({
  as: Tag = 'button',
  size = 'md',
  tone = 'default',
  className = '',
  title,
  loading = false,
  disabled = false,
  children,
  type,
  ...rest
}) {
  const sz = sizeClass[size] ?? sizeClass.md
  const tn = toneClass[tone] ?? toneClass.default
  const sd = tone === 'ghost' ? '' : shadowClass[size] ?? shadowClass.md
  const stateCls = disabled || loading ? 'opacity-60 pointer-events-none' : ''
  const hoverCls = tone === 'ghost' ? 'hover:bg-clay-bg/60' : 'hover:shadow-clay-hover active:shadow-clay-active'
  const buttonOnly = Tag === 'button'
    ? { type: type ?? 'button', disabled: disabled || loading }
    : {}
  return (
    <Tag
      title={title}
      aria-label={rest['aria-label'] ?? title}
      {...rest}
      {...buttonOnly}
      className={`inline-flex items-center justify-center rounded-full transition-all duration-200 ease-clay active:scale-95 select-none ${sz} ${tn} ${sd} ${hoverCls} ${stateCls} ${className}`}
    >
      {children}
    </Tag>
  )
}
