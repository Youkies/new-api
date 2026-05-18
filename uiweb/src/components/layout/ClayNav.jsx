import { Link, NavLink } from 'react-router-dom'
import { LogIn, UserPlus } from 'lucide-react'
import ClayButton from '../clay/ClayButton.jsx'
import { MembershipAvatar } from '../membership/MembershipBadge.jsx'
import ThemeToggle from './ThemeToggle.jsx'
import { useUser } from '../../context/UserContext.jsx'
import { getFaviconSrc } from '../../utils/favicon.js'

const linkBase =
  'px-4 py-2 rounded-clay-pill font-extrabold text-sm transition-all text-clay-faint hover:text-clay-ink'
const linkActive = '!text-clay-ink shadow-clay-sm bg-clay-surface'

export default function ClayNav({ hideGuestActions = false, compactBottom = false }) {
  const { user } = useUser()
  const logoSrc = getFaviconSrc()

  return (
    <header className={`flex items-center justify-between gap-3 ${compactBottom ? 'mb-3' : 'mb-10'}`}>
      <Link
        to="/"
        className="min-w-0 inline-flex items-center gap-2 px-4 py-2 rounded-clay-pill bg-clay-surface shadow-clay-sm hover:shadow-clay-hover transition-all duration-300 ease-clay"
      >
        <img src={logoSrc} alt="logo" className="w-6 h-6 shrink-0" />
        <span className="truncate text-base font-black md:text-lg text-clay-ink">Youkies API</span>
      </Link>

      <nav className="hidden md:flex gap-1 items-center px-2 py-1 rounded-clay-pill bg-clay-bg shadow-clay-inset-sm">
        <NavLink to="/" end className={({ isActive }) => `${linkBase} ${isActive ? linkActive : ''}`}>
          首页
        </NavLink>
        <NavLink to="/pricing" className={({ isActive }) => `${linkBase} ${isActive ? linkActive : ''}`}>
          定价
        </NavLink>
        <NavLink to="/status" className={({ isActive }) => `${linkBase} ${isActive ? linkActive : ''}`}>
          状态
        </NavLink>
        <NavLink to="/announcements" className={({ isActive }) => `${linkBase} ${isActive ? linkActive : ''}`}>
          公告
        </NavLink>
        <NavLink to="/about" className={({ isActive }) => `${linkBase} ${isActive ? linkActive : ''}`}>
          关于
        </NavLink>
      </nav>

      <div className="flex shrink-0 gap-3 items-center">
        <ThemeToggle />
        {user ? (
          <Link to="/dashboard" className="flex items-center gap-2">
            <MembershipAvatar
              user={user}
              name={user.display_name || user.username || '?'}
              src={user.has_avatar ? `/api/user/avatar/${user.id}?t=${user._avatar_t || ''}` : undefined}
              size={34}
            />
            <ClayButton variant="primary" size="sm" className="hidden md:flex">
              进入控制台
            </ClayButton>
          </Link>
        ) : hideGuestActions ? null : (
          <>
            <Link to="/login">
              <ClayButton variant="ghost" size="sm">
                <LogIn className="w-4 h-4" /> 登录
              </ClayButton>
            </Link>
            <Link to="/register">
              <ClayButton variant="primary" size="sm">
                <UserPlus className="w-4 h-4" /> 注册
              </ClayButton>
            </Link>
          </>
        )}
      </div>
    </header>
  )
}
