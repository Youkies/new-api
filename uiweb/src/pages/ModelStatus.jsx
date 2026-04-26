import { useEffect, useMemo, useState, useCallback, useRef } from 'react'
import {
  Activity,
  Search,
  RefreshCw,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
  Info,
  TrendingUp,
  Zap,
} from 'lucide-react'
import ClayCard from '../components/clay/ClayCard.jsx'
import ClayInput from '../components/clay/ClayInput.jsx'
import ClayAlert from '../components/clay/ClayAlert.jsx'
import ClayPageShell from '../components/layout/ClayPageShell.jsx'
import { getModelStatus } from '../services/modelStatus.js'

const WINDOWS = ['1h', '6h', '12h', '24h']

const SLOT_BG = {
  green: 'bg-clay-green-200',
  yellow: 'bg-clay-yellow-200',
  red: 'bg-clay-pink-300',
  empty: 'bg-black/[0.06]',
}

function slotBg(s) {
  if (s.total === 0) return SLOT_BG.empty
  return SLOT_BG[s.status] ?? SLOT_BG.empty
}

function statusDotCls(status) {
  if (status === 'green') return 'bg-clay-green-200 shadow-[0_0_10px_rgba(149,213,178,0.7)]'
  if (status === 'yellow') return 'bg-clay-yellow-200 shadow-[0_0_10px_rgba(255,217,142,0.7)]'
  if (status === 'red') return 'bg-clay-pink-300 shadow-[0_0_10px_rgba(255,143,179,0.7)]'
  return 'bg-clay-bg'
}

function statusTextColor(status) {
  if (status === 'green') return 'text-[#3d6b4f]'
  if (status === 'yellow') return 'text-[#8a6a32]'
  if (status === 'red') return 'text-[#8a4860]'
  return 'text-clay-faint'
}

function rateBadgeCls(status) {
  if (status === 'green') return 'bg-clay-green-50 text-[#3d6b4f]'
  if (status === 'yellow') return 'bg-clay-yellow-50 text-[#8a6a32]'
  if (status === 'red') return 'bg-clay-pink-50 text-[#8a4860]'
  return 'bg-clay-bg text-clay-faint'
}

function formatRate(rate) {
  if (rate == null || rate === 0) return '0.0%'
  return `${rate.toFixed(1)}%`
}

function statusLabel(status) {
  if (status === 'green') return '运行正常'
  if (status === 'yellow') return '部分降级'
  if (status === 'red') return '服务异常'
  return '—'
}

function timeAgo(ts) {
  if (!ts) return ''
  const diff = Math.floor(Date.now() / 1000 - ts)
  if (diff < 60) return `${diff}s 前`
  if (diff < 3600) return `${Math.floor(diff / 60)}m 前`
  return `${Math.floor(diff / 3600)}h 前`
}

function overallStatus(summary) {
  if (summary.total === 0) return 'empty'
  const errorRate = (summary.red + summary.yellow * 0.5) / summary.total
  if (summary.red > 0 && errorRate >= 0.3) return 'red'
  if (summary.yellow > 0 || summary.red > 0) return 'yellow'
  return 'green'
}

function overallSLA(models) {
  let totalReq = 0
  let totalSucc = 0
  for (const m of models) {
    const t = m.total_requests ?? 0
    const r = m.success_rate ?? 0
    totalReq += t
    totalSucc += t * (r / 100)
  }
  if (totalReq === 0) return null
  return (totalSucc / totalReq) * 100
}

