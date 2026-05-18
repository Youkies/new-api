import { Link } from 'react-router-dom'

export default function ClayLink({ to, href, className = '', children, ...rest }) {
  const cls = `font-bold text-clay-blue-ink hover:text-clay-blue-300 underline-offset-4 hover:underline transition-colors ${className}`
  if (to) {
    return (
      <Link to={to} className={cls} {...rest}>
        {children}
      </Link>
    )
  }
  return (
    <a href={href} className={cls} {...rest}>
      {children}
    </a>
  )
}
