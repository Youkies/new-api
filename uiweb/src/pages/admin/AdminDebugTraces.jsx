import { useEffect, useMemo, useState } from 'react'
import { Activity, Bug, Copy, Download, Eye, Loader2, RefreshCw, Search, Terminal, Trash2, Wifi } from 'lucide-react'
import ClayAlert from '../../components/clay/ClayAlert.jsx'
import ClayButton from '../../components/clay/ClayButton.jsx'
import ClayCard from '../../components/clay/ClayCard.jsx'
import ClayInput from '../../components/clay/ClayInput.jsx'
import ClayModal from '../../components/clay/ClayModal.jsx'
import ClaySelect from '../../components/clay/ClaySelect.jsx'
import ClayAdminShell from '../../components/layout/ClayAdminShell.jsx'
import { useToast } from '../../context/ToastContext.jsx'
import { copyTextToClipboard } from '../../utils/clipboard.js'
import { deleteDebugTrace, downloadDebugTraceLog, getDebugTrace, listDebugTraces } from '../../services/debugTraces.js'

const statusOptions = [
  { value: '', label: '全部状态' },
  { value: 'success', label: '成功' },
  { value: 'error', label: '错误' },
  { value: 'client_canceled', label: '客户端取消' },
]

const statusMeta = {
  success: { label: '成功', cls: 'bg-clay-green-100 text-[#3d6b4f]' },
  error: { label: '错误', cls: 'bg-clay-pink-100 text-[#8a4860]' },
  client_canceled: { label: '客户端取消', cls: 'bg-clay-yellow-100 text-[#8a6a32]' },
}

