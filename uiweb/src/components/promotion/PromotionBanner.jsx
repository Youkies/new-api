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
    api.get('/api/user/promotions/active').then((res) => {
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
      className={`group relative w-full mb-5 px-3 sm:px-4 py-2.5 rounded-clay-lg overflow-hidden flex items-center gap-3 text-left bg-white shadow-clay-sm hover:shadow-clay transition-shadow`}
    >
      {/* 左侧细条主题色 */}
      <span className={`absolute left-0 top-0 bottom-0 w-1 bg-clay-${theme}-300`} aria-hidden />

      <span className="text-xl sm:text-2xl flex-shrink-0 select-none ml-1" aria-hidden>
        {active.emoji || '🎉'}
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-sm sm:text-base font-black text-clay-ink truncate">
            {active.title}
          </span>
          <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-clay-pill bg-clay-${theme}-100 text-clay-${theme}-ink text-[10px] font-black flex-shrink-0`}>
            进行中
          </span>
        </div>
        <div className="text-[11px] text-clay-faint font-bold flex items-center gap-1 mt-0.5 truncate">
          <Clock className="w-3 h-3 flex-shrink-0" strokeWidth={2.5} />
          剩 {remainText}
        </div>
      </div>
      <span className={`inline-flex items-center gap-1 px-2.5 sm:px-3 py-1.5 rounded-clay-pill bg-clay-${theme}-100 text-clay-${theme}-ink text-xs font-black flex-shrink-0 group-hover:shadow-clay-sm transition-shadow`}>
        <Sparkles className="w-3 h-3" strokeWidth={2.5} />
        <span className="hidden sm:inline">立即查看</span>
        <ArrowRight className="w-3 h-3" strokeWidth={2.5} />
      </span>
    </button>
  )
}
