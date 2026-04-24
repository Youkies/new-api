import { useEffect, useMemo, useState } from 'react'
import {
  Wallet,
  Activity,
  TrendingUp,
  Sparkles,
  Clock,
  MessageSquare,
  KeyRound,
  RefreshCw,
} from 'lucide-react'
import ClayCard from '../components/clay/ClayCard.jsx'
import ClayStat from '../components/clay/ClayStat.jsx'
import ClayButton from '../components/clay/ClayButton.jsx'
import ClayTabs from '../components/clay/ClayTabs.jsx'
import ClayAlert from '../components/clay/ClayAlert.jsx'
import ClayConsoleShell from '../components/layout/ClayConsoleShell.jsx'
import { useUser } from '../context/UserContext.jsx'
import { self } from '../services/user.js'
import { selfUsage } from '../services/dashboard.js'
import { quotaToDisplay, formatCount } from '../utils/quota.js'

const RANGES = [
  { value: 1, label: '今日' },
  { value: 7, label: '近 7 天' },
  { value: 30, label: '近 30 天' },
]

export default function Dashboard() {
  const { user, setUser } = useUser()
  const [range, setRange] = useState(7)
  const [loading, setLoading] = useState(false)
  const [series, setSeries] = useState([])
  const [error, setError] = useState('')

  const load = async () => {
    setError('')
    setLoading(true)
    try {
      // Refresh user quota
      try {
        const r = await self()
        if (r?.data) setUser(r.data)
      } catch (_) {}

      const now = Math.floor(Date.now() / 1000)
      const start = now - range * 86400
      const res = await selfUsage(start, now, 'day')
      const data = Array.isArray(res?.data) ? res.data : []
      setSeries(data)
    } catch (err) {
      setError(err?.response?.data?.message ?? err.message ?? '数据加载失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range])

  const stats = useMemo(() => {
    let calls = 0
    let tokens = 0
    let quota = 0
    const byModel = new Map()
    for (const it of series) {
      calls += it.count || 0
      tokens += it.token_used || 0
      quota += it.quota || 0
      const key = it.model_name || 'unknown'
      byModel.set(key, (byModel.get(key) || 0) + (it.count || 0))
    }
    const topModels = [...byModel.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
    return { calls, tokens, quota, topModels }
  }, [series])

  const byDay = useMemo(() => {
    const m = new Map()
    for (const it of series) {
      const d = new Date((it.created_at || 0) * 1000)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      m.set(key, (m.get(key) || 0) + (it.count || 0))
    }
    const entries = [...m.entries()].sort(([a], [b]) => (a < b ? -1 : 1))
    return entries
  }, [series])

  const maxDay = useMemo(() => byDay.reduce((m, [, v]) => Math.max(m, v), 0), [byDay])

  const balance = quotaToDisplay(user?.quota ?? 0)
  const used = quotaToDisplay(user?.used_quota ?? 0)

  return (
    <ClayConsoleShell
      title={`你好,${user?.display_name || user?.username || '伙伴'}`}
      subtitle="这里是你的用量总览"
      actions={
        <ClayButton variant="ghost" onClick={load} disabled={loading} className="!px-5">
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          刷新
        </ClayButton>
      }
    >
      {error && (
        <ClayAlert tone="error" className="mb-6">
          {error}
        </ClayAlert>
      )}

      {/* Key stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
        <ClayStat
          icon={Wallet}
          label="账户余额"
          value={balance.text}
          hint="用于 API 调用结算"
          tone="blue"
        />
        <ClayStat
          icon={Activity}
          label="累计用量"
          value={used.text}
          hint="自注册起总用量"
          tone="pink"
        />
        <ClayStat
          icon={MessageSquare}
          label={`${RANGES.find((r) => r.value === range)?.label} 调用次数`}
          value={formatCount(stats.calls)}
          hint={`共使用 ${formatCount(stats.tokens)} tokens`}
          tone="purple"
        />
        <ClayStat
          icon={TrendingUp}
          label="涉及模型"
          value={stats.topModels.length}
          hint="本周期内被你调用"
          tone="green"
        />
      </div>

      {/* Usage chart (simple bar strip) */}
      <div className="flex items-center justify-between mb-4 gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-clay-pink-300" />
          <h2 className="text-xl font-black tracking-tight">用量趋势</h2>
        </div>
        <ClayTabs
          value={range}
          onChange={setRange}
          items={RANGES.map((r) => ({ value: r.value, label: r.label }))}
        />
      </div>

      <ClayCard className="mb-8">
        {byDay.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-10 text-clay-faint">
            <Clock className="w-8 h-8" />
            <p>这段时间还没有调用记录</p>
          </div>
        ) : (
          <div className="flex items-end gap-2 h-48">
            {byDay.map(([date, count]) => {
              const h = maxDay > 0 ? (count / maxDay) * 100 : 0
              return (
                <div
                  key={date}
                  className="flex-1 flex flex-col items-center justify-end gap-2 group"
                  title={`${date} · ${count} 次`}
                >
                  <div
                    className="w-full rounded-clay-sm bg-clay-blue-100 shadow-clay transition-all duration-300 group-hover:bg-clay-pink-100"
                    style={{ height: `${Math.max(h, 4)}%`, minHeight: 6 }}
                  />
                  <span className="text-[10px] font-bold text-clay-faint truncate w-full text-center">
                    {date.slice(5)}
                  </span>
                </div>
              )
            })}
          </div>
        )}
      </ClayCard>

      {/* Top models */}
      <div className="grid lg:grid-cols-3 gap-6">
        <ClayCard className="lg:col-span-2">
          <h3 className="text-lg font-black mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-clay-purple-300" />
            最常用的模型
          </h3>
          {stats.topModels.length === 0 ? (
            <p className="text-clay-faint text-sm">还没有足够的数据</p>
          ) : (
            <div className="space-y-3">
              {stats.topModels.map(([name, count], i) => {
                const pct = stats.topModels[0][1]
                  ? (count / stats.topModels[0][1]) * 100
                  : 0
                return (
                  <div key={name} className="flex items-center gap-3">
                    <div className="w-6 h-6 rounded-full bg-clay-bg shadow-clay flex items-center justify-center text-[10px] font-black text-clay-faint">
                      {i + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="font-bold text-sm truncate">{name}</span>
                        <span className="text-xs font-bold text-clay-faint shrink-0 ml-3">
                          {formatCount(count)}
                        </span>
                      </div>
                      <div className="h-2 rounded-clay-pill bg-clay-bg shadow-clay-inset overflow-hidden">
                        <div
                          className="h-full rounded-clay-pill bg-clay-pink-200"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </ClayCard>

        <ClayCard className="!bg-clay-pink-100 !border-0 !text-[#8a4860]">
          <div className="clay-icon-box !w-14 !h-14 !bg-white/40 mb-4">
            <KeyRound className="w-6 h-6" strokeWidth={2.5} />
          </div>
          <h3 className="text-lg font-black mb-2">管理 API Token</h3>
          <p className="text-sm opacity-80 mb-5">
            创建、启用或吊销 Token,是控制用量的第一步。
          </p>
          <a href="/console/token">
            <ClayButton variant="ghost" className="!bg-white/50 !text-[#8a4860]">
              去管理
            </ClayButton>
          </a>
        </ClayCard>
      </div>
    </ClayConsoleShell>
  )
}
