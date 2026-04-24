import ClayNav from './ClayNav.jsx'
import ClayFooter from './ClayFooter.jsx'

export default function ClayPageShell({ children, showNav = true, showFooter = true }) {
  return (
    <div className="min-h-screen bg-clay-bg">
      <div className="max-w-6xl mx-auto px-6 md:px-8 py-8">
        {showNav && <ClayNav />}
        {children}
        {showFooter && <ClayFooter />}
      </div>
    </div>
  )
}
