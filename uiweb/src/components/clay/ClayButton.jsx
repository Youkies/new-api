const variantClass = {
  primary: 'clay-btn-primary',
  secondary: 'clay-btn-secondary',
  accent: 'clay-btn-accent',
  ghost: 'clay-btn-ghost',
  danger: 'clay-btn-danger',
  warning: 'clay-btn-warning',
}

const sizeClass = {
  xs: '!px-3 !py-1.5 !text-xs !gap-1',
  sm: '!px-4 !py-2 !text-sm !gap-1.5',
  md: '',
  lg: '!px-10 !py-4 !text-base !gap-2.5',
}

export default function ClayButton({
  as: Tag = 'button',
  variant = 'primary',
  size = 'md',
  className = '',
  loading = false,
  disabled = false,
  children,
  ...rest
}) {
  const v = variantClass[variant] ?? variantClass.primary
  const s = sizeClass[size] ?? sizeClass.md
  const stateCls = disabled || loading ? 'opacity-60 pointer-events-none' : ''
  return (
    <Tag
      className={`${v} ${s} ${stateCls} ${className}`}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {children}
    </Tag>
  )
}
