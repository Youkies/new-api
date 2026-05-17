import { useEffect, useMemo, useState } from 'react'
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Loader2,
  RefreshCw,
  RotateCcw,
  Search,
  TimerOff,
  Wallet,
  XCircle,
} from 'lucide-react'
import ClayAlert from '../../components/clay/ClayAlert.jsx'
import ClayButton from '../../components/clay/ClayButton.jsx'
import ClayCard from '../../components/clay/ClayCard.jsx'
import ClayInput from '../../components/clay/ClayInput.jsx'
import ClaySelect from '../../components/clay/ClaySelect.jsx'
import ClayAdminShell from '../../components/layout/ClayAdminShell.jsx'
import { useToast } from '../../context/ToastContext.jsx'
import {
  adminListKPayTopUps,
  adminReplayKPayTopUp,
} from '../../services/adminKpayTopups.js'

const PAGE_SIZE = 20

const statusOptions = [
  { value: 'all', label: '全部状态' },
  { value: 'pending', label: '待支付 / 待到账' },
  { value: 'success', label: '已到账' },
  { value: 'failed', label: '失败 / 取消' },
  { value: 'expired', label: '已过期' },
]

const statusMeta = {
  pending: { label: '待到账', cls: 'bg-clay-yellow-100 text-[#8a6a32]', icon: Clock },
  success: { label: '已到账', cls: 'bg-clay-green-100 text-[#3d6b4f]', icon: CheckCircle2 },
  failed: { label: '失败', cls: 'bg-clay-pink-100 text-[#8a4860]', icon: XCircle },
  expired: { label: '已过期', cls: 'bg-clay-pink-100 text-[#8a4860]', icon: TimerOff },
}

const methodLabel = {
  alipay: '支付宝',
  kpay_alipay: '支付宝',
  wechat: '微信支付',
  kpay_wechat: '微信支付',
}

function formatTime(ts) {
  if (!ts) return '-'
  return new Date(ts * 1000).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

function formatMoney(money) {
  if (money == null) return '-'
  const n = Number(money)
  if (!Number.isFinite(n)) return '-'
  return `¥${n.toFixed(2)}`
}

function getItems(res) {
  return res?.data?.items ?? res?.data ?? []
}

function getTotal(res) {
  return res?.data?.total ?? 0
}

export default function AdminKPayTopUps() {
  const toast = useToast()
  const [items, setItems] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [status, setStatus] = useState('all')
  const [keyword, setKeyword] = useState('')
  const [page, setPage] = useState(1)
  const [replayingId, setReplayingId] = useState(null)

  const fetchData = async (opts = {}) => {
    const nextPage = opts.page ?? page
    const nextStatus = opts.status ?? status
    const nextKeyword = opts.keyword ?? keyword
    setLoading(true)
    setError('')
    try {
      const res = await adminListKPayTopUps({
        p: nextPage,
        size: PAGE_SIZE,
        status: nextStatus === 'all' ? '' : nextStatus,
        keyword: nextKeyword.trim(),
      })
      if (res?.success === false) throw new Error(res.message || '加载失败')
      const list = getItems(res)
      setItems(Array.isArray(list) ? list : [])
      setTotal(getTotal(res))
    } catch (err) {
      setError(err?.response?.data?.message || err.message || '加载失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData({ page: 1, status, keyword: '' })
    setPage(1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status])

  const stats = useMemo(() => {
    let pending = 0
    let success = 0
    let failed = 0
    let expired = 0
    for (const item of items) {
      if (item.status === 'pending') pending++
      else if (item.status === 'success') success++
      else if (item.status === 'failed') failed++
      else if (item.status === 'expired') expired++
    }
    return { pending, success, failed, expired }
  }, [items])

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  const handleSearch = () => {
    setPage(1)
    fetchData({ page: 1 })
  }

  const handlePage = (next) => {
    if (next < 1 || next > totalPages || next === page) return
    setPage(next)
    fetchData({ page: next })
  }

  const handleReplay = async (item) => {
    if (!item?.trade_no || replayingId) return
    if (
      !window.confirm(
        `将向 KPay 查询订单 ${item.trade_no} 的真实状态，并按结果入账或同步终态。继续？`,
      )
    ) {
      return
    }
    setReplayingId(item.trade_no)
    try {
      const res = await adminReplayKPayTopUp(item.trade_no)
      if (res?.success === false) throw new Error(res.message || '查单失败')
      const data = res?.data || {}
      const local = data.local_status || '-'
      const provider = data.provider_status || '-'
      if (local === 'success') {
        toast(`订单已入账：${item.trade_no}`, 'success')
      } else if (data.changed) {
        toast(`已同步终态：${local}（KPay：${provider}）`, 'success')
      } else {
        toast(`订单仍为 ${local}（KPay：${provider || '未知'}）`, 'info')
      }
      await fetchData()
    } catch (err) {
      toast(err?.response?.data?.message || err.message || '查单失败', 'error')
    } finally {
      setReplayingId(null)
    }
  }

  const actions = (
    <ClayButton variant="ghost" onClick={() => fetchData()} disabled={loading} className="!px-5">
      <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
      刷新
    </ClayButton>
  )

  return (
    <ClayAdminShell
      title="KPay 充值到账"
      subtitle="查看全站 KPay 充值订单，并对回调失败/未到账的订单触发一次查单和入账。"
      actions={actions}
    >
      <div className="grid sm:grid-cols-4 gap-4 mb-5">
        <Stat label="本页总数" value={items.length} tone="blue" />
        <Stat label="待到账" value={stats.pending} tone="yellow" />
        <Stat label="已到账" value={stats.success} tone="green" />
        <Stat label="失败/过期" value={stats.failed + stats.expired} tone="pink" />
      </div>

      <ClayCard className="!p-4 md:!p-5 mb-5 !overflow-visible">
        <div className="grid md:grid-cols-[220px_1fr_auto] gap-3 items-center">
          <ClaySelect value={status} options={statusOptions} onChange={setStatus} />
          <div className="relative">
            <ClayInput
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSearch()
              }}
              placeholder="搜索本平台订单号或 KPay 平台订单号"
              className="!pl-12"
            />
            <Search className="w-5 h-5 absolute left-5 top-1/2 -translate-y-1/2 text-clay-faint" />
          </div>
          <ClayButton variant="secondary" onClick={handleSearch} className="!px-5">
            <Search className="w-4 h-4" />
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
          <Loader2 className="w-8 h-8 animate-spin" />
          <p className="font-semibold">加载充值订单中…</p>
        </div>
      ) : items.length === 0 ? (
        <ClayCard className="text-center !py-16">
          <Wallet className="w-9 h-9 mx-auto mb-3 text-clay-faint" />
          <p className="font-bold text-clay-faint">暂无符合条件的 KPay 订单</p>
        </ClayCard>
      ) : (
        <>
          <ClayCard className="!p-0 overflow-hidden">
            <div className="hidden lg:grid grid-cols-[110px_1fr_110px_120px_120px_170px_140px] gap-3 px-6 py-4 text-xs font-black text-clay-faint uppercase border-b border-black/5 bg-clay-bg/50">
              <span>状态</span>
              <span>本平台订单号</span>
              <span>用户</span>
              <span>金额</span>
              <span>支付方式</span>
              <span>创建时间</span>
              <span className="text-right">操作</span>
            </div>
            <div className="divide-y divide-black/5">
              {items.map((item) => (
                <TopUpRow
                  key={item.id}
                  item={item}
                  onReplay={handleReplay}
                  replaying={replayingId === item.trade_no}
                />
              ))}
            </div>
          </ClayCard>

          <div className="flex items-center justify-between flex-wrap gap-3 mt-5 text-sm font-bold text-clay-faint">
            <span>
              第 {page} / {totalPages} 页，共 {total} 条
            </span>
            <div className="flex gap-2">
              <ClayButton
                variant="ghost"
                onClick={() => handlePage(page - 1)}
                disabled={page <= 1 || loading}
                className="!px-4"
              >
                上一页
              </ClayButton>
              <ClayButton
                variant="ghost"
                onClick={() => handlePage(page + 1)}
                disabled={page >= totalPages || loading}
                className="!px-4"
              >
                下一页
              </ClayButton>
            </div>
          </div>
        </>
      )}
    </ClayAdminShell>
  )
}

