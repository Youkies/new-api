const paddingClass = {
  none: 'p-0',
  sm: 'p-3',
  md: 'p-4',
  lg: 'p-5',
  xl: 'p-6',
}

export default function ClayInsetPanel({
  padding = 'md',
  rounded = 'clay',
  className = '',
  children,
  ...rest
}) {
  const pad = paddingClass[padding] ?? paddingClass.md
  const roundedCls =
    rounded === 'clay-sm'
      ? 'rounded-clay-sm'
      : rounded === 'clay-lg'
      ? 'rounded-clay-lg'
      : 'rounded-clay'
  return (
    <div
      className={`clay-inset-panel ${roundedCls} ${pad} ${className}`}
      style={{
        backgroundColor: 'rgb(var(--clay-input))',
        boxShadow: 'var(--clay-shadow-inset-sm)',
      }}
      {...rest}
    >
      {children}
    </div>
  )
}
