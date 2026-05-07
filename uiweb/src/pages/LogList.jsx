import { useEffect, useState, useCallback, useMemo, useRef, useSyncExternalStore } from 'react'
import {
  Search, ChevronLeft, ChevronRight, Filter,
  Clock, CalendarDays,
  Activity, AlertCircle, RefreshCw, CreditCard, Settings, Terminal,
  RotateCcw, FileText, TrendingUp, ShieldCheck, History, CheckCircle2, XCircle,
} from 'lucide-react'
import ClayCard from '../components/clay/ClayCard.jsx'
import ClayButton from '../components/clay/ClayButton.jsx'
import ClayField from '../components/clay/ClayField.jsx'
import ClaySelect from '../components/clay/ClaySelect.jsx'
import ClayModal from '../components/clay/ClayModal.jsx'
import ClayConsoleShell from '../components/layout/ClayConsoleShell.jsx'
import { useToast } from '../context/ToastContext.jsx'
import { quotaToDisplay } from '../utils/quota.js'
import { getUserLogs, getUserLogsStat } from '../services/logs.js'
import { createRefundAppeal, getRefundCandidates, listMyRefundAppeals } from '../services/refundAppeals.js'

const mobileQuery = typeof window !== 'undefined' ? window.matchMedia('(max-width: 767px)') : null
function useIsMobile() {
  return useSyncExternalStore(
    (cb) => { mobileQuery?.addEventListener('change', cb); return () => mobileQuery?.removeEventListener('change', cb) },
    () => mobileQuery?.matches ?? false,
  )
}

const TYPE_OPTIONS = [
  { value: '', label: '全部类型' },
  { value: '1', label: '充值' },
  { value: '2', label: '消费' },
  { value: '3', label: '管理' },
  { value: '4', label: '系统' },
  { value: '5', label: '错误' },
  { value: '6', label: '退款' },
]

const TYPE_META = {
  1: { label: '充值', icon: CreditCard, bg: 'bg-emerald-100', text: 'text-emerald-700', ring: 'ring-emerald-200' },
  2: { label: '消费', icon: Activity, bg: 'bg-clay-blue-100', text: 'text-[#43658b]', ring: 'ring-blue-200' },
  3: { label: '管理', icon: Settings, bg: 'bg-clay-purple-100', text: 'text-[#6b4d83]', ring: 'ring-purple-200' },
  4: { label: '系统', icon: Terminal, bg: 'bg-gray-200', text: 'text-gray-600', ring: 'ring-gray-300' },
  5: { label: '错误', icon: AlertCircle, bg: 'bg-red-100', text: 'text-red-600', ring: 'ring-red-200' },
  6: { label: '退款', icon: RotateCcw, bg: 'bg-clay-yellow-100', text: 'text-[#8a6a32]', ring: 'ring-amber-200' },
}

const REFUND_STATUS_META = {
  pending: { label: '待审核', icon: Clock, cls: 'bg-clay-yellow-100 text-[#8a6a32]' },
  approved: { label: '已补偿', icon: CheckCircle2, cls: 'bg-clay-green-100 text-[#3d6b4f]' },
  rejected: { label: '已驳回', icon: XCircle, cls: 'bg-clay-pink-100 text-[#8a4860]' },
}

function fmtTs(ts) {
  if (!ts) return '-'
  return new Date(ts * 1000).toLocaleString('zh-CN', {
    month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
  })
}

function fmtTokens(n) {
  if (!n) return '-'
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return String(n)
}

function getPageItems(res) {
  const items = res?.data?.items ?? res?.data ?? []
  return Array.isArray(items) ? items : []
}

function getPageTotal(res) {
  return res?.data?.total ?? 0
}

function fmtUseTime(sec) {
  if (!sec && sec !== 0) return '-'
  return `${sec}s`
}

function fmtFrt(ms) {
  if (!ms || ms <= 0) return null
  if (ms >= 1000) return `${(ms / 1000).toFixed(1)}s`
  return `${Math.round(ms)}ms`
}

function parseOther(raw) {
  if (!raw) return {}
  if (typeof raw === 'object') return raw || {}
  try { return JSON.parse(raw) || {} } catch { return {} }
}

function getCacheTokens(other) {
  if (!other) return { read: 0, write: 0 }
  const read = other.cache_tokens || 0
  let write = 0
  if (other.cache_creation_tokens_5m || other.cache_creation_tokens_1h) {
    write = (other.cache_creation_tokens_5m || 0) + (other.cache_creation_tokens_1h || 0)
  } else {
    write = other.cache_creation_tokens || 0
  }
  return { read, write }
}

function DetailRow({ label, value, mono }) {
  if (value === null || value === undefined || value === '') return null
  return (
    <div className="flex items-start py-2 border-b border-black/5 last:border-0">
      <span className="text-xs text-clay-faint w-28 shrink-0 pt-0.5">{label}</span>
      <span className={`text-sm flex-1 break-all ${mono ? 'font-mono text-xs' : ''}`}>{value}</span>
    </div>
  )
}

