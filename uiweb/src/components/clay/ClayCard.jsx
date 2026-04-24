export default function ClayCard({
  interactive = false,
  className = '',
  children,
  ...rest
}) {
  const base = interactive ? 'clay-card-interactive' : 'clay-card'
  return (
    <div className={`${base} ${className}`} {...rest}>
      {children}
    </div>
  )
}