function formatTime(ts) {
  if (!ts) return '-'
  return new Date(ts * 1000).toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

function getItems(res) {
  return res?.data?.items ?? res?.data ?? []
}

function getTotal(res) {
  return res?.data?.total ?? 0
}

function pretty(value) {
  if (!value) return ''
  try {
    return JSON.stringify(JSON.parse(value), null, 2)
  } catch (_) {
    return String(value)
  }
}

export default function AdminDebugTraces() {
  const toast = useToast()
  const [items, setItems] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [status, setStatus] = useState('')
  const [keyword, setKeyword] = useState('')
  const [requestId, setRequestId] = useState('')
  const [detail, setDetail] = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const connectivityEndpoint = useMemo(() => {
    if (typeof window === 'undefined') return '/v1/debug/connectivity'
    return `${window.location.origin}/v1/debug/connectivity`
  }, [])
  const connectivityCommand = useMemo(() => {
    const payload = JSON.stringify({ probe: 'client-connectivity', sent_at: new Date().toISOString() })
    return [
      `curl -sS -X POST "${connectivityEndpoint}"`,
      '  -H "Authorization: Bearer sk-你的调试Key"',
      '  -H "Content-Type: application/json"',
      `  -d '${payload}'`,
    ].join(' \\\n')
  }, [connectivityEndpoint])

  const fetchData = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await listDebugTraces({ p: 1, size: 80, status, keyword, requestId })
      if (res?.success === false) throw new Error(res.message || '调试记录加载失败')
      const list = getItems(res)
      setItems(Array.isArray(list) ? list : [])
      setTotal(getTotal(res))
    } catch (err) {
      setError(err?.response?.data?.message || err.message || '调试记录加载失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  const stats = useMemo(() => {
    let success = 0
    let failed = 0
    for (const item of items) {
      if (item.status === 'success') success += 1
      if (item.status === 'error') failed += 1
    }
    return { success, failed }
  }, [items])

  const openDetail = async (item) => {
    setDetailLoading(true)
    setDetail(item)
    try {
      const res = await getDebugTrace(item.id)
      if (res?.success === false) throw new Error(res.message || '详情加载失败')
      setDetail(res.data)
    } catch (err) {
      toast(err?.response?.data?.message || err.message || '详情加载失败', 'error')
    } finally {
      setDetailLoading(false)
    }
  }

  const remove = async (item) => {
    if (!item || !window.confirm(`确认删除调试记录 #${item.id} 吗？`)) return
    try {
      const res = await deleteDebugTrace(item.id)
      if (res?.success === false) throw new Error(res.message || '删除失败')
      toast('调试记录已删除', 'info')
      if (detail?.id === item.id) setDetail(null)
      await fetchData()
    } catch (err) {
      toast(err?.response?.data?.message || err.message || '删除失败', 'error')
    }
  }

  const copyRequestId = async (id) => {
    if (!id) return
    try {
      await copyTextToClipboard(id)
      toast('Request ID 已复制')
    } catch (_) {
      toast('复制失败，请手动复制', 'error')
    }
  }

  const downloadLog = async (item) => {
    if (!item?.id) return
    try {
      const data = await downloadDebugTraceLog(item.id)
      const blob = data instanceof Blob
        ? data
        : new Blob([typeof data === 'string' ? data : JSON.stringify(data, null, 2)], { type: 'text/plain;charset=utf-8' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `debug-trace-${item.request_id || item.id}.log`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch (err) {
      toast(err?.response?.data?.message || err.message || '日志下载失败', 'error')
    }
  }

  const copyConnectivityCommand = async () => {
    try {
      await copyTextToClipboard(connectivityCommand)
      toast('连通性探测命令已复制')
    } catch (_) {
      toast('复制失败，请手动复制', 'error')
    }
  }

  const actions = (
    <ClayButton variant="ghost" onClick={fetchData} disabled={loading} className="!px-5">
      <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
      刷新
    </ClayButton>
  )

  return (
    <ClayAdminShell title="调试记录" subtitle="查看管理员调试 Key 捕获的请求、返回与错误信息。" actions={actions}>
      <div className="mb-5 grid gap-4 sm:grid-cols-3">
        <Stat label="当前列表" value={total || items.length} tone="blue" />
        <Stat label="成功" value={stats.success} tone="green" />
        <Stat label="错误" value={stats.failed} tone="pink" />
      </div>

      <ClayCard className="mb-5 !p-4 md:!p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-sm font-black text-clay-ink">
              <Wifi className="h-4 w-4 text-clay-blue-300" />
              连通性探测
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs font-bold text-clay-faint">
              <span className="rounded-clay-sm bg-clay-bg px-2 py-1 shadow-clay-inset">POST /v1/debug/connectivity</span>
              <span>返回 Request ID 后可在本页精确查询</span>
            </div>
          </div>
          <ClayButton type="button" variant="secondary" onClick={copyConnectivityCommand} className="!px-5">
            <Copy className="h-4 w-4" />
            复制 cURL
          </ClayButton>
        </div>
        <div className="mt-4 flex items-start gap-3 rounded-clay bg-[#16202d] p-4 text-[#e8f1ff] shadow-clay-inset">
          <Terminal className="mt-0.5 h-4 w-4 shrink-0 text-clay-blue-100" />
          <pre className="min-w-0 flex-1 overflow-auto whitespace-pre-wrap break-words text-xs leading-relaxed">{connectivityCommand}</pre>
        </div>
      </ClayCard>

      <ClayCard className="mb-5 !overflow-visible !p-4 md:!p-5">
        <div className="grid items-center gap-3 lg:grid-cols-[180px_1fr_1fr_auto]">
          <ClaySelect value={status} options={statusOptions} onChange={setStatus} />
          <div className="relative">
            <ClayInput
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') fetchData()
              }}
              placeholder="搜索用户、Key、模型或错误"
              className="!pl-12"
            />
            <Search className="absolute left-5 top-1/2 h-5 w-5 -translate-y-1/2 text-clay-faint" />
          </div>
          <ClayInput
            value={requestId}
            onChange={(e) => setRequestId(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') fetchData()
            }}
            placeholder="Request ID 精确查询"
          />
          <ClayButton variant="secondary" onClick={fetchData} className="!px-5">
            <Search className="h-4 w-4" />
            筛选
          </ClayButton>
        </div>
      </ClayCard>

      {error && (
        <ClayAlert tone="error" className="mb-5">
          {error}
        </ClayAlert>
      )}

      {loading ? (
        <div className="flex flex-col items-center gap-3 py-16 text-clay-faint">
          <Loader2 className="h-8 w-8 animate-spin" />
          <p className="font-semibold">加载调试记录中…</p>
        </div>
      ) : items.length === 0 ? (
        <ClayCard className="text-center !py-16">
          <Bug className="mx-auto mb-3 h-9 w-9 text-clay-faint" />
          <p className="font-bold text-clay-faint">暂无调试记录</p>
        </ClayCard>
      ) : (
        <ClayCard className="!p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-black/5 text-left text-clay-faint">
                <th className="px-5 py-3 font-bold">状态</th>
                <th className="px-5 py-3 font-bold">请求</th>
                <th className="px-5 py-3 font-bold">模型 / Key</th>
                <th className="px-5 py-3 font-bold">渠道</th>
                <th className="px-5 py-3 font-bold">时间</th>
                <th className="px-5 py-3 font-bold text-right">操作</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <TraceRow
                  key={item.id}
                  item={item}
                  onOpen={openDetail}
                  onDelete={remove}
                  onDownload={downloadLog}
                  onCopyRequestId={copyRequestId}
                />
              ))}
            </tbody>
          </table>
        </ClayCard>
      )}

      <TraceDetailModal
        trace={detail}
        loading={detailLoading}
        onClose={() => setDetail(null)}
        onDownload={downloadLog}
        onCopyRequestId={copyRequestId}
      />
    </ClayAdminShell>
  )
}

