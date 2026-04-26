import { Link } from 'react-router-dom'
import ClayCard from '../clay/ClayCard.jsx'
import { getFaviconSrc } from '../../utils/favicon.js'

export default function ClayAuthShell({ title, subtitle, children, footer }) {
  const logoSrc = getFaviconSrc()
  return (
    <div className="min-h-screen bg-clay-bg flex items-center justify-center px-4 py-8 relative overflow-hidden">
      {/* decorative blobs */}
      <div
        className="absolute w-72 h-72 bg-clay-pink-100 shadow-clay animate-float -top-16 -left-20 opacity-70 pointer-events-none"
      />
      <div
        className="absolute w-64 h-64 bg-clay-blue-100 shadow-clay animate-float bottom-0 -right-16 opacity-70 pointer-events-none"
        style={{ animationDelay: '2s' }}
      />
      <div
        className="absolute w-44 h-44 bg-clay-green-100 shadow-clay animate-float top-1/3 right-10 opacity-50 pointer-events-none"
        style={{ animationDelay: '1s' }}
      />

      <div className="relative w-full max-w-md">
        <Link to="/" className="flex items-center justify-center gap-2 mb-6 text-clay-ink">
          <img src={logoSrc} alt="logo" className="w-6 h-6" />
          <span className="font-black text-xl">Youkies API · Clay</span>
        </Link>

        <ClayCard className="!p-8">
          {title && (
            <h1 className="text-3xl font-black mb-2 tracking-tight text-center">{title}</h1>
          )}
          {subtitle && (
            <p className="text-clay-faint text-center mb-6">{subtitle}</p>
          )}
          {children}
        </ClayCard>

        {footer && <div className="mt-6 text-center text-sm">{footer}</div>}
      </div>
    </div>
  )
}
