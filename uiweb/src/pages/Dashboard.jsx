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

function fmtDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const BAR_AREA_H = 180

function UsageChart({ data, range }) {
  const [activeIdx, setActiveIdx] = useState(null)
  const maxVal = useMemo(() => Math.max(...data.map((d) => d.value), 1), [data])
  const needScroll = data.length > 10

  const shouldShowLabel = (i) => {
    if (range === 1) return i % 3 === 0 || i === data.length - 1
    if (range === 30) return i % 5 === 0 || i === data.length - 1
    return true
  }

  return (
    <div>
      <div
        className={`rounded-[28px] bg-clay-bg shadow-clay-inset pt-11 px-4 pb-4 sm:pt-12 sm:px-6 sm:pb-6 ${needScroll ? 'overflow-x-auto' : ''}`}
      >
        <div style={needScroll ? { minWidth: data.length * 28 + 24 } : {}}>
          <div
            className="flex items-end gap-1 sm:gap-1.5"
            style={{ height: BAR_AREA_H + 24 }}
          >
            {data.map((item, i) => {
              const barH = maxVal > 0 ? (item.value / maxVal) * BAR_AREA_H : 0
              const isActive = activeIdx === i
              return (
                <div
                  key={item.key}
                  className="flex-1 min-w-0 flex flex-col items-center justify-end relative"
                  style={needScroll ? { minWidth: 20 } : {}}
                  onMouseEnter={() => setActiveIdx(i)}
                  onMouseLeave={() => setActiveIdx(null)}
                  onTouchStart={() => setActiveIdx((prev) => (prev === i ? null : i))}
                >
                  {/* tooltip */}
                  {isActive && item.value > 0 && (
                    <div className="absolute -top-9 left-1/2 -translate-x-1/2 z-10 whitespace-nowrap">
                      <div className="bg-clay-pink-100 text-[#8a4860] text-[11px] font-extrabold px-3 py-1.5 rounded-clay-sm shadow-clay">
                        {item.fullLabel} · {item.value} 次
                      </div>
                      <div className="w-2 h-2 bg-clay-pink-100 rotate-45 mx-auto -mt-1" />
                    </div>
                  )}

                  {/* bar */}
                  <div
                    className={`w-full rounded-t-[10px] rounded-b-[4px] transition-all duration-300 ${
                      isActive
                        ? 'bg-gradient-to-t from-clay-pink-300 to-clay-pink-100'
                        : item.value > 0
                          ? 'bg-gradient-to-t from-clay-blue-200 to-clay-blue-50'
                          : 'bg-clay-faint/10'
                    }`}
                    style={{
                      height: Math.max(barH, item.value > 0 ? 6 : 3),
                    }}
                  />

                  {/* label */}
                  <span
                    className={`text-[9px] sm:text-[10px] font-bold text-clay-faint mt-1.5 text-center leading-none whitespace-nowrap ${
                      shouldShowLabel(i) ? '' : 'invisible'
                    }`}
                  >
                    {item.shortLabel}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {needScroll && (
        <div className="sm:hidden flex justify-center mt-2">
          <span className="text-[10px] text-clay-faint/60 font-bold">← 左右滑动查看 →</span>
        </div>
      )}
    </div>
  )
}

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
      try {
        const r = await self()
        if (r?.data) setUser(r.data)
      } catch (_) {}

      const now = Math.floor(Date.now() / 1000)
      let start
      if (range === 1) {
        const today = new Date()
        today.setHours(0, 0, 0, 0)
        start = Math.floor(today.getTime() / 1000)
      } else {
        const d = new Date()
        d.setHours(0, 0, 0, 0)
        d.setDate(d.getDate() - (range - 1))
        start = Math.floor(d.getTime() / 1000)
      }
      const res = await selfUsage(start, now, 'hour')
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

  const chartData = useMemo(() => {
    if (range === 1) {
      const now = new Date()
      const currentHour = now.getHours()
      const todayStr = fmtDate(now)
      const hourMap = new Map()
      for (let h = 0; h <= currentHour; h++) hourMap.set(h, 0)
      for (const it of series) {
        const d = new Date((it.created_at || 0) * 1000)
        if (fmtDate(d) === todayStr) {
          const h = d.getHours()
          if (hourMap.has(h)) hourMap.set(h, hourMap.get(h) + (it.count || 0))
        }
      }
      return [...hourMap.entries()]
        .sort(([a], [b]) => a - b)
        .map(([hour, count]) => ({
          key: `h-${hour}`,
          shortLabel: `${hour}时`,
          fullLabel: `${hour}:00`,
          value: count,
        }))
    }
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const dayMap = new Map()
    for (let i = range - 1; i >= 0; i--) {
      const d = new Date(today)
      d.setDate(d.getDate() - i)
      dayMap.set(fmtDate(d), 0)
    }
    for (const it of series) {
      const d = new Date((it.created_at || 0) * 1000)
      const key = fmtDate(d)
      if (dayMap.has(key)) dayMap.set(key, dayMap.get(key) + (it.count || 0))
    }
    return [...dayMap.entries()]
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([date, count]) => ({
        key: date,
        shortLabel: date.slice(5),
        fullLabel: date,
        value: count,
      }))
  }, [series, range])

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

      {/* Usage chart */}
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

      <div className="mb-8">
        {chartData.length === 0 ? (
          <ClayCard>
            <div className="flex flex-col items-center gap-2 py-10 text-clay-faint">
              <Clock className="w-8 h-8" />
              <p>这段时间还没有调用记录</p>
            </div>
          </ClayCard>
        ) : (
          <UsageChart data={chartData} range={range} />
        )}
      </div>

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
          <a href="/tokens">
            <ClayButton variant="ghost" className="!bg-white/50 !text-[#8a4860]">
              去管理
            </ClayButton>
          </a>
        </ClayCard>
      </div>
    </ClayConsoleShell>
  )
}
