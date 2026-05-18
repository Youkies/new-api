import { useEffect, useState, useCallback, useMemo, useRef, useSyncExternalStore } from 'react'
import {
  Search, ChevronLeft, ChevronRight, Filter,
  Clock, CalendarDays,
  Activity, AlertCircle, RefreshCw, CreditCard, Settings, Terminal,
  RotateCcw, FileText, TrendingUp, ShieldCheck, History, CheckCircle2, XCircle, X,
  Cpu, Tag, ArrowDown, ArrowUp, Zap, Timer, Rows, LayoutGrid, Copy,
} from 'lucide-react'
import ClayCard from '../components/clay/ClayCard.jsx'
import ClayButton from '../components/clay/ClayButton.jsx'
import ClayField from '../components/clay/ClayField.jsx'
import ClaySelect from '../components/clay/ClaySelect.jsx'
import ClayModal from '../components/clay/ClayModal.jsx'
import ClayConsoleShell from '../components/layout/ClayConsoleShell.jsx'
import { useToast } from '../context/ToastContext.jsx'
import { quotaToDisplay, getCurrencyConfig } from '../utils/quota.js'
import { copyTextToClipboard } from '../utils/clipboard.js'
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
  1: { label: '充值', icon: CreditCard, bg: 'bg-clay-green-100', text: 'text-clay-green-ink', ring: 'ring-clay-green-200/60' },
  2: { label: '消费', icon: Activity, bg: 'bg-clay-blue-100', text: 'text-clay-blue-ink', ring: 'ring-clay-blue-200/60' },
  3: { label: '管理', icon: Settings, bg: 'bg-clay-purple-100', text: 'text-clay-purple-ink', ring: 'ring-clay-purple-200/60' },
  4: { label: '系统', icon: Terminal, bg: 'bg-clay-bg', text: 'text-clay-faint', ring: 'ring-clay-line/15' },
  5: { label: '错误', icon: AlertCircle, bg: 'bg-clay-pink-100', text: 'text-clay-pink-ink', ring: 'ring-clay-pink-200/60' },
  6: { label: '退款', icon: RotateCcw, bg: 'bg-clay-yellow-100', text: 'text-clay-yellow-ink', ring: 'ring-clay-yellow-200/60' },
}

const REFUND_STATUS_META = {
  pending: { label: '待审核', icon: Clock, cls: 'bg-clay-yellow-100 text-clay-yellow-ink' },
  approved: { label: '已补偿', icon: CheckCircle2, cls: 'bg-clay-green-100 text-clay-green-ink' },
  rejected: { label: '已驳回', icon: XCircle, cls: 'bg-clay-pink-100 text-clay-pink-ink' },
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

const TOPUP_SOURCE_PATTERNS = [
  { re: /^KPay/, label: 'KPay 充值' },
  { re: /^Waffo Pancake/, label: 'Waffo 充值' },
  { re: /^Waffo/, label: 'Waffo 充值' },
  { re: /^Creem/, label: 'Creem 充值' },
  { re: /^管理员补单/, label: '管理员补单' },
  { re: /^通过兑换码/, label: '兑换码充值' },
  { re: /^使用在线充值/, label: '在线充值' },
  { re: /^新用户注册/, label: '新人赠送' },
  { re: /订阅|subscription/i, label: '订阅入账' },
]

function detectTopupSource(content) {
  const s = String(content || '').trim()
  for (const p of TOPUP_SOURCE_PATTERNS) {
    if (p.re.test(s)) return p.label
  }
  return '充值入账'
}

function parseAmountsFromContent(content) {
  const s = String(content || '')
  const matches = []
  // Primary: currency symbol (¥/$/€/£/custom ¤) followed by a number. Symbol may be absent
  //   for some backends (e.g. TOKENS mode), in which case we still capture the bare number
  //   when it sits in a clearly numeric position.
  const re = /([¥$€£¤])\s*([\d,]+(?:\.\d+)?)/g
  let m
  while ((m = re.exec(s)) !== null) {
    matches.push({ symbol: m[1] || '', value: m[2] })
  }
  // Fallback: explicit Chinese labels without symbol (TOKENS mode, etc.)
  if (matches.length === 0) {
    const re2 = /(?:充值额度|充值金额|获得额度|支付金额|金额|赠送)[：:]?\s*([\d,]+(?:\.\d+)?)/g
    while ((m = re2.exec(s)) !== null) {
      matches.push({ symbol: '', value: m[1] })
    }
  }
  return matches
}

function formatAmount(raw) {
  if (!raw) return ''
  const n = Number(String(raw).replace(/,/g, ''))
  if (!Number.isFinite(n)) return raw
  return n >= 100 ? n.toFixed(2) : n.toFixed(4).replace(/0+$/, '').replace(/\.$/, '')
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
    <div className="flex items-start py-2 border-b border-clay-line/10 last:border-0">
      <span className="text-xs text-clay-faint w-28 shrink-0 pt-0.5">{label}</span>
      <span className={`text-sm flex-1 break-all ${mono ? 'font-mono text-xs' : ''}`}>{value}</span>
    </div>
  )
}

