const variantClass = {
  primary: 'clay-btn-primary',
  secondary: 'clay-btn-secondary',
  accent: 'clay-btn-accent',
  ghost: 'clay-btn-ghost',
}

export default function ClayButton({
  as: Tag = 'button',
  variant = 'primary',
  className = '',
  children,
  ...rest
}) {
  return (
    <Tag className={`${variantClass[variant] ?? variantClass.primary} ${className}`} {...rest}>
      {children}
    </Tag>
  )
}
