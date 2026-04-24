import { Link, NavLink } from 'react-router-dom'
import { Box, LogIn, UserPlus } from 'lucide-react'
import ClayButton from '../clay/ClayButton.jsx'
import ClayCard from '../clay/ClayCard.jsx'
import { useUser } from '../../context/UserContext.jsx'

const linkBase =
  'px-4 py-2 rounded-clay-pill font-bold text-sm transition-all hover:text-clay-pink-300'
const linkActive = 'text-clay-pink-300'

export default function ClayNav() {
  const { user } = useUser()

  return (
    <header className="flex justify-between items-center mb-10 gap-4 flex-wrap">
      <Link to="/">
        <ClayCard
          interactive
          className="!p-2 !px-5 !rounded-clay-pill !flex-row !flex gap-2 items-center !border-0"
        >
          <Box className="w-5 h-5" strokeWidth={2.5} />
          <span className="font-black text-lg">New API · Clay</span>
        </ClayCard>
      </Link>

      <nav className="hidden md:flex gap-1 items-center">
        <NavLink to="/" end className={({ isActive }) => `${linkBase} ${isActive ? linkActive : ''}`}>
          首页
        </NavLink>
        <NavLink to="/pricing" className={({ isActive }) => `${linkBase} ${isActive ? linkActive : ''}`}>
          定价
        </NavLink>
        <NavLink to="/status" className={({ isActive }) => `${linkBase} ${isActive ? linkActive : ''}`}>
          状态
        </NavLink>
        <NavLink to="/about" className={({ isActive }) => `${linkBase} ${isActive ? linkActive : ''}`}>
          关于
        </NavLink>
      </nav>

      <div className="flex gap-3">
        {user ? (
          <Link to="/dashboard">
            <ClayButton variant="primary" className="!px-6 !py-2 !text-sm">
              进入控制台
            </ClayButton>
          </Link>
        ) : (
          <>
            <Link to="/login">
              <ClayButton variant="ghost" className="!px-5 !py-2 !text-sm">
                <LogIn className="w-4 h-4" /> 登录
              </ClayButton>
            </Link>
            <Link to="/register">
              <ClayButton variant="primary" className="!px-5 !py-2 !text-sm">
                <UserPlus className="w-4 h-4" /> 注册
              </ClayButton>
            </Link>
          </>
        )}
      </div>
    </header>
  )
}
