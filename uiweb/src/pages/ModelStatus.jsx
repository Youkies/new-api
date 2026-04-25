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
} from 'lucide-react'
import ClayCard from '../components/clay/ClayCard.jsx'
import ClayInput from '../components/clay/ClayInput.jsx'
import ClayAlert from '../components/clay/ClayAlert.jsx'
import ClayPageShell from '../components/layout/ClayPageShell.jsx'
import { getModelStatus } from '../services/modelStatus.js'

const WINDOWS = ['1h', '6h', '12h', '24h']

const STATUS_ORDER = { red: 0, yellow: 1, green: 2 }

const SLOT_BG = {
  green: 'bg-clay-green-200',
  yellow: 'bg-clay-yellow-200',
  red: 'bg-clay-pink-200',
  empty: 'bg-black/[0.06]',
}

function slotBg(s) {
  if (s.total === 0) return SLOT_BG.empty
  return SLOT_BG[s.status] ?? SLOT_BG.empty
}

function statusDotCls(status) {
  if (status === 'green') return 'bg-clay-green-200 shadow-[0_0_10px_rgba(149,213,178,0.7)]'
  if (status === 'yellow') return 'bg-clay-yellow-200 shadow-[0_0_10px_rgba(255,217,142,0.7)]'
  if (status === 'red') return 'bg-clay-pink-200 shadow-[0_0_10px_rgba(255,153,172,0.7)]'
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

        {/* Time window pills + refresh */}
        <div className="flex flex-wrap items-center justify-center gap-2 mb-6">
          {WINDOWS.map((w) => {
            const active = window === w
            return (
              <button
                key={w}
                onClick={() => setWindow(w)}
                className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-clay-pill text-sm font-extrabold transition-all duration-200 ease-clay ${
                  active
                    ? 'bg-clay-pink-100 text-[#8a4860] shadow-clay'
                    : 'bg-clay-bg text-clay-faint shadow-clay-inset hover:text-clay-ink'
                }`}
              >
                {w}
              </button>
            )
          })}

          <button
            onClick={handleRefresh}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-clay-pill text-sm font-extrabold bg-clay-bg text-clay-faint shadow-clay-inset hover:text-clay-ink transition-all duration-200 ease-clay"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span className="tabular-nums">下次刷新: {countdown}s</span>
          </button>
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

        {/* Summary stats */}
        {!loading && models.length > 0 && (
          <div className="flex flex-wrap items-center justify-center gap-3 mb-8">
            <span className="inline-flex items-center gap-1.5 px-4 py-2 rounded-clay-pill text-xs font-extrabold bg-clay-bg text-clay-ink shadow-clay">
              <Activity className="w-3.5 h-3.5" strokeWidth={2.5} />
              总计 {summary.total}
            </span>
            <span className="inline-flex items-center gap-1.5 px-4 py-2 rounded-clay-pill text-xs font-extrabold bg-clay-green-50 text-[#3d6b4f] shadow-clay">
              <CheckCircle2 className="w-3.5 h-3.5" strokeWidth={2.5} />
              正常 {summary.green}
            </span>
            {summary.yellow > 0 && (
              <span className="inline-flex items-center gap-1.5 px-4 py-2 rounded-clay-pill text-xs font-extrabold bg-clay-yellow-50 text-[#8a6a32] shadow-clay">
                <AlertTriangle className="w-3.5 h-3.5" strokeWidth={2.5} />
                降级 {summary.yellow}
              </span>
            )}
            {summary.red > 0 && (
              <span className="inline-flex items-center gap-1.5 px-4 py-2 rounded-clay-pill text-xs font-extrabold bg-clay-pink-50 text-[#8a4860] shadow-clay">
                <XCircle className="w-3.5 h-3.5" strokeWidth={2.5} />
                异常 {summary.red}
              </span>
            )}
          </div>
        )}

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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {filtered.map((m) => (
              <ModelCard key={m.model_name} model={m} window={window} />
            ))}
          </div>
        )}

        {/* Footer */}
        {!loading && filtered.length > 0 && (
          <div className="mt-8 text-center text-sm text-clay-faint flex items-center justify-center gap-2">
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

function ModelCard({ model, window: win }) {
  const { model_name, status, success_rate, total_requests, slots = [] } = model
  const [hoveredSlot, setHoveredSlot] = useState(null)

  const maxTotal = useMemo(() => {
    let m = 0
    for (const s of slots) if (s.total > m) m = s.total
    return m
  }, [slots])

  return (
    <ClayCard className="!p-6 flex flex-col gap-4">
      {/* Header: dot + name + badge */}
      <div className="flex items-center gap-2.5 min-w-0">
        <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${statusDotCls(status)}`} />
        <span className="font-mono font-bold text-sm truncate flex-1" title={model_name}>
          {model_name}
        </span>
        <span
          className={`text-[11px] font-extrabold px-2.5 py-0.5 rounded-clay-pill shrink-0 ${rateBadgeCls(status)}`}
        >
          {total_requests > 0 ? formatRate(success_rate) : '—'}
        </span>
      </div>

      {/* Uptime bar — concave clay track */}
      {slots.length > 0 && (
        <div className="relative">
          <div className="flex items-end gap-[1px] h-8 rounded-xl bg-clay-bg shadow-clay-inset p-[3px] overflow-hidden">
            {slots.map((s, i) => {
              const barH =
                s.total === 0
                  ? 30
                  : maxTotal > 0
                    ? Math.max(30, Math.round((s.total / maxTotal) * 100))
                    : 30
              return (
                <div
                  key={i}
                  className={`flex-1 rounded-sm transition-opacity cursor-pointer ${slotBg(s)} hover:opacity-75`}
                  style={{ height: `${barH}%` }}
                  onMouseEnter={() => setHoveredSlot(i)}
                  onMouseLeave={() => setHoveredSlot(null)}
                />
              )
            })}
          </div>
          {/* Tooltip */}
          {hoveredSlot !== null && slots[hoveredSlot] && (
            <SlotTooltip slot={slots[hoveredSlot]} win={win} />
          )}
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between text-[11px]">
        <span className="font-bold text-clay-faint">
          {(total_requests ?? 0).toLocaleString()} 请求
        </span>
        <span className={`font-bold ${statusTextColor(status)}`}>{statusLabel(status)}</span>
      </div>
    </ClayCard>
  )
}

function SlotTooltip({ slot, win }) {
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

  return (
    <div className="absolute -top-14 left-1/2 -translate-x-1/2 z-10 pointer-events-none">
      <div className="bg-clay-bg text-clay-ink text-[10px] font-bold px-3 py-2 rounded-clay-sm shadow-clay whitespace-nowrap border border-white/20">
        {fmt} · {slot.total} 请求{slot.total > 0 ? ` · ${formatRate(slot.success_rate)}` : ''}
      </div>
    </div>
  )
}
