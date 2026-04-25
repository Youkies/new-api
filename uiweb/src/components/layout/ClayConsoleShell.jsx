import { useState, useRef, useEffect } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import {
  Box,
  LayoutDashboard,
  Wallet,
  MessageSquare,
  Settings,
  LogOut,
  Menu,
  ExternalLink,
  KeyRound,
  FileText,
  CalendarCheck2,
} from 'lucide-react'
import ClayCard from '../clay/ClayCard.jsx'
import ClayAvatar from '../clay/ClayAvatar.jsx'
import ClayFooter from './ClayFooter.jsx'
import { useUser } from '../../context/UserContext.jsx'
import { useToast } from '../../context/ToastContext.jsx'
import { logout as apiLogout } from '../../services/auth.js'

// Items hosted natively in uiweb (Stage 2 scope)
const NAV = [
  { to: '/dashboard', label: '仪表盘', icon: LayoutDashboard },
  { to: '/tokens', label: '令牌', icon: KeyRound },
  { to: '/logs', label: '日志', icon: FileText },
  { to: '/topup', label: '充值', icon: Wallet },
  { to: '/checkin', label: '签到', icon: CalendarCheck2 },
  { to: '/personal', label: '设置', icon: Settings },
]

const LEGACY = [
  { href: '/legacy/playground', label: '游乐场', icon: MessageSquare },
]

export default function ClayConsoleShell({ title, subtitle, actions, children }) {
  const { user, logout } = useUser()
  const navigate = useNavigate()
  const toast = useToast()

  const [menuOpen, setMenuOpen] = useState(false)
  const [userOpen, setUserOpen] = useState(false)
  const userRef = useRef(null)

  useEffect(() => {
    const onDown = (e) => {
      if (userRef.current && !userRef.current.contains(e.target)) setUserOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [])

  const onLogout = async () => {
    try {
      await apiLogout()
    } catch (_) {}
    logout()
    toast('已退出登录', 'info')
    navigate('/login', { replace: true })
  }

  const displayName = user?.display_name || user?.username || 'user'

  const linkCls = ({ isActive }) =>
    `px-5 py-2.5 rounded-clay-pill font-bold text-sm transition-all flex items-center gap-2 ${
      isActive
        ? 'bg-clay-pink-100 text-[#8a4860] shadow-clay'
        : 'text-clay-faint hover:text-clay-ink'
    }`

  return (
    <div className="min-h-screen bg-clay-bg">
      <div className="max-w-7xl mx-auto px-5 md:px-8 py-6">
        {/* Top bar */}
        <header className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              className="md:hidden w-11 h-11 rounded-full bg-clay-bg shadow-clay flex items-center justify-center"
              aria-label="菜单"
            >
              <Menu className="w-5 h-5" />
            </button>
            <Link to="/" className="flex items-center gap-2">
              <ClayCard
                interactive
                className="!p-2 !px-4 !rounded-clay-pill !flex-row !flex gap-2 items-center !border-0"
              >
                <Box className="w-5 h-5" strokeWidth={2.5} />
                <span className="font-black">Youkies API</span>
              </ClayCard>
            </Link>
          </div>

          {/* Desktop nav */}
          <nav className="hidden md:flex items-center gap-1 p-2 rounded-clay-pill bg-clay-bg shadow-clay-inset">
            {NAV.map((n) => {
              const Icon = n.icon
              return (
                <NavLink key={n.to} to={n.to} className={linkCls}>
                  <Icon className="w-4 h-4" strokeWidth={2.5} />
                  {n.label}
                </NavLink>
              )
            })}
          </nav>

          {/* User menu */}
          <div className="relative" ref={userRef}>
            <button
              type="button"
              onClick={() => setUserOpen((v) => !v)}
              className="flex items-center gap-2 sm:pr-4 sm:pl-2 sm:py-1.5 rounded-full sm:rounded-clay-pill sm:bg-clay-bg sm:shadow-clay sm:hover:shadow-clay-hover transition-shadow"
            >
              <ClayAvatar name={displayName} src={user?.has_avatar ? `/api/user/avatar/${user.id}?t=${user._avatar_t || ''}` : undefined} size={40} />
              <span className="font-bold text-sm hidden sm:inline">{displayName}</span>
            </button>

            {userOpen && (
              <div className="absolute right-0 mt-3 w-56 p-2 rounded-clay bg-clay-bg shadow-clay z-50">
                <div className="px-4 py-3 border-b border-black/5 mb-2">
                  <div className="font-extrabold truncate">{displayName}</div>
                  <div className="text-xs text-clay-faint truncate">
                    {user?.email || `ID ${user?.id ?? '-'}`}
                  </div>
                </div>
                {LEGACY.map((l) => {
                  const Icon = l.icon
                  return (
                    <a
                      key={l.href}
                      href={l.href}
                      className="flex items-center justify-between gap-2 px-4 py-2.5 rounded-clay-sm text-sm font-bold hover:bg-white/40"
                    >
                      <span className="flex items-center gap-2">
                        <Icon className="w-4 h-4" />
                        {l.label}
                      </span>
                      <ExternalLink className="w-3.5 h-3.5 text-clay-faint" />
                    </a>
                  )
                })}
                <a
                  href="/legacy"
                  className="flex items-center justify-between gap-2 px-4 py-2.5 rounded-clay-sm text-sm font-bold hover:bg-white/40"
                >
                  <span>访问经典控制台</span>
                  <ExternalLink className="w-3.5 h-3.5 text-clay-faint" />
                </a>
                <button
                  type="button"
                  onClick={onLogout}
                  className="w-full flex items-center gap-2 px-4 py-2.5 rounded-clay-sm text-sm font-bold text-clay-pink-400 hover:bg-clay-pink-100/40 mt-2"
                >
                  <LogOut className="w-4 h-4" />
                  退出登录
                </button>
              </div>
            )}
          </div>
        </header>

        {/* Mobile drawer */}
        {menuOpen && (
          <div className="md:hidden mb-6">
            <ClayCard className="!p-3 flex flex-col gap-2">
              {NAV.map((n) => {
                const Icon = n.icon
                return (
                  <NavLink
                    key={n.to}
                    to={n.to}
                    className={linkCls}
                    onClick={() => setMenuOpen(false)}
                  >
                    <Icon className="w-4 h-4" />
                    {n.label}
                  </NavLink>
                )
              })}
              <div className="h-px bg-black/5 my-1" />
              {LEGACY.map((l) => {
                const Icon = l.icon
                return (
                  <a
                    key={l.href}
                    href={l.href}
                    className="px-5 py-2.5 rounded-clay-pill font-bold text-sm text-clay-faint flex items-center justify-between"
                  >
                    <span className="flex items-center gap-2">
                      <Icon className="w-4 h-4" />
                      {l.label}
                    </span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )
              })}
            </ClayCard>
          </div>
        )}

        {/* Page title */}
        {(title || subtitle || actions) && (
          <div className="flex items-end justify-between gap-4 flex-wrap mb-6">
            <div>
              {title && (
                <h1 className="text-3xl md:text-4xl font-black tracking-tight">{title}</h1>
              )}
              {subtitle && (
                <p className="text-clay-faint mt-1 text-base">{subtitle}</p>
              )}
            </div>
            {actions && <div className="flex gap-3 items-center">{actions}</div>}
          </div>
        )}

        <main>{children}</main>

        <ClayFooter />
      </div>
    </div>
  )
}