function Stat({ label, value, tone }) {
  const toneCls = {
    blue: 'from-clay-blue-50 to-clay-bg text-clay-blue-300',
    green: 'from-clay-green-100 to-clay-bg text-[#3d6b4f]',
    pink: 'from-clay-pink-100 to-clay-bg text-[#8a4860]',
  }[tone] || 'from-clay-bg to-clay-bg text-clay-ink'

  return (
    <ClayCard className={`!p-5 bg-gradient-to-br ${toneCls}`}>
      <div className="text-sm font-black opacity-75">{label}</div>
      <div className="mt-2 text-3xl font-black text-clay-ink">{value}</div>
    </ClayCard>
  )
}

function TraceRow({ item, onOpen, onDelete, onDownload, onCopyRequestId }) {
  const meta = statusMeta[item.status] || statusMeta.error
  return (
    <tr className="border-b border-black/5 last:border-0 hover:bg-white/30 transition-colors">
      <td className="px-5 py-3">
        <span className={`rounded-clay-pill px-3 py-1 text-xs font-black ${meta.cls}`}>{meta.label}</span>
        <div className="mt-1 text-xs font-bold text-clay-faint">HTTP {item.http_status || '-'}</div>
      </td>
      <td className="px-5 py-3">
        <div className="font-black">{item.request_method || 'POST'} {item.request_path || '-'}</div>
        <button
          type="button"
          onClick={() => onCopyRequestId(item.request_id)}
          className="mt-1 max-w-[260px] truncate text-left text-xs font-bold text-clay-faint hover:text-clay-pink-400"
          title="复制 Request ID"
        >
          {item.request_id || '无 Request ID'}
        </button>
      </td>
      <td className="px-5 py-3">
        <div className="font-bold">{item.model_name || '-'}</div>
        <div className="text-xs text-clay-faint">{item.token_name || `Token #${item.token_id || '-'}`}</div>
      </td>
      <td className="px-5 py-3">
        <div className="font-bold">{item.channel_name || `#${item.channel_id || '-'}`}</div>
        <div className="text-xs text-clay-faint">{item.use_channel || '-'}</div>
      </td>
      <td className="px-5 py-3">
        <div className="font-bold">{formatTime(item.created_at)}</div>
        <div className="text-xs text-clay-faint">{item.use_time || 0} ms</div>
      </td>
      <td className="px-5 py-3">
        <div className="flex justify-end gap-2">
          <button type="button" onClick={() => onOpen(item)} className="p-2 rounded-clay-sm hover:bg-white/40" title="查看详情">
            <Eye className="h-4 w-4 text-clay-blue-300" />
          </button>
          <button type="button" onClick={() => onDownload(item)} className="p-2 rounded-clay-sm hover:bg-white/40" title="下载日志">
            <Download className="h-4 w-4 text-clay-faint" />
          </button>
          <button type="button" onClick={() => onDelete(item)} className="p-2 rounded-clay-sm hover:bg-clay-pink-100/40" title="删除">
            <Trash2 className="h-4 w-4 text-clay-pink-400" />
          </button>
        </div>
      </td>
    </tr>
  )
}

