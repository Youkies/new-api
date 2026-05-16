import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { Bell, Bot, Bug, Gamepad2, Home, LayoutDashboard, LogOut, Megaphone, Menu, Settings2, ShieldCheck } from 'lucide-react'
import ClayAvatar from '../clay/ClayAvatar.jsx'
import ClayCard from '../clay/ClayCard.jsx'
import ClayFooter from './ClayFooter.jsx'
import ThemeToggle from './ThemeToggle.jsx'
import { useNotifications } from '../../context/NotificationContext.jsx'
import { useToast } from '../../context/ToastContext.jsx'
import { useUser } from '../../context/UserContext.jsx'
import { logout as apiLogout } from '../../services/auth.js'
import { getFaviconSrc } from '../../utils/favicon.js'

const NAV = [
  { to: '/admin', label: '概览', icon: LayoutDashboard },
  { to: '/admin/announcements', label: '公告', icon: Megaphone },
  { to: '/admin/notifications', label: '通知', icon: Bell },
  { to: '/admin/refund-appeals', label: '申诉', icon: ShieldCheck },
  { to: '/admin/page-config', label: '页面', icon: Settings2 },
  { to: '/admin/playground-foods', label: '游乐场', icon: Gamepad2 },
  { to: '/admin/debug-traces', label: '调试', icon: Bug },
  { to: '/admin/assistant', label: 'AI 助手', icon: Bot },
]

export default function ClayAdminShell({ title, subtitle, actions, children }) {
  const { user, logout } = useUser()
  const { unreadCount, refreshUnread } = useNotifications()
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

  const displayName = user?.display_name || user?.username || 'admin'
  const linkCls = ({ isActive }) =>
    `px-5 py-2.5 rounded-clay-pill font-bold text-sm transition-all flex items-center gap-2 ${
      isActive
        ? 'bg-clay-blue-100 text-[#2c5582] shadow-clay'
        : 'text-clay-faint hover:text-clay-ink'
    }`

  return (
    <div className="min-h-screen bg-clay-bg">
      <div className="max-w-7xl mx-auto px-5 md:px-8 py-6">
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
            <Link to="/admin" className="flex items-center gap-2">
              <ClayCard
                interactive
                className="!p-2 !px-4 !rounded-clay-pill !flex-row !flex gap-2 items-center !border-0"
              >
                <img src={getFaviconSrc()} alt="logo" className="w-5 h-5" />
                <span className="font-black">运营后台</span>
              </ClayCard>
            </Link>
          </div>

          <nav className="hidden md:flex items-center gap-1 p-2 rounded-clay-pill bg-clay-bg shadow-clay-inset">
            {NAV.map((n) => {
              const Icon = n.icon
              return (
                <NavLink key={n.to} to={n.to} end={n.to === '/admin'} className={linkCls}>
                  <Icon className="w-4 h-4" strokeWidth={2.5} />
                  {n.label}
                </NavLink>
              )
            })}
          </nav>

          <div className="flex items-center gap-3">
            <ThemeToggle />
            <div className="relative" ref={userRef}>
              <button
                type="button"
                onClick={() => {
                  setUserOpen((v) => !v)
                  refreshUnread()
                }}
                className="flex items-center gap-2 sm:pr-4 sm:pl-2 sm:py-1.5 rounded-full sm:rounded-clay-pill sm:bg-clay-bg sm:shadow-clay sm:hover:shadow-clay-hover transition-shadow"
              >
                <span className="relative inline-flex">
                  <ClayAvatar
                    name={displayName}
                    src={user?.has_avatar ? `/api/user/avatar/${user.id}?t=${user._avatar_t || ''}` : undefined}
                    size={40}
                  />
                  {unreadCount > 0 && (
                    <span className="absolute -right-1 -top-1 w-3 h-3 rounded-full border-2 border-clay-bg bg-clay-pink-400 shadow-clay-sm" />
                  )}
                </span>
                <span className="font-bold text-sm hidden sm:inline">{displayName}</span>
              </button>

              {userOpen && (
                <div className="absolute right-0 mt-3 w-56 p-2 rounded-clay bg-clay-bg shadow-clay z-50">
                  <Link
                    to="/"
                    className="flex items-center gap-2 px-4 py-2.5 rounded-clay-sm text-sm font-bold hover:bg-white/40"
                  >
                    <Home className="w-4 h-4" />
                    返回首页
                  </Link>
                  <Link
                    to="/notifications"
                    className="flex items-center justify-between gap-2 px-4 py-2.5 rounded-clay-sm text-sm font-bold hover:bg-white/40"
                  >
                    <span className="flex items-center gap-2">
                      <Bell className="w-4 h-4" />
                      通知中心
                    </span>
                    {unreadCount > 0 && (
                      <span className="min-w-6 h-6 px-2 rounded-clay-pill bg-clay-pink-100 text-[#8a4860] text-xs font-black flex items-center justify-center">
                        {unreadCount > 99 ? '99+' : unreadCount}
                      </span>
                    )}
                  </Link>
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
          </div>
        </header>

        {menuOpen && (
          <div className="md:hidden mb-6">
            <ClayCard className="!p-3 flex flex-col gap-2">
              {NAV.map((n) => {
                const Icon = n.icon
                return (
                  <NavLink
                    key={n.to}
                    to={n.to}
                    end={n.to === '/admin'}
                    className={linkCls}
                    onClick={() => setMenuOpen(false)}
                  >
                    <Icon className="w-4 h-4" />
                    {n.label}
                  </NavLink>
                )
              })}
            </ClayCard>
          </div>
        )}

        {(title || subtitle || actions) && (
          <div className="flex items-end justify-between gap-4 flex-wrap mb-6">
            <div>
              {title && <h1 className="text-3xl md:text-4xl font-black tracking-tight">{title}</h1>}
              {subtitle && <p className="text-clay-faint mt-1 text-base">{subtitle}</p>}
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
