import ClayNav from './ClayNav.jsx'
import ClayFooter from './ClayFooter.jsx'

export default function ClayPageShell({
  children,
  showNav = true,
  showFooter = true,
  hideGuestActions = false,
  compactNav = false,
}) {
  return (
    <div className="min-h-screen bg-clay-bg">
      <div className="max-w-6xl mx-auto px-6 md:px-8 py-8">
        {showNav && <ClayNav hideGuestActions={hideGuestActions} compactBottom={compactNav} />}
        {children}
        {showFooter && <ClayFooter />}
      </div>
    </div>
  )
}
