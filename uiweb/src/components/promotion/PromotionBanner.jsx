import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Sparkles, ArrowRight, Clock } from 'lucide-react'
import api from '../../services/api.js'

/**
 * 全站通用活动入口横幅。挂在 /topup 顶部（或其它需要引流的页面），
 * 自动展示当前进行中的活动。无活动时返回 null，对原页面布局零干扰。
 *
 * 多活动并存时只显示第一个（按 setting.activePromotions 注册顺序）。
 * 自带倒计时（60s 更新一次，不需要每秒精度）。
 */
export default function PromotionBanner() {
  const navigate = useNavigate()
  const [active, setActive] = useState(null)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    let cancelled = false
    api.get('/api/promotions/active').then((res) => {
      if (cancelled) return
      const arr = res?.data?.data
      if (Array.isArray(arr) && arr.length > 0) setActive(arr[0])
    }).catch(() => {})
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (!active) return
    const id = setInterval(() => setTick((t) => (t + 1) % 60000), 60000)
    return () => clearInterval(id)
  }, [active])

  if (!active) return null

  const now = Math.floor(Date.now() / 1000)
  const diff = active.ends_at - now
  if (diff <= 0) return null
  const d = Math.floor(diff / 86400)
  const h = Math.floor((diff % 86400) / 3600)
  const m = Math.floor((diff % 3600) / 60)
  const remainText = d > 0 ? `${d} 天 ${h} 时` : h > 0 ? `${h} 时 ${m} 分` : `${m} 分`

  const theme = active.theme_color || 'pink'
  // eslint-disable-next-line no-unused-vars
  const _tickRef = tick // 触发组件因 tick 重渲染

  return (
    <button
      type="button"
      onClick={() => navigate(`/promotion/${active.slug}`)}
      className={`group w-full mb-5 px-4 sm:px-5 py-3 rounded-clay-lg flex items-center gap-3 sm:gap-4 text-left bg-gradient-to-r from-clay-${theme}-50 via-clay-${theme}-100 to-clay-${theme}-50 shadow-clay-sm hover:shadow-clay transition-shadow`}
    >
      <span className="text-2xl sm:text-3xl flex-shrink-0" aria-hidden>
        {active.emoji || '🎉'}
      </span>
      <div className="flex-1 min-w-0">
        <div className={`text-sm sm:text-base font-black text-clay-${theme}-ink truncate`}>
          {active.title}
        </div>
        <div className="text-[11px] sm:text-xs text-clay-faint font-bold flex items-center gap-1 mt-0.5">
          <Clock className="w-3 h-3" strokeWidth={2.5} />
          剩 {remainText} · {active.subtitle || '限时优惠'}
        </div>
      </div>
      <span className={`hidden sm:inline-flex items-center gap-1 px-3 py-1.5 rounded-clay-pill bg-white shadow-clay-sm text-clay-${theme}-ink text-xs font-black flex-shrink-0 group-hover:shadow-clay transition-shadow`}>
        <Sparkles className="w-3 h-3" strokeWidth={2.5} />
        立即查看
        <ArrowRight className="w-3 h-3" strokeWidth={2.5} />
      </span>
      <ArrowRight className={`sm:hidden w-5 h-5 text-clay-${theme}-ink flex-shrink-0`} strokeWidth={2.5} />
    </button>
  )
}
