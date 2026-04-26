import { useEffect, useState, useCallback, useSyncExternalStore } from 'react'
import {
  Search, ChevronLeft, ChevronRight, Filter,
  Clock, Zap,
  Activity, AlertCircle, RefreshCw, CreditCard, Settings, Terminal,
  RotateCcw, FileText, TrendingUp,
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

function todayStart() {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T00:00`
}

function nowLocal() {
  const d = new Date()
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function LogCard({ log, onClick }) {
  const meta = TYPE_META[log.type] ?? TYPE_META[4]
  const TypeIcon = meta.icon
  const isError = log.type === 5
  const isConsume = log.type === 2
  const isQuotaChange = log.type === 1 || log.type === 6
  const other = parseOther(log.other)
  const cache = getCacheTokens(other)
  const frt = other.frt
  const hasTokens = log.prompt_tokens || log.completion_tokens
  const hasCache = cache.read > 0 || cache.write > 0
  const quotaText = log.quota
    ? `${log.quota < 0 ? '+' : '-'}${quotaToDisplay(Math.abs(log.quota)).text}`
    : null
  const quotaCls = log.quota > 0 ? 'text-blue-600' : 'text-emerald-600'

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
      {!isConsume && !isQuotaChange && log.content && (
        <div className="mt-2 text-[11px] text-clay-faint line-clamp-2 break-all">{log.content}</div>
      )}
      {isQuotaChange && log.content && (
        <div className="mt-1 text-[11px] text-clay-faint truncate">{log.content}</div>
      )}
    </div>
  )
}

function LogRow({ log, onClick }) {
  const meta = TYPE_META[log.type] ?? TYPE_META[4]
  const TypeIcon = meta.icon
  const isError = log.type === 5
  const other = parseOther(log.other)
  const cache = getCacheTokens(other)
  const frt = other.frt
  const hasTokens = log.prompt_tokens || log.completion_tokens
  const hasCache = cache.read > 0 || cache.write > 0

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
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [showFilter, setShowFilter] = useState(false)
  const [detailLog, setDetailLog] = useState(null)

  const [filter, setFilter] = useState({
    type: '',
    model_name: '',
    token_name: '',
    start_timestamp: todayStart(),
    end_timestamp: nowLocal(),
  })

  const pageSize = 20

  const load = useCallback(async (p) => {
    setLoading(true)
    try {
      const params = { p, size: pageSize }
      if (filter.type) params.type = filter.type
      if (filter.model_name) params.model_name = filter.model_name
      if (filter.token_name) params.token_name = filter.token_name
      if (filter.start_timestamp) params.start_timestamp = Math.floor(new Date(filter.start_timestamp).getTime() / 1000)
      if (filter.end_timestamp) params.end_timestamp = Math.floor(new Date(filter.end_timestamp).getTime() / 1000)
      const res = await getUserLogs(params)
      const data = res?.data
      setLogs(data?.items ?? data ?? [])
      setTotal(data?.total ?? 0)
    } catch (e) {
      toast(e?.response?.data?.message ?? '加载失败', 'error')
    } finally {
      setLoading(false)
    }
  }, [filter, toast])

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

  const onApply = () => {
    setPage(1)
    load(1)
    setShowFilter(false)
  }

  const onReset = () => {
    setFilter({ type: '', model_name: '', token_name: '', start_timestamp: todayStart(), end_timestamp: nowLocal() })
    setPage(1)
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  const hasActiveFilter = filter.type || filter.model_name || filter.token_name || filter.start_timestamp || filter.end_timestamp

  return (
    <ClayConsoleShell
      title="调用日志"
      subtitle="查看 API 调用记录与消费明细"
      actions={
        <ClayButton variant={hasActiveFilter ? 'secondary' : 'ghost'} onClick={() => setShowFilter((v) => !v)}>
          <Filter className="w-4 h-4" /> 筛选{hasActiveFilter ? '（已设置）' : ''}
        </ClayButton>
      }
    >
      {/* Today consumption */}
      <ClayCard className="mb-6 !p-5 bg-gradient-to-br from-clay-pink-50 to-clay-pink-100">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-clay-pink-200 text-white shadow-clay flex items-center justify-center shrink-0">
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
          <ClayButton variant="ghost" onClick={loadTodayStat} disabled={todayLoading} aria-label="刷新">
            <RefreshCw className={`w-4 h-4 ${todayLoading ? 'animate-spin' : ''}`} />
          </ClayButton>
        </div>
      </ClayCard>

      {/* Filter Panel */}
      {showFilter && (
        <ClayCard className="mb-6 !p-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="mb-5">
              <label className="block ml-4 mb-2 font-bold text-sm text-clay-ink">类型</label>
              <ClaySelect
                value={filter.type}
                onChange={(v) => setFilter({ ...filter, type: v })}
                options={TYPE_OPTIONS}
              />
            </div>
            <ClayField
              label="模型"
              value={filter.model_name}
              onChange={(e) => setFilter({ ...filter, model_name: e.target.value })}
              placeholder="如 gpt-4o"
            />
            <ClayField
              label="令牌名称"
              value={filter.token_name}
              onChange={(e) => setFilter({ ...filter, token_name: e.target.value })}
              placeholder="令牌名称"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
            <ClayField
              label="开始时间"
              type="datetime-local"
              value={filter.start_timestamp}
              onChange={(e) => setFilter({ ...filter, start_timestamp: e.target.value })}
            />
            <ClayField
              label="结束时间"
              type="datetime-local"
              value={filter.end_timestamp}
              onChange={(e) => setFilter({ ...filter, end_timestamp: e.target.value })}
            />
          </div>
          <div className="flex gap-3 mt-5">
            <ClayButton variant="primary" onClick={onApply}>
              <Search className="w-4 h-4" /> 应用筛选
            </ClayButton>
            <ClayButton variant="ghost" onClick={onReset}>重置</ClayButton>
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
                <th className="px-4 py-3 font-extrabold">模型</th>
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
    </ClayConsoleShell>
  )
}