function LogDetailContent({ log, onCopy }) {
  const other = parseOther(log.other)
  const cache = getCacheTokens(other)
  const frt = other.frt > 0 ? other.frt : null
  const meta = TYPE_META[log.type] ?? TYPE_META[4]
  const isError = log.type === 5

  return (
    <div className="space-y-5">
      {/* Error message — highlighted at top, click to copy */}
      {isError && log.content && (
        <div
          role="button"
          tabIndex={0}
          onClick={() => onCopy?.(log.content)}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onCopy?.(log.content) }}
          className="group relative cursor-pointer rounded-clay bg-clay-pink-100 px-4 py-4 shadow-clay-sm transition-all duration-200 ease-clay hover:shadow-clay-hover active:scale-[0.99]"
          title="点击复制错误信息"
        >
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-full bg-clay-pink-200/70 text-clay-pink-ink flex items-center justify-center shrink-0 shadow-clay-sm">
              <AlertCircle className="w-4 h-4" strokeWidth={2.6} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <span className="text-[11px] font-black uppercase tracking-wider text-clay-pink-ink/70">错误信息</span>
                <span className="inline-flex items-center gap-1 text-[11px] font-extrabold text-clay-pink-ink/70 group-hover:text-clay-pink-ink transition-colors">
                  <Copy className="w-3 h-3" strokeWidth={2.6} />
                  点击复制
                </span>
              </div>
              <div className="text-sm font-bold text-clay-pink-ink whitespace-pre-wrap break-all leading-relaxed">
                {log.content}
              </div>
            </div>
          </div>
        </div>
      )}

      <div>
        <DetailRow label="时间" value={log.created_at ? new Date(log.created_at * 1000).toLocaleString('zh-CN') : '-'} />
        <DetailRow label="类型" value={
          <span className={`text-[11px] font-extrabold px-3 py-1 rounded-clay-pill shadow-clay-sm ${meta.bg} ${meta.text}`}>
            {meta.label}
          </span>
        } />
        {log.requested_model_name && log.requested_model_name !== log.model_name && (
          <DetailRow label="用户请求" value={log.requested_model_name} mono />
        )}
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
                <p className="text-xl font-black font-mono text-clay-green-ink">{cache.read.toLocaleString()}</p>
              </div>
            )}
            {cache.write > 0 && (
              <div>
                <span className="text-[11px] text-clay-faint">缓存写入</span>
                <p className="text-xl font-black font-mono text-clay-yellow-ink">{cache.write.toLocaleString()}</p>
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
                <p className="text-xl font-black font-mono text-clay-green-ink">{fmtFrt(frt)}</p>
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
            <span className={`font-extrabold ${log.quota > 0 ? 'text-clay-pink-400' : 'text-clay-green-ink'}`}>
              {quotaToDisplay(Math.abs(log.quota), 4).text}
            </span>
          }
        />
      ) : null}

      {/* Non-error content is shown plainly at the bottom; error already shown above */}
      {!isError && log.content && (
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
              <div className="text-sm font-black text-clay-pink-ink mt-1">{quotaToDisplay(appeal.refund_quota || 0).text}</div>
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
const WHEEL_REPEAT = 5
const WHEEL_CENTER_REPEAT = Math.floor(WHEEL_REPEAT / 2)
const WHEEL_ITEM_HEIGHT = 32
const WHEEL_CONTAINER_HEIGHT = 88
const WHEEL_EDGE_PADDING = (WHEEL_CONTAINER_HEIGHT - WHEEL_ITEM_HEIGHT) / 2

function wrapIndex(index, length) {
  if (!length) return 0
  return ((index % length) + length) % length
}

function ClayTimeColumn({ options, value, onSelect, tone = 'blue' }) {
  const scrollRef = useRef(null)
  const snapTimerRef = useRef(null)
  const syncTimerRef = useRef(null)
  const syncingRef = useRef(false)
  const wheelOptions = useMemo(() => (
    Array.from({ length: WHEEL_REPEAT }, (_, round) => (
      options.map((option) => ({
        key: `${round}-${option}`,
        option,
      }))
    )).flat()
  ), [options])
  const highlightClass = tone === 'pink'
    ? 'bg-clay-pink-100/80 text-clay-pink-ink'
    : 'bg-clay-blue-100/80 text-clay-blue-ink'
  const activeTextClass = tone === 'pink' ? 'text-clay-pink-ink' : 'text-clay-blue-ink'

  const scrollToOption = useCallback((optionValue, behavior = 'auto') => {
    const container = scrollRef.current
    if (!container || options.length === 0) return
    const optionIndex = Math.max(0, options.indexOf(optionValue))
    const targetIndex = (WHEEL_CENTER_REPEAT * options.length) + optionIndex
    syncingRef.current = true
    container.scrollTo({
      top: targetIndex * WHEEL_ITEM_HEIGHT,
      behavior,
    })
    window.clearTimeout(syncTimerRef.current)
    syncTimerRef.current = window.setTimeout(() => {
      syncingRef.current = false
    }, behavior === 'smooth' ? 220 : 40)
  }, [options])

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => scrollToOption(value, 'auto'))
    return () => window.cancelAnimationFrame(frame)
  }, [scrollToOption, value])

  useEffect(() => () => {
    window.clearTimeout(snapTimerRef.current)
    window.clearTimeout(syncTimerRef.current)
  }, [])

  const commitNearest = useCallback((behavior = 'smooth') => {
    const container = scrollRef.current
    if (!container || options.length === 0) return
    const rawIndex = Math.round(container.scrollTop / WHEEL_ITEM_HEIGHT)
    const optionIndex = wrapIndex(rawIndex, options.length)
    const option = options[optionIndex]
    const targetIndex = (WHEEL_CENTER_REPEAT * options.length) + optionIndex

    syncingRef.current = true
    container.scrollTo({
      top: targetIndex * WHEEL_ITEM_HEIGHT,
      behavior,
    })
    window.clearTimeout(syncTimerRef.current)
    syncTimerRef.current = window.setTimeout(() => {
      syncingRef.current = false
    }, behavior === 'smooth' ? 220 : 40)

    if (option && option !== value) onSelect(option)
  }, [onSelect, options, value])

  const handleScroll = useCallback(() => {
    if (syncingRef.current) return
    const container = scrollRef.current
    if (!container || options.length === 0) return
    const rawIndex = Math.round(container.scrollTop / WHEEL_ITEM_HEIGHT)
    const lowerBuffer = options.length
    const upperBuffer = options.length * (WHEEL_REPEAT - 1)

    if (rawIndex < lowerBuffer || rawIndex >= upperBuffer) {
      const optionIndex = wrapIndex(rawIndex, options.length)
      const targetIndex = (WHEEL_CENTER_REPEAT * options.length) + optionIndex
      syncingRef.current = true
      container.scrollTop = targetIndex * WHEEL_ITEM_HEIGHT
      window.clearTimeout(syncTimerRef.current)
      syncTimerRef.current = window.setTimeout(() => {
        syncingRef.current = false
      }, 40)
    }

    window.clearTimeout(snapTimerRef.current)
    snapTimerRef.current = window.setTimeout(() => commitNearest('smooth'), 90)
  }, [commitNearest, options.length])

  return (
    <div className="min-w-0 flex-1">
      <div className="relative h-[88px] overflow-hidden rounded-[18px] bg-clay-bg shadow-clay-inset">
        <div
          className={`pointer-events-none absolute left-1 right-1 top-1/2 z-0 h-8 -translate-y-1/2 rounded-[14px] shadow-clay ${highlightClass}`}
        />
        <div
          ref={scrollRef}
          onScroll={handleScroll}
          className="clay-scrollbar-none relative z-10 h-full overflow-y-auto overscroll-contain"
          style={{
            paddingTop: WHEEL_EDGE_PADDING,
            paddingBottom: WHEEL_EDGE_PADDING,
            scrollSnapType: 'y mandatory',
          }}
        >
          {wheelOptions.map(({ key, option }) => {
            const active = option === value
            return (
              <button
                key={key}
                type="button"
                aria-current={active ? 'true' : undefined}
                onClick={() => {
                  onSelect(option)
                  scrollToOption(option, 'smooth')
                }}
                className={`flex h-8 w-full snap-center items-center justify-center rounded-[14px] px-3 text-center font-mono text-base font-black transition-colors ${
                  active
                    ? activeTextClass
                    : 'text-clay-faint/70 hover:text-clay-ink'
                }`}
              >
                {option}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function formatQuotaDelta(quota) {
  if (!quota) return null
  // v4: drop +/- sign, 4 decimals; color tells direction
  return quotaToDisplay(Math.abs(quota), 4).text
}

function quotaDeltaClass(quota) {
  // quota > 0 = consumption (deduction) = pink; quota < 0 = credit/refund = emerald
  return quota > 0 ? 'text-clay-pink-400' : 'text-clay-green-ink'
}

function ClayDateTimeField({ label, value, onChange, align = 'left' }) {
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
    ? 'clay-scrollbar-none fixed inset-x-3 top-1/2 z-[10000] mx-auto max-w-[340px] max-h-[calc(100dvh-1rem)] -translate-y-1/2 overflow-y-auto rounded-[26px] bg-clay-bg p-2.5 shadow-clay border-2 border-white/30'
    : `absolute ${align === 'right' ? 'right-0' : 'left-0'} top-full z-[120] mt-3 w-[380px] max-w-[calc(100vw-2rem)] rounded-[28px] bg-clay-bg p-4 shadow-clay border-2 border-white/30`

  return (
    <div ref={rootRef} className="relative">
      <label className="block ml-4 mb-1.5 md:mb-2 font-bold text-sm text-clay-ink">{label}</label>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full clay-input !py-3 md:!py-3.5 flex items-center justify-between gap-3 text-left"
      >
        <span className={value ? 'font-semibold' : 'text-clay-faint'}>{formatDateTimeLabel(value)}</span>
        <CalendarDays className="w-4 h-4 text-clay-faint shrink-0" />
      </button>

      {open && (
        <div className={panelClassName}>
          <div className="flex items-center justify-between mb-2.5">
            <button type="button" onClick={() => jumpMonth(-1)} className="clay-icon-btn" aria-label="上一月">
              <ChevronLeft className="w-4 h-4" />
            </button>
            <div className="text-sm font-black">{monthLabel}</div>
            <button type="button" onClick={() => jumpMonth(1)} className="clay-icon-btn" aria-label="下一月">
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-0.5 sm:gap-1 text-center text-[10px] font-black text-clay-faint mb-1">
            {['日', '一', '二', '三', '四', '五', '六'].map((day) => <span key={day}>{day}</span>)}
          </div>
          <div className="grid grid-cols-7 gap-0.5 sm:gap-1">
            {monthDays.map((day) => {
              const inMonth = day.getMonth() === viewDate.getMonth()
              const active = value && sameDate(day, selectedDate)
              const today = sameDate(day, new Date())
              return (
                <button
                  key={day.toISOString()}
                  type="button"
                  onClick={() => setDate(day)}
                  className={`aspect-square rounded-[14px] text-[11px] font-black transition-all sm:rounded-clay-sm sm:text-xs ${
                    active
                      ? 'bg-clay-blue-100 text-clay-blue-ink shadow-clay-inset'
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

          <div className="mt-2.5 flex items-center gap-2 sm:mt-4 sm:gap-3">
            <ClayTimeColumn
              options={HOUR_OPTIONS}
              value={selectedHour}
              onSelect={(hour) => setTimePart('hour', hour)}
              tone="blue"
            />
            <div className="flex h-[88px] items-center font-black text-clay-faint">:</div>
            <ClayTimeColumn
              options={MINUTE_OPTIONS}
              value={selectedMinute}
              onSelect={(minute) => setTimePart('minute', minute)}
              tone="pink"
            />
          </div>

          <div className="mt-2.5 grid grid-cols-2 gap-2 sm:mt-4 sm:flex sm:flex-wrap">
            <button type="button" onClick={setTodayStart} className="px-3 py-2 rounded-clay-pill bg-clay-pink-50 shadow-clay text-[11px] font-black text-clay-pink-ink">
              今天 0 点
            </button>
            <button type="button" onClick={setNow} className="px-3 py-2 rounded-clay-pill bg-clay-blue-50 shadow-clay text-[11px] font-black text-clay-blue-ink">
              现在
            </button>
            <button type="button" onClick={() => { onChange(''); setOpen(false) }} className="px-3 py-2 rounded-clay-pill bg-clay-bg shadow-clay text-[11px] font-black text-clay-faint">
              清空
            </button>
            <button type="button" onClick={() => setOpen(false)} className="px-3 py-2 rounded-clay-pill bg-clay-green-100 shadow-clay text-[11px] font-black text-clay-green-ink">
              确认
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
  const isTopup = log.type === 1
  const isSystem = log.type === 4
  const isRefund = log.type === 6
  const isManage = log.type === 3
  const other = parseOther(log.other)
  const cache = getCacheTokens(other)
  const frt = other.frt > 0 ? other.frt : null
  const frtText = fmtFrt(frt)
  const quotaText = formatQuotaDelta(log.quota)
  const quotaCls = quotaDeltaClass(log.quota)
  const hasAlias = Boolean(log.requested_model_name && log.requested_model_name !== log.model_name)
  const hasCache = cache.read > 0 || cache.write > 0

  const showModelHeader = isConsume || isError

  // Parse credit amount for topup / system reward.
  // Content may have been written long ago with a different quota_display_type — always render
  // with the *current* global currency symbol so the page stays consistent with the user's settings.
  const globalCurrency = (isTopup || isSystem || isRefund) ? getCurrencyConfig() : null
  let creditAmount = null
  let creditSymbol = ''
  let topupSource = null
  let payAmount = null
  let paySymbol = ''
  if (isTopup || isSystem || isRefund) {
    const amounts = parseAmountsFromContent(log.content)
    const globalSymbol = globalCurrency?.symbol || ''
    if (amounts[0]) {
      creditAmount = formatAmount(amounts[0].value)
      creditSymbol = globalSymbol
    }
    if (amounts[1]) {
      payAmount = formatAmount(amounts[1].value)
      paySymbol = globalSymbol
    }
    if (isTopup) topupSource = detectTopupSource(log.content)
  }

  // Title: alias id / real model for consume·error; source label for topup; summary for system/refund/manage
  const titleText = showModelHeader
    ? (hasAlias ? log.requested_model_name : (log.model_name || meta.label))
    : isTopup
      ? topupSource
      : isSystem
        ? (String(log.content || '').split(/[,，]/)[0].trim() || meta.label)
        : (log.content || meta.label)

  return (
    <div
      className={`clay-card-interactive !p-5 !rounded-clay cursor-pointer flex min-h-[148px] ${isError ? '!bg-clay-pink-50/60' : ''}`}
      onClick={onClick}
    >
      <div className="flex items-start gap-3.5 w-full">
        {/* Unified big icon per category */}
        <div
          className={`w-11 h-11 rounded-full ${meta.bg} flex items-center justify-center shrink-0 mt-0.5 shadow-clay-sm`}
        >
          <TypeIcon className={`w-5 h-5 ${meta.text}`} strokeWidth={2.5} />
        </div>

        <div className="flex-1 min-w-0 flex flex-col">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              {/* Main title */}
              <div className="flex items-baseline gap-1.5 min-w-0">
                {showModelHeader && (
                  hasAlias ? (
                    <Tag className="w-3.5 h-3.5 text-clay-purple-ink shrink-0 self-baseline translate-y-0.5" strokeWidth={2.6} />
                  ) : (
                    <Cpu className="w-3.5 h-3.5 text-clay-yellow-ink shrink-0 self-baseline translate-y-0.5" strokeWidth={2.6} />
                  )
                )}
                <span
                  className="text-[15px] font-black text-clay-ink break-all leading-snug tracking-tight"
                  title={titleText}
                >
                  {titleText}
                </span>
              </div>

              {/* Subtitle */}
              {showModelHeader && (
                <div className="text-xs font-bold mt-1 leading-snug break-all">
                  {hasAlias ? (
                    <>
                      {log.group && log.group !== log.requested_model_name && (
                        <>
                          <span className="text-clay-purple-ink">{log.group}</span>
                          <span className="text-clay-faint/60 font-black mx-1.5">/</span>
                        </>
                      )}
                      <span className="text-clay-yellow-ink" title={log.model_name}>{log.model_name}</span>
                    </>
                  ) : log.group ? (
                    <>
                      <span className="text-clay-purple-ink">{log.group}</span>
                      <span className="text-clay-faint/60 ml-1.5">· 透传</span>
                    </>
                  ) : (
                    <span className="text-clay-faint/60">透传</span>
                  )}
                </div>
              )}

              {isTopup && (
                <div className="text-xs font-bold mt-1 leading-snug text-clay-faint">
                  {creditAmount ? (
                    <>
                      <span className="text-clay-green-ink font-extrabold">{creditSymbol}{creditAmount}</span>
                      <span className="mx-1.5 text-clay-faint/60">额度</span>
                      {payAmount && (
                        <>
                          <span className="text-clay-faint/60 font-black">·</span>
                          <span className="ml-1.5">实付 {paySymbol}{payAmount}</span>
                        </>
                      )}
                    </>
                  ) : (
                    <span className="line-clamp-1">{log.content || ''}</span>
                  )}
                </div>
              )}

              {isSystem && creditAmount && (
                <div className="text-xs font-bold mt-1 leading-snug">
                  <span className="text-clay-green-ink font-extrabold">{creditSymbol}{creditAmount}</span>
                  <span className="ml-1.5 text-clay-faint/60">额度</span>
                </div>
              )}

              {(isManage || isRefund || (isSystem && !creditAmount)) && log.content && (
                <div className="text-xs font-bold mt-1 leading-snug text-clay-faint line-clamp-2 break-all">
                  {log.content}
                </div>
              )}
            </div>

            {/* Right column: chip + amount */}
            <div className="flex flex-col items-end gap-1.5 shrink-0">
              {isConsume ? (
                <span
                  className={`text-[10px] font-extrabold px-2 py-0.5 rounded-clay-pill ${
                    log.is_stream
                      ? 'bg-clay-blue-100 text-clay-blue-ink shadow-clay-sm'
                      : 'bg-clay-bg shadow-clay-inset text-clay-faint'
                  }`}
                >
                  {log.is_stream ? '流式' : '非流'}
                </span>
              ) : (
                <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-clay-pill shadow-clay-sm ${meta.bg} ${meta.text}`}>
                  {meta.label}
                </span>
              )}
              {/* Consume / refund amount from quota field */}
              {(isConsume || isRefund) && quotaText && (
                <span className={`text-base font-black tabular-nums whitespace-nowrap ${quotaCls}`}>{quotaText}</span>
              )}
              {/* Topup / system amount from parsed content */}
              {(isTopup || isSystem) && creditAmount && (
                <span className="text-base font-black tabular-nums whitespace-nowrap text-clay-green-ink">
                  {creditSymbol}{creditAmount}
                </span>
              )}
            </div>
          </div>

          {/* Error message — pure red text, no凹槽 framing */}
          {isError && log.content && (
            <div className="mt-2 text-xs font-bold text-clay-pink-400 leading-relaxed break-all line-clamp-3">
              {log.content}
            </div>
          )}

          {/* Meta line: time / 入 / 出 / 首字 / 总 — pushed to bottom for uniform height */}
          <div className="mt-auto pt-2.5 border-t border-dashed border-clay-faint/15 flex items-center flex-wrap gap-x-3 gap-y-1 text-[11px] font-bold text-clay-faint">
              <span className="inline-flex items-center gap-1">
                <Clock className="w-3 h-3 text-clay-faint/60" strokeWidth={2.5} />
                <span className="tabular-nums font-black text-clay-ink/80">{fmtTs(log.created_at)}</span>
              </span>
              {isConsume && log.prompt_tokens ? (
                <span className="inline-flex items-center gap-1">
                  <ArrowDown className="w-3 h-3 text-clay-faint/60" strokeWidth={2.5} />
                  入<b className="text-clay-ink/80 font-black ml-0.5 tabular-nums">{fmtTokens(log.prompt_tokens)}</b>
                </span>
              ) : null}
              {isConsume && log.completion_tokens ? (
                <span className="inline-flex items-center gap-1">
                  <ArrowUp className="w-3 h-3 text-clay-faint/60" strokeWidth={2.5} />
                  出<b className="text-clay-ink/80 font-black ml-0.5 tabular-nums">{fmtTokens(log.completion_tokens)}</b>
                </span>
              ) : null}
              {isConsume && hasCache && cache.read > 0 ? (
                <span className="inline-flex items-center gap-1 text-clay-green-ink">
                  缓读<b className="font-black ml-0.5 tabular-nums">{fmtTokens(cache.read)}</b>
                </span>
              ) : null}
              {isConsume && hasCache && cache.write > 0 ? (
                <span className="inline-flex items-center gap-1 text-clay-yellow-ink">
                  缓写<b className="font-black ml-0.5 tabular-nums">{fmtTokens(cache.write)}</b>
                </span>
              ) : null}
              {isConsume && frtText ? (
                <span className="inline-flex items-center gap-1">
                  <Zap className="w-3 h-3 text-clay-faint/60" strokeWidth={2.5} />
                  首字<b className="text-clay-ink/80 font-black ml-0.5 tabular-nums">{frtText}</b>
                </span>
              ) : null}
              {isConsume && log.use_time ? (
                <span className="inline-flex items-center gap-1">
                  <Timer className="w-3 h-3 text-clay-faint/60" strokeWidth={2.5} />
                  总<b className="text-clay-ink/80 font-black ml-0.5 tabular-nums">{fmtUseTime(log.use_time)}</b>
                </span>
              ) : null}
              {isError && log.use_time ? (
                <span className="inline-flex items-center gap-1">
                  <Timer className="w-3 h-3 text-clay-faint/60" strokeWidth={2.5} />
                  <b className="text-clay-ink/80 font-black tabular-nums">{fmtUseTime(log.use_time)}</b>
                </span>
              ) : null}
            </div>
        </div>
      </div>
    </div>
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
  const [viewMode, setViewMode] = useState(() => {
    try { return localStorage.getItem('logs_view_mode') || 'card' } catch { return 'card' }
  })
  useEffect(() => {
    try { localStorage.setItem('logs_view_mode', viewMode) } catch (_) {}
  }, [viewMode])
  const requestSeq = useRef(0)

  const [filter, setFilter] = useState(() => defaultLogFilter())
  const [appliedFilter, setAppliedFilter] = useState(() => defaultLogFilter())

  const [pageSize, setPageSizeState] = useState(() => {
    if (typeof window === 'undefined') return 20
    const v = Number(window.localStorage?.getItem('uiweb.logs.pageSize'))
    return [10, 20, 50, 100].includes(v) ? v : 20
  })
  const setPageSize = useCallback((v) => {
    const n = Number(v)
    if (![10, 20, 50, 100].includes(n)) return
    setPageSizeState(n)
    try { window.localStorage?.setItem('uiweb.logs.pageSize', String(n)) } catch (_) {}
  }, [])

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
  }, [appliedFilter, toast, pageSize])

  useEffect(() => { load(page) }, [page, load])

  // When pageSize changes, jump back to page 1 (also auto-reloads via the effect above)
  useEffect(() => { setPage(1) }, [pageSize])

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

  useEffect(() => {
    if (!showFilter || typeof document === 'undefined') return undefined
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    document.body.classList.add('log-filter-dialog-open')
    return () => {
      document.body.style.overflow = previousOverflow
      document.body.classList.remove('log-filter-dialog-open')
    }
  }, [showFilter])

  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  const hasActiveFilter = hasNonDefaultLogFilter(appliedFilter)
  const refreshing = loading || todayLoading
  const refundRecordCount = Math.max(refundAppealsTotal, refundAppeals.length)
  const hasRefundRecords = refundRecordCount > 0 || (refundSummary?.pending_count ?? 0) > 0
  const filterDialogClassName = isMobile
    ? 'clay-scrollbar-none relative w-full max-w-[360px] max-h-[calc(100dvh-1.5rem)] overflow-y-auto rounded-[30px] bg-clay-bg p-4 shadow-clay border-2 border-white/30'
    : 'relative w-full max-w-5xl overflow-visible rounded-[32px] bg-clay-bg p-7 shadow-clay border-2 border-white/30'

  return (
    <ClayConsoleShell
      title="调用日志"
      subtitle="查看 API 调用记录与消费明细"
      actions={
        <div className="flex items-center gap-2">
          {!isMobile && (
            <div className="inline-flex gap-1 p-1 rounded-clay-pill bg-clay-bg shadow-clay-inset" role="tablist" aria-label="视图切换">
              <button
                type="button"
                onClick={() => setViewMode('list')}
                className={`px-3 h-8 rounded-clay-pill text-xs font-extrabold inline-flex items-center gap-1 transition-all ${
                  viewMode === 'list' ? 'bg-clay-bg text-clay-ink shadow-clay' : 'text-clay-faint'
                }`}
                aria-pressed={viewMode === 'list'}
                title="单行列表"
              >
                <Rows className="w-3.5 h-3.5" />
                列表
              </button>
              <button
                type="button"
                onClick={() => setViewMode('card')}
                className={`px-3 h-8 rounded-clay-pill text-xs font-extrabold inline-flex items-center gap-1 transition-all ${
                  viewMode === 'card' ? 'bg-clay-bg text-clay-ink shadow-clay' : 'text-clay-faint'
                }`}
                aria-pressed={viewMode === 'card'}
                title="卡片网格"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                卡片
              </button>
            </div>
          )}
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

      {/* Filter Dialog */}
      {showFilter && (
        <div
          className="clay-scrollbar-none fixed inset-0 z-[90] flex items-start justify-center overflow-y-auto bg-clay-bg/55 px-4 py-5 backdrop-blur-sm md:items-start md:px-6 md:pb-10 md:pt-[12vh]"
          role="dialog"
          aria-modal="true"
          aria-label="筛选日志"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setShowFilter(false)
          }}
        >
          <div className={filterDialogClassName} onMouseDown={(event) => event.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between gap-3 md:mb-6">
              <div className="flex min-w-0 items-center gap-2">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-clay-blue-50 shadow-clay">
                  <Filter className="h-4 w-4 text-clay-blue-ink" />
                </div>
                <div className="min-w-0 text-lg font-black text-clay-ink">筛选日志</div>
              </div>
              <button
                type="button"
                aria-label="关闭筛选"
                onClick={() => setShowFilter(false)}
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-clay-bg text-clay-faint shadow-clay transition-all hover:text-clay-ink active:scale-95 active:shadow-clay-active"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-3 md:gap-5">
              <div className="mb-3 md:mb-0">
                <label className="block ml-4 mb-2 font-bold text-sm text-clay-ink">类型</label>
                <ClaySelect
                  value={filter.type}
                  onChange={(v) => setFilter((current) => ({ ...current, type: v }))}
                  options={TYPE_OPTIONS}
                  className="[&>button]:!px-5 [&>button]:!py-3 md:[&>button]:!px-6 md:[&>button]:!py-3.5"
                />
              </div>
              <ClayField
                label="模型"
                className="!mb-3 md:!mb-0"
                inputClassName="!px-5 !py-3 md:!px-6 md:!py-3.5"
                value={filter.model_name}
                onChange={(e) => setFilter((current) => ({ ...current, model_name: e.target.value }))}
                placeholder="如 gpt-4o"
              />
              <ClayField
                label="令牌名称"
                className="!mb-3 md:!mb-0"
                inputClassName="!px-5 !py-3 md:!px-6 md:!py-3.5"
                value={filter.token_name}
                onChange={(e) => setFilter((current) => ({ ...current, token_name: e.target.value }))}
                placeholder="令牌名称"
              />
            </div>
            <div className="mt-1 grid grid-cols-1 gap-3 md:mt-5 md:grid-cols-2 md:gap-5">
              <ClayDateTimeField
                label="开始时间"
                value={filter.start_timestamp}
                onChange={(value) => setFilter((current) => ({ ...current, start_timestamp: value }))}
              />
              <ClayDateTimeField
                label="结束时间"
                value={filter.end_timestamp}
                onChange={(value) => setFilter((current) => ({ ...current, end_timestamp: value }))}
                align="right"
              />
            </div>
            <div className="mt-4 flex flex-col gap-2.5 md:mt-6 md:flex-row md:justify-end md:gap-3">
              <ClayButton variant="primary" onClick={onApply} className="!py-3 md:!h-11 md:!w-40 md:!py-0">
                <Search className="w-4 h-4" /> 应用筛选
              </ClayButton>
              <ClayButton variant="ghost" onClick={onReset} className="!py-3 md:!h-11 md:!w-28 md:!py-0">重置</ClayButton>
            </div>
          </div>
        </div>
      )}

      {/* Unified card grid — column count depends on view mode (list = 1 col wide rows, card = 2-col grid) */}
      <div className={`grid ${isMobile || viewMode === 'list' ? 'grid-cols-1' : 'grid-cols-1 md:grid-cols-2'} gap-3`}>
        {loading && (
          <ClayCard className="!py-12 text-center col-span-full">
            <div className="flex flex-col items-center gap-3">
              <RefreshCw className="w-8 h-8 text-clay-faint animate-spin" />
              <span className="text-clay-faint font-bold">加载中…</span>
            </div>
          </ClayCard>
        )}
        {!loading && logs.length === 0 && (
          <ClayCard className="!py-12 text-center col-span-full">
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

      {/* Pagination */}
      <div className="flex flex-wrap items-center justify-between gap-3 mt-6">
        <div className="flex items-center gap-3 text-sm text-clay-faint font-bold">
          <span>共 {total} 条记录</span>
          <div className="inline-flex items-center gap-1.5">
            <span className="text-xs">每页</span>
            <div className="inline-flex items-center gap-0.5 p-0.5 rounded-clay-pill bg-clay-bg shadow-clay-inset-sm">
              {[10, 20, 50, 100].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setPageSize(n)}
                  className={`min-w-[36px] px-2.5 py-1 rounded-clay-pill text-xs font-black tabular-nums transition-all duration-200 ease-clay ${
                    pageSize === n
                      ? 'bg-clay-surface text-clay-ink shadow-clay-sm'
                      : 'text-clay-faint hover:text-clay-ink'
                  }`}
                  aria-pressed={pageSize === n}
                >
                  {n}
                </button>
              ))}
            </div>
            <span className="text-xs">条</span>
          </div>
        </div>
        {totalPages > 1 && (
          <div className="flex items-center gap-3">
            <ClayButton variant="ghost" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
              <ChevronLeft className="w-4 h-4" />
            </ClayButton>
            <span className="text-sm font-extrabold bg-clay-bg shadow-clay-inset-sm px-4 py-1.5 rounded-clay-pill whitespace-nowrap">
              {page} / {totalPages}
            </span>
            <ClayButton variant="ghost" size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
              <ChevronRight className="w-4 h-4" />
            </ClayButton>
          </div>
        )}
      </div>

      {/* Detail Modal */}
      <ClayModal open={!!detailLog} onClose={() => setDetailLog(null)} title="请求详情" size="lg">
        {detailLog && (
          <LogDetailContent
            log={detailLog}
            onCopy={async (text) => {
              const ok = await copyTextToClipboard(text)
              toast(ok ? '错误信息已复制' : '复制失败', ok ? 'success' : 'error')
            }}
          />
        )}
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
