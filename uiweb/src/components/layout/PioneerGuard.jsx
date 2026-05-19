import { Sparkles, ExternalLink } from 'lucide-react'
import { useLocation } from 'react-router-dom'
import { useStatus } from '../../context/StatusContext.jsx'
import { useUser } from '../../context/UserContext.jsx'

/**
 * Renders a full-screen "Pioneer only" notice when this slave node is gated
 * (`status.slave_pioneer_only === true`) and the current visitor is not eligible.
 *
 * Eligibility:
 *   - Admin or above (role >= 10) — always allowed (so site operators can manage)
 *   - Logged-in user with `user.pioneer === true`
 *
 * Auth-related routes (login / register / oauth / reset / setup) are always
 * passed through; otherwise a user already logged in via /legacy/ but never via
 * uiweb would be stuck — uiweb's UserContext only hydrates from localStorage
 * during the uiweb login flow, so we must let people reach /login before the
 * gate can do its work.
 */
const AUTH_PATH_PREFIXES = ['/login', '/register', '/reset', '/user/reset', '/oauth/', '/setup', '/forbidden']

export default function PioneerGuard({ children }) {
  const { status } = useStatus()
  const { user } = useUser()
  const location = useLocation()

  const gated = Boolean(status?.slave_pioneer_only)
  if (!gated) return children

  if (AUTH_PATH_PREFIXES.some((p) => location.pathname === p || location.pathname.startsWith(p))) {
    return children
  }

  const role = Number(user?.role) || 0
  if (role >= 10) return children
  if (user?.pioneer) return children

  const mainSite = (status?.primary_site_url || 'https://newapi.youkies.space').replace(/\/$/, '')
  const isAnonymous = !user

  return (
    <div className="min-h-screen w-full flex items-center justify-center px-6 bg-clay-bg">
      <div className="max-w-md w-full clay-card bg-white shadow-clay rounded-clay-lg p-8 text-center space-y-5">
        <div className="mx-auto w-16 h-16 rounded-full bg-clay-purple-100 shadow-clay-sm flex items-center justify-center">
          <Sparkles className="w-8 h-8 text-clay-purple-ink" strokeWidth={2.5} />
        </div>
        <div>
          <h1 className="text-2xl font-black text-clay-ink">Pioneer 优先锋计划</h1>
          <p className="text-xs text-clay-faint font-bold mt-1">专属节点 · 早鸟权益</p>
        </div>
        <p className="text-sm text-clay-ink leading-relaxed">
          {isAnonymous
            ? '本站点为 Pioneer 优先锋计划专属节点。请先登录，未开通该计划的账号将无法使用 API。'
            : '您当前的账号尚未开通 Pioneer 优先锋计划。请前往主站正常使用 API，或联系站长申请加入计划。'}
        </p>
        <div className="flex flex-col gap-2">
          {isAnonymous && (
            <a
              href="/login"
              className="inline-flex items-center justify-center gap-2 w-full px-5 py-3 rounded-clay-pill bg-clay-purple-100 text-clay-purple-ink font-black shadow-clay hover:shadow-clay-hover transition-all"
            >
              登录看看
            </a>
          )}
          <a
            href={mainSite}
            className={`inline-flex items-center justify-center gap-2 w-full px-5 py-3 rounded-clay-pill font-black transition-all ${
              isAnonymous
                ? 'bg-clay-bg shadow-clay-sm text-clay-ink hover:shadow-clay'
                : 'bg-clay-purple-100 text-clay-purple-ink shadow-clay hover:shadow-clay-hover'
            }`}
          >
            返回主站
            <ExternalLink className="w-4 h-4" strokeWidth={2.5} />
          </a>
        </div>
        <div className="text-[11px] text-clay-faint font-mono break-all">{mainSite}</div>
      </div>
    </div>
  )
}