function TraceDetailModal({ trace, loading, onClose, onDownload, onCopyRequestId }) {
  const [tab, setTab] = useState('request')
  if (!trace) return null
  const tabs = [
    { key: 'request', label: '原始请求' },
    { key: 'upstream', label: '上游请求' },
    { key: 'response', label: '返回' },
    { key: 'error', label: '错误' },
    { key: 'meta', label: '元信息' },
  ]
  return (
    <ClayModal open={Boolean(trace)} onClose={onClose} title={`调试记录 #${trace.id}`} size="xl">
      {loading ? (
        <div className="flex items-center justify-center gap-3 py-16 text-clay-faint">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span className="font-bold">加载详情中…</span>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid gap-3 md:grid-cols-3">
            <Info label="Request ID" value={trace.request_id || '-'} action={(
              <button type="button" onClick={() => onCopyRequestId(trace.request_id)} className="p-1 rounded-clay-sm hover:bg-white/40">
                <Copy className="h-3.5 w-3.5" />
              </button>
            )} />
            <Info label="模型" value={trace.model_name || '-'} />
            <Info label="状态" value={`${trace.status || '-'} / HTTP ${trace.http_status || '-'}`} />
          </div>
          <div className="flex justify-end">
            <ClayButton type="button" variant="secondary" onClick={() => onDownload(trace)} className="!px-5">
              <Download className="h-4 w-4" />
              下载日志
            </ClayButton>
          </div>
          <div className="flex flex-wrap gap-2">
            {tabs.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => setTab(item.key)}
                className={`rounded-clay-pill px-4 py-2 text-sm font-black transition ${
                  tab === item.key
                    ? 'bg-clay-pink-100 text-[#8a4860] shadow-clay'
                    : 'bg-clay-bg text-clay-faint shadow-clay-inset hover:text-clay-ink'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
          {tab === 'request' && (
            <CodeBlocks blocks={[
              ['Headers', trace.request_headers],
              [`Body${trace.request_body_truncated ? '（已截断）' : ''}`, trace.request_body],
            ]} />
          )}
          {tab === 'upstream' && (
            <CodeBlocks blocks={[
              ['URL', trace.upstream_url],
              ['Headers', trace.upstream_headers],
              [`Body${trace.upstream_body_truncated ? '（已截断）' : ''}`, trace.upstream_body],
            ]} />
          )}
          {tab === 'response' && (
            <CodeBlocks blocks={[
              ['Headers', trace.response_headers],
              [`Body${trace.response_body_truncated ? '（已截断）' : ''}`, trace.response_body],
            ]} />
          )}
          {tab === 'error' && (
            <CodeBlocks blocks={[
              ['Error Type', trace.error_type],
              ['Error Code', trace.error_code],
              ['Message', trace.error_message],
            ]} />
          )}
          {tab === 'meta' && (
            <CodeBlocks blocks={[
              ['Admin Info', trace.admin_info],
              ['Use Channel', trace.use_channel],
              ['Format', `${trace.relay_format || '-'} -> ${trace.final_relay_format || '-'}`],
            ]} />
          )}
        </div>
      )}
    </ClayModal>
  )
}

function Info({ label, value, action }) {
  return (
    <div className="rounded-clay bg-clay-bg px-4 py-3 shadow-clay-inset">
      <div className="text-xs font-black text-clay-faint">{label}</div>
      <div className="mt-1 flex items-center gap-2 text-sm font-black">
        <span className="min-w-0 flex-1 truncate">{value}</span>
        {action}
      </div>
    </div>
  )
}

function CodeBlocks({ blocks }) {
  return (
    <div className="space-y-4">
      {blocks.map(([label, value]) => (
        <div key={label}>
          <div className="mb-2 flex items-center gap-2 text-sm font-black">
            <Activity className="h-4 w-4 text-clay-pink-400" />
            {label}
          </div>
          <pre className="max-h-[360px] overflow-auto rounded-clay bg-[#16202d] p-4 text-xs leading-relaxed text-[#e8f1ff] shadow-clay-inset">
            {pretty(value) || '无'}
          </pre>
        </div>
      ))}
    </div>
  )
}