function LogDetailContent({ log }) {
  const other = parseOther(log.other)
  const cache = getCacheTokens(other)
  const frt = other.frt > 0 ? other.frt : null
  const meta = TYPE_META[log.type] ?? TYPE_META[4]

  return (
    <div className="space-y-5">
      <div>
        <DetailRow label="时间" value={log.created_at ? new Date(log.created_at * 1000).toLocaleString('zh-CN') : '-'} />
        <DetailRow label="类型" value={
          <span className={`text-[11px] font-extrabold px-3 py-1 rounded-clay-pill ${meta.bg} ${meta.text}`}>
            {meta.label}
          </span>
        } />
        <DetailRow label="模型" value={log.model_name} mono />
        <DetailRow label="令牌" value={log.token_name} />
        <DetailRow label="分组" value={log.group} />
        <DetailRow label="Request ID" value={log.request_id} mono />
      </div>

      {(log.prompt_tokens > 0 || log.completion_tokens > 0) && (
        <div className="bg-clay-bg rounded-clay p-5 shadow-clay-inset">
          <h4 className="text-xs font-extrabold text-clay-faint mb-4">Token 用量</h4>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <span className="text-[11px] text-clay-faint">输入</span>
              <p className="text-xl font-black font-mono">{(log.prompt_tokens ?? 0).toLocaleString()}</p>
            </div>
            <div>
              <span className="text-[11px] text-clay-faint">输出</span>
              <p className="text-xl font-black font-mono">{(log.completion_tokens ?? 0).toLocaleString()}</p>
            </div>
            {cache.read > 0 && (
              <div>
                <span className="text-[11px] text-clay-faint">缓存读取</span>
                <p className="text-xl font-black font-mono text-emerald-600">{cache.read.toLocaleString()}</p>
              </div>
            )}
            {cache.write > 0 && (
              <div>
                <span className="text-[11px] text-clay-faint">缓存写入</span>
                <p className="text-xl font-black font-mono text-amber-600">{cache.write.toLocaleString()}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {(log.use_time || frt) ? (
        <div className="bg-clay-bg rounded-clay p-5 shadow-clay-inset">
          <h4 className="text-xs font-extrabold text-clay-faint mb-4">耗时信息</h4>
          <div className="grid grid-cols-3 gap-4">
            {log.use_time ? (
              <div>
                <span className="text-[11px] text-clay-faint">总用时</span>
                <p className="text-xl font-black font-mono">{fmtUseTime(log.use_time)}</p>
              </div>
            ) : null}
            {frt ? (
              <div>
                <span className="text-[11px] text-clay-faint">首字延迟</span>
                <p className="text-xl font-black font-mono text-emerald-600">{fmtFrt(frt)}</p>
              </div>
            ) : null}
            <div>
              <span className="text-[11px] text-clay-faint">模式</span>
              <p className="text-sm font-extrabold mt-1">{log.is_stream ? '流式' : '非流式'}</p>
            </div>
          </div>
        </div>
      ) : null}

      {log.quota ? (
        <DetailRow
          label="额度消耗"
          value={
            <span className={`font-extrabold ${log.quota > 0 ? 'text-blue-600' : 'text-emerald-600'}`}>
              {log.quota < 0 ? '+' : '-'}{quotaToDisplay(Math.abs(log.quota)).text}
            </span>
          }
        />
      ) : null}

      {log.content && (
        <div>
          <h4 className="text-xs font-extrabold text-clay-faint mb-2">详情</h4>
          <div className="bg-clay-bg rounded-clay p-4 shadow-clay-inset text-xs text-clay-faint whitespace-pre-wrap break-all">
            {log.content}
          </div>
        </div>
      )}
    </div>
  )
}

function RefundStatusBadge({ status }) {
  const meta = REFUND_STATUS_META[status] ?? REFUND_STATUS_META.pending
  const Icon = meta.icon
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-clay-pill text-[11px] font-black ${meta.cls}`}>
      <Icon className="w-3.5 h-3.5" />
      {meta.label}
    </span>
  )
}

function RefundAppealRecordsContent({ appeals, total, loading }) {
  if (loading) {
    return (
      <div className="rounded-clay bg-clay-bg shadow-clay-inset p-8 text-center text-sm font-bold text-clay-faint">
        加载中…
      </div>
    )
  }

  if (!appeals.length) {
    return (
      <div className="rounded-clay bg-clay-bg shadow-clay-inset p-8 text-center text-sm font-bold text-clay-faint">
        暂无申诉记录
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {appeals.map((appeal) => (
        <div key={appeal.id} className="rounded-clay bg-clay-bg shadow-clay-inset p-4 md:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-sm font-black text-clay-ink">申诉单 #{appeal.id}</div>
              <div className="text-xs font-bold text-clay-faint mt-1">提交于 {fmtTs(appeal.created_at)}</div>
            </div>
            <RefundStatusBadge status={appeal.status} />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
            <div>
              <div className="text-[11px] font-bold text-clay-faint">记录数</div>
              <div className="text-sm font-black text-clay-ink mt-1">{appeal.total_items || 0} 条</div>
            </div>
            <div>
              <div className="text-[11px] font-bold text-clay-faint">补偿额度</div>
              <div className="text-sm font-black text-[#8a4860] mt-1">{quotaToDisplay(appeal.refund_quota || 0).text}</div>
            </div>
            <div>
              <div className="text-[11px] font-bold text-clay-faint">审核时间</div>
              <div className="text-sm font-black text-clay-ink mt-1">{fmtTs(appeal.reviewed_at)}</div>
            </div>
            <div>
              <div className="text-[11px] font-bold text-clay-faint">窗口</div>
              <div className="text-xs font-bold text-clay-faint mt-1">{fmtTs(appeal.window_start)} - {fmtTs(appeal.window_end)}</div>
            </div>
          </div>

          {(appeal.reason || appeal.review_note) && (
            <div className="mt-4 space-y-2">
              {appeal.reason && (
                <div className="text-xs font-semibold text-clay-faint leading-relaxed break-words">
                  <span className="font-black text-clay-ink">补充说明：</span>{appeal.reason}
                </div>
              )}
              {appeal.review_note && (
                <div className="text-xs font-semibold text-clay-faint leading-relaxed break-words">
                  <span className="font-black text-clay-ink">审核说明：</span>{appeal.review_note}
                </div>
              )}
            </div>
          )}
        </div>
      ))}

      {total > appeals.length && (
        <div className="text-center text-xs font-bold text-clay-faint">
          仅显示最近 {appeals.length} 条，共 {total} 条
        </div>
      )}
    </div>
  )
}

function todayStart() {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T00:00`
}

function defaultLogFilter() {
  return {
    type: '',
    model_name: '',
    token_name: '',
    start_timestamp: todayStart(),
    end_timestamp: '',
  }
}

function hasNonDefaultLogFilter(filter) {
  const defaults = defaultLogFilter()
  return Boolean(
    filter.type ||
    filter.model_name ||
    filter.token_name ||
    filter.end_timestamp ||
    filter.start_timestamp !== defaults.start_timestamp
  )
}

function toLocalDateTimeValue(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return ''
  const pad = (n) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function parseLocalDateTime(value) {
  if (!value) return new Date()
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? new Date() : d
}

function formatDateTimeLabel(value) {
  if (!value) return '未设置'
  const d = parseLocalDateTime(value)
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function sameDate(a, b) {
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate()
}

const HOUR_OPTIONS = Array.from({ length: 24 }, (_, value) => String(value).padStart(2, '0'))
const MINUTE_OPTIONS = Array.from({ length: 60 }, (_, value) => String(value).padStart(2, '0'))

function ClayTimeColumn({ label, options, value, onSelect, tone = 'blue' }) {
  const scrollRef = useRef(null)
  const activeRef = useRef(null)
  const activeClass = tone === 'pink'
    ? 'bg-clay-pink-100 text-[#8a4860] shadow-clay'
    : 'bg-clay-blue-100 text-[#43658b] shadow-clay'

  useEffect(() => {
    const container = scrollRef.current
    const active = activeRef.current
    if (!container || !active) return
    container.scrollTop = active.offsetTop - (container.clientHeight / 2) + (active.clientHeight / 2)
  }, [value])

  return (
    <div className="min-w-0 flex-1">
      <div className="mb-2 px-1 text-[10px] font-black text-clay-faint">{label}</div>
      <div
        ref={scrollRef}
        className="h-36 overflow-y-auto overscroll-contain rounded-[22px] bg-clay-bg p-1.5 shadow-clay-inset"
      >
        {options.map((option) => {
          const active = option === value
          return (
            <button
              key={option}
              ref={active ? activeRef : null}
              type="button"
              onClick={() => onSelect(option)}
              className={`mb-1 flex h-9 w-full items-center justify-center rounded-[16px] px-3 text-center font-mono text-sm font-black transition-all last:mb-0 ${
                active
                  ? activeClass
                  : 'text-clay-faint hover:bg-white/40 hover:text-clay-ink'
              }`}
            >
              {option}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function formatQuotaDelta(quota) {
  if (!quota) return null
  return `${quota < 0 ? '+' : '-'}${quotaToDisplay(Math.abs(quota)).text}`
}

function quotaDeltaClass(quota) {
  return quota > 0 ? 'text-blue-600' : 'text-emerald-600'
}

function LogSummary({ log }) {
  const quotaText = formatQuotaDelta(log.quota)
  const chips = [
    log.model_name ? ['模型', log.model_name, true] : null,
    log.token_name ? ['令牌', log.token_name, false] : null,
    log.group ? ['分组', log.group, false] : null,
    log.request_id ? ['Request ID', log.request_id, true] : null,
  ].filter(Boolean)

  return (
    <div className="min-w-0">
      <div className="text-sm font-semibold text-clay-ink whitespace-pre-wrap break-all leading-relaxed">
        {log.content || '-'}
      </div>
      {(chips.length > 0 || quotaText) && (
        <div className="mt-2 flex flex-wrap gap-2">
          {chips.map(([label, value, mono]) => (
            <span
              key={`${label}-${value}`}
              className={`max-w-full rounded-clay-pill bg-clay-bg shadow-clay-inset px-2.5 py-1 text-[10px] font-bold text-clay-faint ${mono ? 'font-mono' : ''}`}
              title={value}
            >
              {label}: {value}
            </span>
          ))}
          {quotaText && (
            <span className={`rounded-clay-pill bg-clay-bg shadow-clay-inset px-2.5 py-1 text-[10px] font-black ${quotaDeltaClass(log.quota)}`}>
              额度: {quotaText}
            </span>
          )}
        </div>
      )}
    </div>
  )
}

function ClayDateTimeField({ label, value, onChange }) {
  const [open, setOpen] = useState(false)
  const isMobile = useIsMobile()
  const selectedDate = useMemo(() => parseLocalDateTime(value), [value])
  const [viewDate, setViewDate] = useState(selectedDate)
  const rootRef = useRef(null)

  useEffect(() => {
    if (open) setViewDate(selectedDate)
  }, [open, selectedDate])

  useEffect(() => {
    if (!open) return undefined
    const onPointerDown = (event) => {
      if (rootRef.current && !rootRef.current.contains(event.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [open])

  const monthDays = useMemo(() => {
    const year = viewDate.getFullYear()
    const month = viewDate.getMonth()
    const first = new Date(year, month, 1)
    const start = new Date(year, month, 1 - first.getDay())
    return Array.from({ length: 42 }, (_, index) => {
      const d = new Date(start)
      d.setDate(start.getDate() + index)
      return d
    })
  }, [viewDate])

  const setDate = (date) => {
    const next = parseLocalDateTime(value)
    next.setFullYear(date.getFullYear(), date.getMonth(), date.getDate())
    onChange(toLocalDateTimeValue(next))
  }

  const setTimePart = (part, rawValue) => {
    const numeric = Number(String(rawValue).replace(/\D/g, ''))
    const next = parseLocalDateTime(value)
    if (part === 'hour') next.setHours(Math.min(23, Math.max(0, Number.isFinite(numeric) ? numeric : 0)))
    if (part === 'minute') next.setMinutes(Math.min(59, Math.max(0, Number.isFinite(numeric) ? numeric : 0)))
    onChange(toLocalDateTimeValue(next))
  }

  const jumpMonth = (offset) => {
    setViewDate((current) => new Date(current.getFullYear(), current.getMonth() + offset, 1))
  }

  const setTodayStart = () => {
    const d = new Date()
    d.setHours(0, 0, 0, 0)
    onChange(toLocalDateTimeValue(d))
    setViewDate(d)
  }

  const setNow = () => {
    const d = new Date()
    onChange(toLocalDateTimeValue(d))
    setViewDate(d)
  }

  const pad = (n) => String(n).padStart(2, '0')
  const monthLabel = `${viewDate.getFullYear()}年${pad(viewDate.getMonth() + 1)}月`
  const selectedHour = pad(selectedDate.getHours())
  const selectedMinute = pad(selectedDate.getMinutes())
  const panelClassName = isMobile
    ? 'fixed inset-x-3 top-1/2 z-[100] max-h-[calc(100dvh-1.5rem)] -translate-y-1/2 overflow-y-auto rounded-clay-lg bg-clay-bg p-4 shadow-clay border-2 border-white/30'
    : 'absolute left-0 top-full z-[80] mt-3 w-full min-w-[320px] max-w-[calc(100vw-2rem)] rounded-clay-lg bg-clay-bg p-4 shadow-clay border-2 border-white/30'

  return (
    <div ref={rootRef} className="relative">
      <label className="block ml-4 mb-2 font-bold text-sm text-clay-ink">{label}</label>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full clay-input !py-3.5 flex items-center justify-between gap-3 text-left"
      >
        <span className={value ? 'font-semibold' : 'text-clay-faint'}>{formatDateTimeLabel(value)}</span>
        <CalendarDays className="w-4 h-4 text-clay-faint shrink-0" />
      </button>

      {open && (
        <div className={panelClassName}>
          <div className="flex items-center justify-between mb-3">
            <button type="button" onClick={() => jumpMonth(-1)} className="w-9 h-9 rounded-full bg-clay-bg shadow-clay flex items-center justify-center">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="text-sm font-black">{monthLabel}</div>
            <button type="button" onClick={() => jumpMonth(1)} className="w-9 h-9 rounded-full bg-clay-bg shadow-clay flex items-center justify-center">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-black text-clay-faint mb-1">
            {['日', '一', '二', '三', '四', '五', '六'].map((day) => <span key={day}>{day}</span>)}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {monthDays.map((day) => {
              const inMonth = day.getMonth() === viewDate.getMonth()
              const active = value && sameDate(day, selectedDate)
              const today = sameDate(day, new Date())
              return (
                <button
                  key={day.toISOString()}
                  type="button"
                  onClick={() => setDate(day)}
                  className={`aspect-square rounded-clay-sm text-xs font-black transition-all ${
                    active
                      ? 'bg-clay-blue-100 text-[#43658b] shadow-clay-inset'
                      : today
                        ? 'bg-clay-pink-50 text-clay-pink-400 shadow-clay'
                        : 'hover:bg-white/40'
                  } ${inMonth ? 'text-clay-ink' : 'text-clay-faint/50'}`}
                >
                  {day.getDate()}
                </button>
              )
            })}
          </div>

          <div className="mt-4 rounded-clay bg-clay-bg shadow-clay-inset p-3">
            <div className="text-[10px] font-black text-clay-faint mb-2">时间</div>
            <div className="flex items-start gap-3">
              <ClayTimeColumn
                label="小时"
                options={HOUR_OPTIONS}
                value={selectedHour}
                onSelect={(hour) => setTimePart('hour', hour)}
                tone="blue"
              />
              <div className="pt-11 font-black text-clay-faint">:</div>
              <ClayTimeColumn
                label="分钟"
                options={MINUTE_OPTIONS}
                value={selectedMinute}
                onSelect={(minute) => setTimePart('minute', minute)}
                tone="pink"
              />
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" onClick={setTodayStart} className="px-3 py-2 rounded-clay-pill bg-clay-pink-50 shadow-clay text-[11px] font-black text-[#8a4860]">
              今天 0 点
            </button>
            <button type="button" onClick={setNow} className="px-3 py-2 rounded-clay-pill bg-clay-blue-50 shadow-clay text-[11px] font-black text-[#43658b]">
              现在
            </button>
            <button type="button" onClick={() => { onChange(''); setOpen(false) }} className="px-3 py-2 rounded-clay-pill bg-clay-bg shadow-clay text-[11px] font-black text-clay-faint">
              清空
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function LogCard({ log, onClick }) {
  const meta = TYPE_META[log.type] ?? TYPE_META[4]
  const TypeIcon = meta.icon
  const isError = log.type === 5
  const isConsume = log.type === 2
  const other = parseOther(log.other)
  const cache = getCacheTokens(other)
  const frt = other.frt
  const hasTokens = log.prompt_tokens || log.completion_tokens
  const hasCache = cache.read > 0 || cache.write > 0
  const quotaText = formatQuotaDelta(log.quota)
  const quotaCls = quotaDeltaClass(log.quota)

  return (
    <div
      className={`clay-card-interactive !p-4 !rounded-clay cursor-pointer ${isError ? '!bg-red-50/40' : ''}`}
      onClick={onClick}
    >
      {/* Header: type chip + time + quota */}
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className={`w-7 h-7 rounded-full ${meta.bg} flex items-center justify-center shrink-0
            shadow-[2px_2px_4px_rgba(0,0,0,0.08),-1px_-1px_3px_rgba(255,255,255,0.6),inset_1px_1px_2px_rgba(255,255,255,0.4)]`}>
            <TypeIcon className={`w-3.5 h-3.5 ${meta.text}`} strokeWidth={2.5} />
          </div>
          <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-clay-pill shrink-0 ${meta.bg} ${meta.text}`}>
            {meta.label}
          </span>
          {isConsume && (
            <span className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded-clay-pill shrink-0
              ${log.is_stream ? 'bg-clay-blue-100 text-[#43658b]' : 'bg-gray-200/60 text-gray-500'}`}>
              {log.is_stream ? '流' : '非流'}
            </span>
          )}
        </div>
        {quotaText && (
          <span className={`text-sm font-black tabular-nums shrink-0 ${quotaCls}`}>{quotaText}</span>
        )}
      </div>

      {/* Model name (consume) */}
      {isConsume && log.model_name && (
        <div className="mb-2">
          <span className="font-mono text-[11px] font-bold bg-clay-bg shadow-clay-inset px-2.5 py-0.5 rounded-clay-pill inline-block max-w-full truncate">
            {log.model_name}
          </span>
        </div>
      )}

      {/* Tokens row (consume) */}
      {isConsume && (hasTokens || hasCache) && (
        <div className="flex items-center gap-2 flex-wrap text-[11px] font-mono mb-2">
          {hasTokens && (
            <span className="text-clay-faint">
              <span className="font-bold mr-0.5">入</span>{fmtTokens(log.prompt_tokens)}
              <span className="text-clay-faint/50 mx-1">/</span>
              <span className="font-bold mr-0.5">出</span>
              <span className="font-extrabold text-clay-ink">{fmtTokens(log.completion_tokens)}</span>
            </span>
          )}
          {cache.read > 0 && (
            <span className="text-emerald-600">
              <span className="font-bold mr-0.5">缓读</span>{fmtTokens(cache.read)}
            </span>
          )}
          {cache.write > 0 && (
            <span className="text-amber-600">
              <span className="font-bold mr-0.5">缓写</span>{fmtTokens(cache.write)}
            </span>
          )}
        </div>
      )}

      {/* Footer: time + token name + use_time */}
      <div className="flex items-center justify-between gap-2 text-[10px] text-clay-faint">
        <span className="inline-flex items-center gap-1 shrink-0">
          <Clock className="w-3 h-3" />
          {fmtTs(log.created_at)}
        </span>
        <div className="flex items-center gap-2 min-w-0">
          {isConsume && log.use_time ? (
            <span className="font-mono shrink-0">
              {fmtUseTime(log.use_time)}
              {fmtFrt(frt) && <span className="text-emerald-600 ml-0.5">/{fmtFrt(frt)}</span>}
            </span>
          ) : null}
          {log.token_name && (
            <span className="truncate max-w-[120px]" title={log.token_name}>{log.token_name}</span>
          )}
        </div>
      </div>

      {/* Non-consume content */}
      {!isConsume && (
        <div className="mt-3 rounded-clay bg-clay-bg shadow-clay-inset px-3 py-2">
          <div className="text-[10px] font-black text-clay-faint mb-1">详细信息</div>
          <div className="text-xs font-semibold text-clay-ink/80 whitespace-pre-wrap break-all leading-relaxed">
            {log.content || '-'}
          </div>
          {(log.model_name || log.token_name || log.group || log.request_id) && (
            <div className="mt-2 flex flex-wrap gap-1.5 text-[10px] text-clay-faint">
              {log.model_name && <span className="font-mono">模型: {log.model_name}</span>}
              {log.token_name && <span>令牌: {log.token_name}</span>}
              {log.group && <span>分组: {log.group}</span>}
              {log.request_id && <span className="font-mono break-all">ID: {log.request_id}</span>}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function LogRow({ log, onClick }) {
  const meta = TYPE_META[log.type] ?? TYPE_META[4]
  const TypeIcon = meta.icon
  const isError = log.type === 5
  const isConsume = log.type === 2
  const other = parseOther(log.other)
  const cache = getCacheTokens(other)
  const frt = other.frt
  const hasTokens = log.prompt_tokens || log.completion_tokens
  const hasCache = cache.read > 0 || cache.write > 0

  if (!isConsume) {
    return (
      <tr
        className={`border-b border-black/5 last:border-0 hover:bg-white/40 transition-colors cursor-pointer ${isError ? 'bg-red-50/30' : ''}`}
        onClick={onClick}
      >
        <td className="px-4 py-3 align-top">
          <div className="flex items-center gap-2">
            <div className={`w-7 h-7 rounded-full ${meta.bg} flex items-center justify-center shrink-0
              shadow-[2px_2px_4px_rgba(0,0,0,0.08),-1px_-1px_3px_rgba(255,255,255,0.6),inset_1px_1px_2px_rgba(255,255,255,0.4)]`}>
              <TypeIcon className={`w-3.5 h-3.5 ${meta.text}`} strokeWidth={2.5} />
            </div>
            <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-clay-pill ${meta.bg} ${meta.text}`}>
              {meta.label}
            </span>
          </div>
        </td>
        <td className="px-4 py-3" colSpan={5}>
          <LogSummary log={log} />
        </td>
        <td className="px-4 py-3 text-right align-top">
          <span className="text-[11px] text-clay-faint inline-flex items-center gap-1 font-mono whitespace-nowrap">
            <Clock className="w-3 h-3 shrink-0" />
            {fmtTs(log.created_at)}
          </span>
        </td>
      </tr>
    )
  }

  return (
    <tr
      className={`border-b border-black/5 last:border-0 hover:bg-white/40 transition-colors cursor-pointer ${isError ? 'bg-red-50/30' : ''}`}
      onClick={onClick}
    >
      {/* Type */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <div className={`w-7 h-7 rounded-full ${meta.bg} flex items-center justify-center shrink-0
            shadow-[2px_2px_4px_rgba(0,0,0,0.08),-1px_-1px_3px_rgba(255,255,255,0.6),inset_1px_1px_2px_rgba(255,255,255,0.4)]`}>
            <TypeIcon className={`w-3.5 h-3.5 ${meta.text}`} strokeWidth={2.5} />
          </div>
          <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-clay-pill ${meta.bg} ${meta.text}`}>
            {meta.label}
          </span>
        </div>
      </td>

      {/* Model */}
      <td className="px-4 py-3">
        {log.model_name ? (
          <span className="font-mono text-[11px] font-extrabold bg-clay-bg shadow-clay-inset px-2.5 py-1 rounded-clay-pill inline-block max-w-[200px] truncate align-middle">
            {log.model_name}
          </span>
        ) : (
          <span className="text-xs text-clay-faint">-</span>
        )}
      </td>

      {/* Token name */}
      <td className="px-4 py-3">
        <span className="text-xs text-clay-faint truncate block max-w-[120px]" title={log.token_name}>
          {log.token_name || '-'}
        </span>
      </td>

      {/* Token usage */}
      <td className="px-4 py-3 text-right">
        {hasTokens ? (
          <div className="font-mono text-[11px] inline-flex items-center gap-1.5 whitespace-nowrap">
            <span className="text-clay-faint" title="输入">
              <span className="text-[10px] font-bold mr-0.5">入</span>{fmtTokens(log.prompt_tokens)}
            </span>
            <span className="text-clay-faint/50">/</span>
            <span className="font-extrabold" title="输出">
              <span className="text-[10px] font-bold text-clay-faint mr-0.5">出</span>{fmtTokens(log.completion_tokens)}
            </span>
            {hasCache && (
              <>
                <span className="w-px h-3 bg-black/10 mx-0.5" />
                {cache.read > 0 && (
                  <span title="缓存读取" className="text-emerald-600">
                    <span className="text-[10px] font-bold mr-0.5">缓读</span>{fmtTokens(cache.read)}
                  </span>
                )}
                {cache.write > 0 && (
                  <span title="缓存写入" className="text-amber-600">
                    <span className="text-[10px] font-bold mr-0.5">缓写</span>{fmtTokens(cache.write)}
                  </span>
                )}
              </>
            )}
          </div>
        ) : (
          <span className="text-xs text-clay-faint">-</span>
        )}
      </td>

      {/* Quota */}
      <td className="px-4 py-3 text-right">
        {log.quota ? (
          <span className={`text-sm font-black tabular-nums ${log.quota > 0 ? 'text-blue-600' : 'text-emerald-600'}`}>
            {log.quota < 0 ? '+' : '-'}{quotaToDisplay(Math.abs(log.quota)).text}
          </span>
        ) : (
          <span className="text-xs text-clay-faint">-</span>
        )}
      </td>

      {/* Timing */}
      <td className="px-4 py-3 text-right">
        {log.use_time ? (
          <div className="inline-flex items-center justify-end gap-1.5 whitespace-nowrap">
            <span className="font-mono text-[11px] text-clay-faint font-bold">{fmtUseTime(log.use_time)}</span>
            {fmtFrt(frt) && (
              <>
                <span className="text-clay-faint/50 text-[11px]">/</span>
                <span className="font-mono text-[11px] text-emerald-600 font-extrabold">{fmtFrt(frt)}</span>
              </>
            )}
            <span className={`text-[10px] font-extrabold px-1.5 py-0.5 rounded-clay-pill
              ${log.is_stream
                ? 'bg-clay-blue-100 text-[#43658b]'
                : 'bg-gray-200/60 text-gray-500'
              }`}>
              {log.is_stream ? '流' : '非流'}
            </span>
          </div>
        ) : (
          <span className="text-xs text-clay-faint">-</span>
        )}
      </td>

      {/* Time */}
      <td className="px-4 py-3 text-right">
        <span className="text-[11px] text-clay-faint inline-flex items-center gap-1 font-mono whitespace-nowrap">
          <Clock className="w-3 h-3 shrink-0" />
          {fmtTs(log.created_at)}
        </span>
      </td>
    </tr>
  )
}

export default function LogList() {
  const toast = useToast()
  const isMobile = useIsMobile()
  const [logs, setLogs] = useState([])
  const [total, setTotal] = useState(0)
  const [todayQuota, setTodayQuota] = useState(0)
  const [todayLoading, setTodayLoading] = useState(true)
  const [refundSummary, setRefundSummary] = useState(null)
  const [refundLoading, setRefundLoading] = useState(true)
  const [refundSubmitting, setRefundSubmitting] = useState(false)
  const [refundModalOpen, setRefundModalOpen] = useState(false)
  const [refundRecordsOpen, setRefundRecordsOpen] = useState(false)
  const [refundAppeals, setRefundAppeals] = useState([])
  const [refundAppealsTotal, setRefundAppealsTotal] = useState(0)
  const [refundAppealsLoading, setRefundAppealsLoading] = useState(true)
  const [refundReason, setRefundReason] = useState('')
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [showFilter, setShowFilter] = useState(false)
  const [detailLog, setDetailLog] = useState(null)
  const requestSeq = useRef(0)

  const [filter, setFilter] = useState(() => defaultLogFilter())
  const [appliedFilter, setAppliedFilter] = useState(() => defaultLogFilter())

  const pageSize = 20

  const load = useCallback(async (p) => {
    const seq = requestSeq.current + 1
    requestSeq.current = seq
    setLoading(true)
    try {
      const params = { p, size: pageSize }
      if (appliedFilter.type) params.type = appliedFilter.type
      if (appliedFilter.model_name) params.model_name = appliedFilter.model_name
      if (appliedFilter.token_name) params.token_name = appliedFilter.token_name
      if (appliedFilter.start_timestamp) params.start_timestamp = Math.floor(new Date(appliedFilter.start_timestamp).getTime() / 1000)
      if (appliedFilter.end_timestamp) params.end_timestamp = Math.floor(new Date(appliedFilter.end_timestamp).getTime() / 1000)
      const res = await getUserLogs(params)
      const data = res?.data
      if (seq === requestSeq.current) {
        setLogs(data?.items ?? data ?? [])
        setTotal(data?.total ?? 0)
      }
    } catch (e) {
      if (seq === requestSeq.current) {
        toast(e?.response?.data?.message ?? '加载失败', 'error')
      }
    } finally {
      if (seq === requestSeq.current) {
        setLoading(false)
      }
    }
  }, [appliedFilter, toast])

  useEffect(() => { load(page) }, [page, load])

  const loadTodayStat = useCallback(async () => {
    setTodayLoading(true)
    try {
      const d = new Date()
      d.setHours(0, 0, 0, 0)
      const startTs = Math.floor(d.getTime() / 1000)
      const res = await getUserLogsStat({ type: 2, start_timestamp: startTs })
      setTodayQuota(res?.data?.quota ?? 0)
    } catch (_) {
      setTodayQuota(0)
    } finally {
      setTodayLoading(false)
    }
  }, [])

  useEffect(() => { loadTodayStat() }, [loadTodayStat])

  const loadRefundSummary = useCallback(async () => {
    setRefundLoading(true)
    try {
      const res = await getRefundCandidates()
      if (res?.success !== false) setRefundSummary(res?.data ?? null)
    } catch (_) {
      setRefundSummary(null)
    } finally {
      setRefundLoading(false)
    }
  }, [])

  useEffect(() => { loadRefundSummary() }, [loadRefundSummary])

  const loadRefundAppeals = useCallback(async () => {
    setRefundAppealsLoading(true)
    try {
      const res = await listMyRefundAppeals({ p: 1, size: 10 })
      if (res?.success === false) throw new Error(res.message || '申诉记录加载失败')
      setRefundAppeals(getPageItems(res))
      setRefundAppealsTotal(getPageTotal(res))
    } catch (_) {
      setRefundAppeals([])
      setRefundAppealsTotal(0)
    } finally {
      setRefundAppealsLoading(false)
    }
  }, [])

  useEffect(() => { loadRefundAppeals() }, [loadRefundAppeals])

  const refreshLatest = useCallback(() => {
    if (page !== 1) {
      setPage(1)
    } else {
      load(1)
    }
    loadTodayStat()
    loadRefundSummary()
    loadRefundAppeals()
  }, [load, loadRefundAppeals, loadRefundSummary, loadTodayStat, page])

  const submitRefundAppeal = async () => {
    setRefundSubmitting(true)
    try {
      const res = await createRefundAppeal({ reason: refundReason })
      if (res?.success === false) {
        toast(res.message || '提交失败', 'error')
        return
      }
      const appeal = res?.data?.appeal
      toast(`已提交空回补偿审核${appeal?.total_items ? `，共 ${appeal.total_items} 条` : ''}`, 'success')
      setRefundModalOpen(false)
      setRefundReason('')
      await Promise.all([loadRefundSummary(), loadRefundAppeals()])
    } catch (e) {
      toast(e?.response?.data?.message ?? e.message ?? '提交失败', 'error')
    } finally {
      setRefundSubmitting(false)
    }
  }

  const onApply = () => {
    setAppliedFilter({ ...filter })
    setPage(1)
    setShowFilter(false)
  }

  const onReset = () => {
    const next = defaultLogFilter()
    setFilter(next)
    setAppliedFilter(next)
    setPage(1)
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  const hasActiveFilter = hasNonDefaultLogFilter(appliedFilter)
  const refreshing = loading || todayLoading
  const refundRecordCount = Math.max(refundAppealsTotal, refundAppeals.length)
  const hasRefundRecords = refundRecordCount > 0 || (refundSummary?.pending_count ?? 0) > 0

  return (
    <ClayConsoleShell
      title="调用日志"
      subtitle="查看 API 调用记录与消费明细"
      actions={
        <div className="flex items-center gap-2">
          <ClayButton variant="ghost" onClick={refreshLatest} disabled={refreshing}>
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} /> 刷新
          </ClayButton>
          <ClayButton variant={hasActiveFilter ? 'secondary' : 'ghost'} onClick={() => setShowFilter((v) => !v)}>
            <Filter className="w-4 h-4" /> 筛选{hasActiveFilter ? '（已设置）' : ''}
          </ClayButton>
        </div>
      }
    >
      {/* Today consumption */}
      <ClayCard className="mb-6 !p-4 md:!p-5 bg-gradient-to-br from-clay-pink-50 to-clay-pink-100">
        <div className="flex flex-col md:flex-row md:items-center gap-3 md:gap-4">
          <div className="w-11 h-11 md:w-12 md:h-12 rounded-full bg-clay-pink-200 text-white shadow-clay flex items-center justify-center shrink-0">
            <TrendingUp className="w-5 h-5" strokeWidth={2.5} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-xs font-bold text-clay-faint">今日消耗（自 0:00 起）</div>
            <div className="text-2xl md:text-3xl font-black tracking-tight mt-0.5">
              {todayLoading ? (
                <span className="text-clay-faint text-base">加载中…</span>
              ) : (
                quotaToDisplay(todayQuota).text
              )}
            </div>
          </div>
          <div className="flex w-full items-center gap-2 md:w-auto md:ml-auto">
            {!refundLoading && refundSummary?.available && (
              <ClayButton
                variant="secondary"
                onClick={() => setRefundModalOpen(true)}
                className="min-w-0 flex-1 md:flex-none !h-10 !px-3 !py-0 !text-xs sm:!text-sm md:!px-5 md:!py-2.5 whitespace-nowrap leading-none"
              >
                <ShieldCheck className="w-4 h-4 shrink-0" />
                <span className="sm:hidden">补空回</span>
                <span className="hidden sm:inline">自助补空回</span>
              </ClayButton>
            )}
            {!refundAppealsLoading && hasRefundRecords && (
              <ClayButton
                variant={!refundSummary?.available && refundSummary?.pending_count > 0 ? 'secondary' : 'ghost'}
                onClick={() => {
                  setRefundRecordsOpen(true)
                  loadRefundAppeals()
                }}
                className="min-w-0 flex-1 md:flex-none !h-10 !px-3 !py-0 !text-xs sm:!text-sm md:!px-5 md:!py-2.5 whitespace-nowrap leading-none"
              >
                <History className="w-4 h-4 shrink-0" />
                {refundSummary?.pending_count > 0 ? (
                  <>
                    <span className="sm:hidden">审核中</span>
                    <span className="hidden sm:inline">申诉审核中</span>
                  </>
                ) : (
                  <>
                    <span className="sm:hidden">记录</span>
                    <span className="hidden sm:inline">申诉记录</span>
                  </>
                )}
              </ClayButton>
            )}
            <ClayButton
              variant="ghost"
              onClick={refreshLatest}
              disabled={refreshing}
              aria-label="刷新"
              title="刷新"
              className="shrink-0 !w-10 !h-10 !p-0"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            </ClayButton>
          </div>
        </div>
      </ClayCard>

      {/* Filter Panel */}
      {showFilter && (
        <ClayCard className="mb-6 !p-6 !overflow-visible">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="mb-5">
              <label className="block ml-4 mb-2 font-bold text-sm text-clay-ink">类型</label>
              <ClaySelect
                value={filter.type}
                onChange={(v) => setFilter((current) => ({ ...current, type: v }))}
                options={TYPE_OPTIONS}
              />
            </div>
            <ClayField
              label="模型"
              value={filter.model_name}
              onChange={(e) => setFilter((current) => ({ ...current, model_name: e.target.value }))}
              placeholder="如 gpt-4o"
            />
            <ClayField
              label="令牌名称"
              value={filter.token_name}
              onChange={(e) => setFilter((current) => ({ ...current, token_name: e.target.value }))}
              placeholder="令牌名称"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
            <ClayDateTimeField
              label="开始时间"
              value={filter.start_timestamp}
              onChange={(value) => setFilter((current) => ({ ...current, start_timestamp: value }))}
            />
            <ClayDateTimeField
              label="结束时间"
              value={filter.end_timestamp}
              onChange={(value) => setFilter((current) => ({ ...current, end_timestamp: value }))}
            />
          </div>
          <div className="flex flex-col sm:flex-row gap-3 mt-5">
            <ClayButton variant="primary" onClick={onApply} className="sm:!w-auto">
              <Search className="w-4 h-4" /> 应用筛选
            </ClayButton>
            <ClayButton variant="ghost" onClick={onReset} className="sm:!w-auto">重置</ClayButton>
          </div>
        </ClayCard>
      )}

      {/* Table (desktop) / Cards (mobile) */}
      {isMobile ? (
        <div className="space-y-2.5">
          {loading && (
            <ClayCard className="!py-12 text-center">
              <div className="flex flex-col items-center gap-3">
                <RefreshCw className="w-8 h-8 text-clay-faint animate-spin" />
                <span className="text-clay-faint font-bold">加载中…</span>
              </div>
            </ClayCard>
          )}
          {!loading && logs.length === 0 && (
            <ClayCard className="!py-12 text-center">
              <div className="flex flex-col items-center gap-3">
                <FileText className="w-10 h-10 text-clay-faint/50" />
                <span className="text-clay-faint font-bold">暂无日志</span>
              </div>
            </ClayCard>
          )}
          {!loading && logs.map((l) => (
            <LogCard key={l.id} log={l} onClick={() => setDetailLog(l)} />
          ))}
        </div>
      ) : (
        <ClayCard className="!p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-clay-bg/50">
              <tr className="border-b border-black/5 text-left text-[11px] uppercase tracking-wider text-clay-faint">
                <th className="px-4 py-3 font-extrabold">类型</th>
                <th className="px-4 py-3 font-extrabold">详情 / 模型</th>
                <th className="px-4 py-3 font-extrabold">令牌</th>
                <th className="px-4 py-3 font-extrabold text-right">Token 用量</th>
                <th className="px-4 py-3 font-extrabold text-right">额度</th>
                <th className="px-4 py-3 font-extrabold text-right">用时 / 首字</th>
                <th className="px-4 py-3 font-extrabold text-right">时间</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={7} className="px-5 py-16 text-center">
                  <div className="flex flex-col items-center gap-3">
                    <RefreshCw className="w-8 h-8 text-clay-faint animate-spin" />
                    <span className="text-clay-faint font-bold">加载中…</span>
                  </div>
                </td></tr>
              )}
              {!loading && logs.length === 0 && (
                <tr><td colSpan={7} className="px-5 py-16 text-center">
                  <div className="flex flex-col items-center gap-3">
                    <FileText className="w-10 h-10 text-clay-faint/50" />
                    <span className="text-clay-faint font-bold">暂无日志</span>
                  </div>
                </td></tr>
              )}
              {!loading && logs.map((l) => (
                <LogRow key={l.id} log={l} onClick={() => setDetailLog(l)} />
              ))}
            </tbody>
          </table>
        </ClayCard>
      )}

      {/* Pagination */}
      <div className="flex items-center justify-between mt-6">
        <span className="text-sm text-clay-faint font-bold">共 {total} 条记录</span>
        {totalPages > 1 && (
          <div className="flex items-center gap-3">
            <ClayButton variant="ghost" disabled={page <= 1} onClick={() => setPage(page - 1)}>
              <ChevronLeft className="w-4 h-4" />
            </ClayButton>
            <span className="text-sm font-extrabold bg-clay-bg shadow-clay-inset px-4 py-1.5 rounded-clay-pill whitespace-nowrap">
              {page} / {totalPages}
            </span>
            <ClayButton variant="ghost" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
              <ChevronRight className="w-4 h-4" />
            </ClayButton>
          </div>
        )}
      </div>

      {/* Detail Modal */}
      <ClayModal open={!!detailLog} onClose={() => setDetailLog(null)} title="请求详情" size="lg">
        {detailLog && <LogDetailContent log={detailLog} />}
      </ClayModal>

      <ClayModal
        open={refundModalOpen}
        onClose={() => setRefundModalOpen(false)}
        title="提交空回补偿审核"
        size="lg"
        footer={
          <>
            <ClayButton variant="ghost" onClick={() => setRefundModalOpen(false)}>
              取消
            </ClayButton>
            <ClayButton variant="secondary" onClick={submitRefundAppeal} disabled={refundSubmitting}>
              <ShieldCheck className="w-4 h-4" />
              {refundSubmitting ? '提交中' : '提交审核'}
            </ClayButton>
          </>
        }
      >
        <div className="space-y-5">
          <div className="rounded-clay bg-clay-bg shadow-clay-inset p-5">
            <div className="text-sm font-bold text-clay-faint mb-1">检测结果</div>
            <div className="text-2xl font-black text-clay-ink">
              {refundSummary?.count ?? 0} 条疑似空回
            </div>
            <div className="text-sm font-semibold text-clay-faint mt-2">
              预计补偿 {quotaToDisplay(refundSummary?.refund_quota || 0).text}，提交后由管理员人工审核，通过后写入管理日志并增加余额。
            </div>
          </div>
          <label className="block">
            <span className="block text-sm font-extrabold text-clay-ink mb-2">补充说明（可选）</span>
            <textarea
              value={refundReason}
              onChange={(e) => setRefundReason(e.target.value)}
              className="clay-input min-h-[120px] resize-y leading-7"
              placeholder="例如：Gemini 多次空回但仍扣费"
            />
          </label>
          <div className="text-xs font-semibold text-clay-faint leading-relaxed">
            系统只会提交最近 48 小时内尚未处理的疑似空回记录，已提交或已审核的日志会自动排除。
          </div>
        </div>
      </ClayModal>

      <ClayModal
        open={refundRecordsOpen}
        onClose={() => setRefundRecordsOpen(false)}
        title="空回申诉记录"
        size="lg"
      >
        <RefundAppealRecordsContent
          appeals={refundAppeals}
          total={refundAppealsTotal}
          loading={refundAppealsLoading}
        />
      </ClayModal>
    </ClayConsoleShell>
  )
}