export default function ModelStatus() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [window, setWindow] = useState('1h')
  const [keyword, setKeyword] = useState('')
  const [countdown, setCountdown] = useState(60)
  const countdownRef = useRef(60)

  const fetchData = useCallback(
    async (showLoading = false) => {
      if (showLoading) setLoading(true)
      setError('')
      try {
        const res = await getModelStatus(window)
        const d = res?.data ?? res
        setData(d)
      } catch (err) {
        setError(err?.response?.data?.message ?? err.message ?? '状态加载失败')
      } finally {
        setLoading(false)
      }
    },
    [window],
  )

  useEffect(() => {
    fetchData(true)
  }, [fetchData])

  useEffect(() => {
    countdownRef.current = 60
    setCountdown(60)
    const id = setInterval(() => {
      countdownRef.current -= 1
      if (countdownRef.current <= 0) {
        countdownRef.current = 60
        fetchData(false)
      }
      setCountdown(countdownRef.current)
    }, 1000)
    return () => clearInterval(id)
  }, [fetchData])

  const handleRefresh = () => {
    countdownRef.current = 60
    setCountdown(60)
    fetchData(false)
  }

  const models = data?.models ?? []

  const summary = useMemo(() => {
    let green = 0
    let yellow = 0
    let red = 0
    for (const m of models) {
      if (m.status === 'green') green++
      else if (m.status === 'yellow') yellow++
      else red++
    }
    return { total: models.length, green, yellow, red }
  }, [models])

  const sla = useMemo(() => overallSLA(models), [models])
  const overall = overallStatus(summary)

  const sorted = useMemo(() => {
    const list = [...models]
    list.sort((a, b) => (b.total_requests ?? 0) - (a.total_requests ?? 0))
    return list
  }, [models])

  const filtered = useMemo(() => {
    if (!keyword) return sorted
    const k = keyword.toLowerCase()
    return sorted.filter((m) => (m.model_name ?? '').toLowerCase().includes(k))
  }, [sorted, keyword])

  return (
    <ClayPageShell>
      <section>
        {/* Header */}
        <div className="clay-icon-box !w-16 !h-16 mx-auto mb-6 text-clay-blue-200">
          <Activity className="w-7 h-7" strokeWidth={2.5} />
        </div>
        <h1 className="text-4xl md:text-5xl font-black text-center mb-3 tracking-tight">
          模型状态
        </h1>
        <p className="text-center text-clay-faint mb-8 max-w-2xl mx-auto">
          实时监控所有模型的可用性与成功率，每分钟自动刷新
        </p>

        {/* Overview banner */}
        {!loading && models.length > 0 && (
          <OverviewBanner
            overall={overall}
            sla={sla}
            summary={summary}
            updatedAt={data?.updated_at}
            countdown={countdown}
            onRefresh={handleRefresh}
          />
        )}

        {/* Time window pills */}
        <div className="flex flex-wrap items-center justify-center gap-2 mb-6">
          <span className="text-[11px] font-extrabold text-clay-faint uppercase tracking-wider mr-2">
            时间窗口
          </span>
          {WINDOWS.map((w) => {
            const active = window === w
            return (
              <button
                key={w}
                onClick={() => setWindow(w)}
                className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-clay-pill text-sm font-extrabold transition-all duration-200 ease-clay ${
                  active
                    ? 'bg-clay-blue-100 text-[#2c5582] shadow-clay'
                    : 'bg-clay-bg text-clay-faint shadow-clay-inset hover:text-clay-ink'
                }`}
              >
                {w}
              </button>
            )
          })}
        </div>

        {/* Search */}
        <div className="max-w-xl mx-auto mb-8 relative">
          <ClayInput
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            placeholder="搜索模型名称…"
            className="!pl-12"
          />
          <Search className="w-5 h-5 absolute left-5 top-1/2 -translate-y-1/2 text-clay-faint pointer-events-none" />
        </div>

        {error && (
          <ClayAlert tone="error" className="max-w-2xl mx-auto mb-8">
            {error}
          </ClayAlert>
        )}

        {loading ? (
          <div className="flex flex-col items-center gap-3 py-16 text-clay-faint">
            <Loader2 className="w-8 h-8 animate-spin" />
            <p className="font-semibold">加载状态中…</p>
          </div>
        ) : filtered.length === 0 ? (
          <ClayCard className="max-w-xl mx-auto text-center !py-16">
            <Activity className="w-8 h-8 mx-auto mb-3 text-clay-faint" />
            <p className="text-clay-faint font-semibold">没有匹配的模型</p>
          </ClayCard>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {filtered.map((m) => (
              <ModelCard key={m.model_name} model={m} window={window} />
            ))}
          </div>
        )}

        {/* Status legend */}
        {!loading && filtered.length > 0 && <StatusLegend />}

        {/* Footer */}
        {!loading && filtered.length > 0 && (
          <div className="mt-6 text-center text-sm text-clay-faint flex items-center justify-center gap-2">
            <Clock className="w-3.5 h-3.5" />
            <span className="font-semibold">
              共 {filtered.length} 个模型 · 数据窗口 {data?.window ?? window} · 更新于{' '}
              {timeAgo(data?.updated_at)}
            </span>
          </div>
        )}
      </section>
    </ClayPageShell>
  )
}

const OVERALL_META = {
  green: {
    bg: 'from-clay-green-50 to-clay-green-100',
    ring: 'bg-clay-green-200',
    icon: CheckCircle2,
    iconColor: 'text-[#3d6b4f]',
    title: '所有系统运行正常',
    sub: '全部模型可用',
  },
  yellow: {
    bg: 'from-clay-yellow-50 to-clay-yellow-100',
    ring: 'bg-clay-yellow-200',
    icon: AlertTriangle,
    iconColor: 'text-[#8a6a32]',
    title: '部分模型降级',
    sub: '主要功能可用',
  },
  red: {
    bg: 'from-clay-pink-50 to-clay-pink-100',
    ring: 'bg-clay-pink-300',
    icon: XCircle,
    iconColor: 'text-[#8a4860]',
    title: '服务存在异常',
    sub: '部分模型不可用',
  },
  empty: {
    bg: 'from-clay-bg to-clay-bg',
    ring: 'bg-clay-bg',
    icon: Activity,
    iconColor: 'text-clay-faint',
    title: '暂无数据',
    sub: '',
  },
}

function OverviewBanner({ overall, sla, summary, updatedAt, countdown, onRefresh }) {
  const meta = OVERALL_META[overall] ?? OVERALL_META.empty
  const Icon = meta.icon
  return (
    <ClayCard className={`!p-5 md:!p-6 mb-6 bg-gradient-to-br ${meta.bg}`}>
      <div className="flex flex-col md:flex-row md:items-center gap-5">
        {/* Status indicator */}
        <div className="flex items-center gap-4 min-w-0 md:w-[280px]">
          <div className="relative shrink-0">
            <div className={`w-14 h-14 rounded-full ${meta.ring} shadow-clay flex items-center justify-center`}>
              <Icon className={`w-6 h-6 ${meta.iconColor}`} strokeWidth={2.5} />
            </div>
            {overall !== 'empty' && (
              <span className={`absolute inset-0 rounded-full ${meta.ring} animate-ping opacity-30`} />
            )}
          </div>
          <div className="min-w-0">
            <div className={`text-lg md:text-xl font-black tracking-tight ${meta.iconColor}`}>
              {meta.title}
            </div>
            <div className="text-xs font-bold text-clay-faint mt-0.5">
              {timeAgo(updatedAt)} · 自动刷新 {countdown}s
            </div>
          </div>
        </div>

        {/* SLA + counters */}
        <div className="flex-1 grid grid-cols-2 sm:grid-cols-4 gap-3">
          <SLACell
            icon={TrendingUp}
            label="整体成功率"
            value={sla != null ? formatRate(sla) : '—'}
            tone={overall}
          />
          <CounterCell label="正常" value={summary.green} tone="green" />
          <CounterCell label="降级" value={summary.yellow} tone="yellow" />
          <CounterCell label="异常" value={summary.red} tone="red" />
        </div>

        {/* Refresh */}
        <button
          onClick={onRefresh}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-clay-pill bg-white/70 shadow-clay hover:shadow-clay-hover active:shadow-clay-active text-sm font-extrabold text-clay-ink transition-all shrink-0"
        >
          <RefreshCw className="w-4 h-4" strokeWidth={2.5} />
          立即刷新
        </button>
      </div>
    </ClayCard>
  )
}

function SLACell({ icon: Icon, label, value, tone }) {
  const color = {
    green: 'text-[#3d6b4f]',
    yellow: 'text-[#8a6a32]',
    red: 'text-[#8a4860]',
    empty: 'text-clay-faint',
  }[tone] ?? 'text-clay-ink'
  return (
    <div className="bg-white/60 rounded-clay shadow-clay-sm px-3 py-2.5">
      <div className="flex items-center gap-1 text-[10px] font-extrabold uppercase tracking-wider text-clay-faint mb-0.5">
        <Icon className="w-3 h-3" strokeWidth={2.5} />
        {label}
      </div>
      <div className={`font-black text-xl tabular-nums leading-none ${color}`}>
        {value}
      </div>
    </div>
  )
}

const COUNTER_TONE = {
  green: { bg: 'bg-clay-green-50/80', text: 'text-[#3d6b4f]', dot: 'bg-clay-green-200' },
  yellow: { bg: 'bg-clay-yellow-50/80', text: 'text-[#8a6a32]', dot: 'bg-clay-yellow-200' },
  red: { bg: 'bg-clay-pink-50/80', text: 'text-[#8a4860]', dot: 'bg-clay-pink-300' },
}

function CounterCell({ label, value, tone }) {
  const t = COUNTER_TONE[tone]
  return (
    <div className={`${t.bg} rounded-clay shadow-clay-sm px-3 py-2.5`}>
      <div className="flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-wider text-clay-faint mb-0.5">
        <span className={`w-1.5 h-1.5 rounded-full ${t.dot}`} />
        {label}
      </div>
      <div className={`font-black text-xl tabular-nums leading-none ${t.text}`}>
        {value}
      </div>
    </div>
  )
}

function StatusLegend() {
  return (
    <div className="mt-8 max-w-3xl mx-auto">
      <ClayCard className="!p-4 bg-clay-bg/40">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-full bg-white/60 shadow-clay-sm flex items-center justify-center shrink-0">
            <Info className="w-4 h-4 text-clay-faint" strokeWidth={2.5} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-extrabold text-clay-ink mb-2">状态说明</div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-[11px]">
              <LegendItem tone="green" title="运行正常" desc="成功率 ≥ 95%" />
              <LegendItem tone="yellow" title="部分降级" desc="成功率 60% – 95%" />
              <LegendItem tone="red" title="服务异常" desc="成功率 < 60%" />
            </div>
            <div className="text-[10px] text-clay-faint font-bold mt-2 leading-relaxed">
              柱状图高度反映该时段相对请求量；空心格表示该时段无请求。鼠标悬停柱条可查看详情。
            </div>
          </div>
        </div>
      </ClayCard>
    </div>
  )
}

function LegendItem({ tone, title, desc }) {
  const t = COUNTER_TONE[tone]
  return (
    <div className="flex items-center gap-2">
      <span className={`w-2.5 h-2.5 rounded-sm ${t.dot} shrink-0`} />
      <span className={`font-extrabold ${t.text}`}>{title}</span>
      <span className="text-clay-faint">{desc}</span>
    </div>
  )
}

function ModelCard({ model, window: win }) {
  const { model_name, status, success_rate, total_requests, slots = [] } = model
  const [hoveredSlot, setHoveredSlot] = useState(null)

  const maxTotal = useMemo(() => {
    let m = 0
    for (const s of slots) if (s.total > m) m = s.total
    return m
  }, [slots])

  // Avg latency proxy: most-recent non-empty slot share
  const lastSlot = useMemo(() => {
    for (let i = slots.length - 1; i >= 0; i--) {
      if (slots[i].total > 0) return slots[i]
    }
    return null
  }, [slots])

  return (
    <ClayCard className="!p-5 flex flex-col gap-3.5 hover:-translate-y-0.5 hover:shadow-clay-hover transition-all !overflow-visible">
      {/* Header: dot + name + badge */}
      <div className="flex items-center gap-2.5 min-w-0">
        <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${statusDotCls(status)}`} />
        <span className="font-mono font-extrabold text-sm truncate flex-1 text-clay-ink" title={model_name}>
          {model_name}
        </span>
        <span
          className={`text-[11px] font-black px-2.5 py-0.5 rounded-clay-pill shrink-0 tabular-nums ${rateBadgeCls(status)}`}
        >
          {total_requests > 0 ? formatRate(success_rate) : '—'}
        </span>
      </div>

      {/* Uptime bar */}
      {slots.length > 0 && (
        <div className="relative">
          <div className="flex items-end gap-[1.5px] h-9 rounded-clay-sm bg-clay-bg shadow-clay-inset p-[3px]">
            {slots.map((s, i) => {
              const barH =
                s.total === 0
                  ? 35
                  : maxTotal > 0
                    ? Math.max(35, Math.round((s.total / maxTotal) * 100))
                    : 35
              const isHover = hoveredSlot === i
              return (
                <div
                  key={i}
                  className={`flex-1 rounded-[3px] transition-all cursor-pointer ${slotBg(s)} ${
                    isHover ? 'opacity-100 scale-y-105' : 'opacity-90 hover:opacity-100'
                  }`}
                  style={{ height: `${barH}%`, minHeight: '4px' }}
                  onMouseEnter={() => setHoveredSlot(i)}
                  onMouseLeave={() => setHoveredSlot(null)}
                />
              )
            })}
          </div>
          {/* Time axis labels */}
          <div className="flex justify-between text-[9px] font-bold text-clay-faint/70 mt-1 px-1">
            <span>{win} 前</span>
            <span>现在</span>
          </div>
          {hoveredSlot !== null && slots[hoveredSlot] && (
            <SlotTooltip
              slot={slots[hoveredSlot]}
              win={win}
              leftPct={((hoveredSlot + 0.5) / slots.length) * 100}
            />
          )}
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between gap-2 pt-1 border-t border-black/5">
        <div className="flex items-center gap-1.5 text-[11px]">
          <Zap className="w-3 h-3 text-clay-faint" strokeWidth={2.5} />
          <span className="font-bold text-clay-faint tabular-nums">
            {(total_requests ?? 0).toLocaleString()}
          </span>
          <span className="text-clay-faint/70">请求</span>
          {lastSlot && lastSlot.total > 0 && (
            <>
              <span className="text-clay-faint/40 mx-1">·</span>
              <span className="font-bold text-clay-faint tabular-nums">
                最新 {lastSlot.total}
              </span>
            </>
          )}
        </div>
        <span className={`text-[11px] font-extrabold flex items-center gap-1 ${statusTextColor(status)}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${statusDotCls(status).split(' ')[0]}`} />
          {statusLabel(status)}
        </span>
      </div>
    </ClayCard>
  )
}

function SlotTooltip({ slot, win, leftPct = 50 }) {
  const t = new Date(slot.start_time * 1000)
  const fmt =
    win === '1h'
      ? t.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
      : t.toLocaleString('zh-CN', {
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit',
        })

  // Clamp so tooltip doesn't overflow at edges
  const clamped = Math.min(92, Math.max(8, leftPct))

  return (
    <div
      className="absolute -top-16 z-10 pointer-events-none -translate-x-1/2"
      style={{ left: `${clamped}%` }}
    >
      <div className="bg-white text-clay-ink text-[11px] font-bold px-3 py-2 rounded-clay-sm shadow-clay-hover whitespace-nowrap">
        <div className="font-extrabold text-clay-ink">{fmt}</div>
        <div className="text-clay-faint mt-0.5 tabular-nums">
          {slot.total} 请求
          {slot.total > 0 && (
            <>
              {' · '}
              <span className={statusTextColor(slot.status)}>{formatRate(slot.success_rate)}</span>
            </>
          )}
        </div>
      </div>
      <div className="absolute left-1/2 -translate-x-1/2 -bottom-1 w-2 h-2 bg-white rotate-45 shadow-clay-sm" />
    </div>
  )
}