function Stat({ label, value, tone }) {
  const cls = {
    blue: 'text-[#2c5582]',
    yellow: 'text-[#8a6a32]',
    green: 'text-[#3d6b4f]',
    pink: 'text-[#8a4860]',
  }[tone]
  return (
    <ClayCard className="!p-5">
      <div className="text-xs font-black text-clay-faint uppercase mb-1">{label}</div>
      <div className={`text-3xl font-black tabular-nums ${cls}`}>{value}</div>
    </ClayCard>
  )
}

function StatusBadge({ status }) {
  const meta = statusMeta[status] ?? {
    label: status || '未知',
    cls: 'bg-clay-bg text-clay-faint',
    icon: AlertCircle,
  }
  const Icon = meta.icon
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-clay-pill text-xs font-black ${meta.cls}`}
    >
      <Icon className="w-3.5 h-3.5" />
      {meta.label}
    </span>
  )
}

function TopUpRow({ item, onReplay, replaying }) {
  const canReplay = item.status !== 'success'
  const completeTime = item.complete_time
    ? formatTime(item.complete_time)
    : '-'
  return (
    <div className="grid lg:grid-cols-[110px_1fr_110px_120px_120px_170px_140px] gap-3 px-5 md:px-6 py-5 items-center">
      <div>
        <StatusBadge status={item.status} />
      </div>
      <div className="min-w-0">
        <div className="font-mono text-sm font-black break-all">{item.trade_no || '-'}</div>
        <div className="text-xs font-semibold text-clay-faint mt-1 break-all">
          KPay 单号：{item.provider_order_no || '-'}
        </div>
        <div className="text-[11px] font-semibold text-clay-faint mt-0.5">
          到账时间：{completeTime}
        </div>
      </div>
      <div className="text-sm font-black tabular-nums">用户 #{item.user_id}</div>
      <div className="text-sm font-black tabular-nums">{formatMoney(item.money)}</div>
      <div className="text-sm font-bold text-clay-ink">
        {methodLabel[item.payment_method] || item.payment_method || '-'}
      </div>
      <div className="text-xs font-bold text-clay-faint">{formatTime(item.create_time)}</div>
      <div className="flex justify-start lg:justify-end">
        <ClayButton
          variant="secondary"
          onClick={() => onReplay(item)}
          disabled={!canReplay || replaying}
          className="!px-4"
          title={canReplay ? '向 KPay 查单后按真实状态入账或同步终态' : '已到账，无需补查'}
        >
          {replaying ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
          {canReplay ? '查单补单' : '已到账'}
        </ClayButton>
      </div>
    </div>
  )
}
