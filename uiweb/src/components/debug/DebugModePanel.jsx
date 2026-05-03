import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Bug, ChevronDown, X } from 'lucide-react'
import { disableDebugMode, isDebugMode } from '../../utils/debugMode.js'

const LINKS = [
  { to: '/', label: '首页' },
  { to: '/dashboard', label: '仪表盘' },
  { to: '/tokens', label: '令牌' },
  { to: '/api-urls', label: 'URL' },
  { to: '/logs', label: '日志' },
  { to: '/topup', label: '充值' },
  { to: '/checkin', label: '签到' },
  { to: '/personal', label: '设置' },
  { to: '/notifications', label: '通知' },
  { to: '/announcements', label: '公告' },
  { to: '/pricing', label: '定价' },
  { to: '/status', label: '状态' },
  { to: '/admin', label: '管理端' },
  { to: '/admin/announcements', label: '公告管理' },
  { to: '/admin/notifications', label: '通知管理' },
  { to: '/admin/refund-appeals', label: '申诉审核' },
  { to: '/admin/assistant', label: 'AI 助手配置' },
]

export default function DebugModePanel() {
  const [open, setOpen] = useState(false)
  const location = useLocation()
  const envLocked = ['1', 'true', 'yes', 'on'].includes(String(import.meta.env.VITE_UI_DEBUG_MODE || '').toLowerCase())

  if (!isDebugMode()) return null

  const disable = () => {
    disableDebugMode()
    const url = new URL(window.location.href)
    url.searchParams.set('debug', '0')
    window.location.replace(url.toString())
  }

  return (
    <div className="fixed left-3 bottom-3 z-[10020] text-clay-ink">
      <div className="rounded-clay bg-clay-bg/95 shadow-clay border-2 border-white/40 overflow-hidden max-w-[calc(100vw-1.5rem)]">
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className="w-full flex items-center gap-2 px-3 py-2 text-xs font-black"
          title="UI 调试模式"
        >
          <Bug className="w-4 h-4 text-clay-pink-300" />
          UI DEBUG
          <ChevronDown className={`w-3.5 h-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>

        {open && (
          <div className="w-[min(320px,calc(100vw-1.5rem))] p-3 pt-1">
            <div className="mb-2 text-[11px] leading-5 font-bold text-clay-faint">
              当前使用 mock 用户和 mock API，不连接数据库。
            </div>
            <div className="grid grid-cols-2 gap-2">
              {LINKS.map((item) => {
                const active = location.pathname === item.to
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    className={`px-3 py-2 rounded-clay-sm text-xs font-black transition-all ${
                      active
                        ? 'bg-clay-pink-100 text-[#8a4860] shadow-clay-sm'
                        : 'bg-white/35 hover:bg-white/55 text-clay-faint'
                    }`}
                  >
                    {item.label}
                  </Link>
                )
              })}
            </div>
            {import.meta.env.DEV && !envLocked && (
              <button
                type="button"
                onClick={disable}
                className="mt-3 w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded-clay-sm bg-clay-bg shadow-clay-inset text-xs font-black text-clay-faint hover:text-clay-pink-400"
              >
                <X className="w-3.5 h-3.5" />
                关闭本地调试模式
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
