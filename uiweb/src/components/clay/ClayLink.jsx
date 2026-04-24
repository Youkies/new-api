import { Link } from 'react-router-dom'

export default function ClayLink({ to, href, className = '', children, ...rest }) {
  const cls = `font-bold text-clay-blue-300 hover:text-clay-pink-300 transition-colors ${className}`
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
