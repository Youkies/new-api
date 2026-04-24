import { useEffect, useState, useCallback } from 'react'
import {
  FileText, Search, ChevronLeft, ChevronRight, Filter,
  Clock, Zap, MessageSquare, ArrowDownUp,
} from 'lucide-react'
import ClayCard from '../components/clay/ClayCard.jsx'
import ClayButton from '../components/clay/ClayButton.jsx'
import ClayField from '../components/clay/ClayField.jsx'
import ClaySelect from '../components/clay/ClaySelect.jsx'
import ClayConsoleShell from '../components/layout/ClayConsoleShell.jsx'
import { useToast } from '../context/ToastContext.jsx'
import { quotaToDisplay } from '../utils/quota.js'
import { getUserLogs } from '../services/logs.js'

const TYPE_OPTIONS = [
  { value: '', label: '全部类型' },
  { value: '1', label: '充值' },
  { value: '2', label: '消费' },
  { value: '3', label: '管理' },
  { value: '4', label: '系统' },
  { value: '5', label: '错误' },
  { value: '6', label: '退款' },
]

const TYPE_CLS = {
  1: 'bg-emerald-100 text-emerald-700',
  2: 'bg-blue-100 text-blue-700',
  3: 'bg-purple-100 text-purple-700',
  4: 'bg-gray-200 text-gray-600',
  5: 'bg-red-100 text-red-600',
  6: 'bg-amber-100 text-amber-700',
}
const TYPE_LABEL = { 1: '充值', 2: '消费', 3: '管理', 4: '系统', 5: '错误', 6: '退款' }

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

function fmtUseTime(ms) {
  if (!ms) return '-'
  if (ms >= 1000) return `${(ms / 1000).toFixed(1)}s`
  return `${ms}ms`
}

export default function LogList() {
  const toast = useToast()
  const [logs, setLogs] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [loading, setLoading] = useState(false)
  const [showFilter, setShowFilter] = useState(false)

  const [filter, setFilter] = useState({
    type: '',
    model_name: '',
    token_name: '',
    start_timestamp: '',
    end_timestamp: '',
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

  const onApply = () => {
    setPage(1)
    load(1)
    setShowFilter(false)
  }

  const onReset = () => {
    setFilter({ type: '', model_name: '', token_name: '', start_timestamp: '', end_timestamp: '' })
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
      {/* Filter bar */}
      {showFilter && (
        <ClayCard className="mb-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <ClaySelect
              label="类型"
              value={filter.type}
              onChange={(v) => setFilter({ ...filter, type: v })}
              options={TYPE_OPTIONS}
            />
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
          <div className="flex gap-3 mt-4">
            <ClayButton variant="primary" onClick={onApply}>
              <Search className="w-4 h-4" /> 应用筛选
            </ClayButton>
            <ClayButton variant="ghost" onClick={onReset}>重置</ClayButton>
          </div>
        </ClayCard>
      )}

      {/* Table */}
      <ClayCard className="!p-0 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-black/5 text-left text-clay-faint">
              <th className="px-5 py-3 font-bold">时间</th>
              <th className="px-5 py-3 font-bold">类型</th>
              <th className="px-5 py-3 font-bold">模型</th>
              <th className="px-5 py-3 font-bold">令牌</th>
              <th className="px-5 py-3 font-bold text-right">Token 用量</th>
              <th className="px-5 py-3 font-bold text-right">额度</th>
              <th className="px-5 py-3 font-bold text-right">耗时</th>
              <th className="px-5 py-3 font-bold">详情</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={8} className="px-5 py-12 text-center text-clay-faint">加载中…</td></tr>
            )}
            {!loading && logs.length === 0 && (
              <tr><td colSpan={8} className="px-5 py-12 text-center text-clay-faint">暂无日志</td></tr>
            )}
            {!loading && logs.map((l) => {
              const tc = TYPE_CLS[l.type] ?? 'bg-gray-200 text-gray-600'
              const tl = TYPE_LABEL[l.type] ?? '未知'
              const isError = l.type === 5
              return (
                <tr key={l.id} className={`border-b border-black/5 last:border-0 hover:bg-white/30 transition-colors ${isError ? 'bg-red-50/30' : ''}`}>
                  <td className="px-5 py-3 whitespace-nowrap">
                    <div className="flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-clay-faint shrink-0" />
                      <span className="text-xs text-clay-faint">{fmtTs(l.created_at)}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${tc}`}>{tl}</span>
                  </td>
                  <td className="px-5 py-3">
                    {l.model_name ? (
                      <span className="font-mono text-xs font-bold bg-clay-bg shadow-clay-inset px-2 py-0.5 rounded-clay-sm">
                        {l.model_name}
                      </span>
                    ) : (
                      <span className="text-clay-faint text-xs">-</span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-xs text-clay-faint truncate max-w-[120px]">
                    {l.token_name || '-'}
                  </td>
                  <td className="px-5 py-3 text-right">
                    {(l.prompt_tokens || l.completion_tokens) ? (
                      <div className="flex items-center justify-end gap-2 text-xs font-mono">
                        <span className="text-clay-faint" title="输入">
                          <MessageSquare className="w-3 h-3 inline mr-0.5 -mt-0.5" />
                          {fmtTokens(l.prompt_tokens)}
                        </span>
                        <ArrowDownUp className="w-3 h-3 text-clay-faint" />
                        <span className="font-bold" title="输出">
                          {fmtTokens(l.completion_tokens)}
                        </span>
                      </div>
                    ) : (
                      <span className="text-clay-faint text-xs">-</span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-right">
                    {l.quota ? (
                      <span className={`text-xs font-bold ${l.quota > 0 ? 'text-blue-600' : l.quota < 0 ? 'text-emerald-600' : ''}`}>
                        {l.quota < 0 ? '+' : '-'}{quotaToDisplay(Math.abs(l.quota)).text}
                      </span>
                    ) : (
                      <span className="text-clay-faint text-xs">-</span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-right">
                    {l.use_time ? (
                      <div className="flex items-center justify-end gap-1">
                        <Zap className="w-3 h-3 text-clay-faint" />
                        <span className="text-xs text-clay-faint">{fmtUseTime(l.use_time)}</span>
                      </div>
                    ) : (
                      <span className="text-clay-faint text-xs">-</span>
                    )}
                  </td>
                  <td className="px-5 py-3">
                    {l.content ? (
                      <span className="text-xs text-clay-faint truncate max-w-[200px] block" title={l.content}>
                        {l.content}
                      </span>
                    ) : (
                      <span className="text-clay-faint text-xs">-</span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </ClayCard>

      {/* Summary + Pagination */}
      <div className="flex items-center justify-between mt-6">
        <span className="text-sm text-clay-faint">共 {total} 条记录</span>
        {totalPages > 1 && (
          <div className="flex items-center gap-3">
            <ClayButton variant="ghost" disabled={page <= 1} onClick={() => setPage(page - 1)}>
              <ChevronLeft className="w-4 h-4" />
            </ClayButton>
            <span className="text-sm font-bold">{page} / {totalPages}</span>
            <ClayButton variant="ghost" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
              <ChevronRight className="w-4 h-4" />
            </ClayButton>
          </div>
        )}
      </div>
    </ClayConsoleShell>
  )
}
