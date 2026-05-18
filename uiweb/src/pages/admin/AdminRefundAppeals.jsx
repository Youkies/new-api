import { useEffect, useMemo, useState } from 'react'
import {
  CheckCircle2,
  Clock,
  Eye,
  Loader2,
  RefreshCw,
  Search,
  ShieldCheck,
  XCircle,
} from 'lucide-react'
import ClayAlert from '../../components/clay/ClayAlert.jsx'
import ClayButton from '../../components/clay/ClayButton.jsx'
import ClayCard from '../../components/clay/ClayCard.jsx'
import ClayInput from '../../components/clay/ClayInput.jsx'
import ClayModal from '../../components/clay/ClayModal.jsx'
import ClaySelect from '../../components/clay/ClaySelect.jsx'
import ClayAdminShell from '../../components/layout/ClayAdminShell.jsx'
import { useToast } from '../../context/ToastContext.jsx'
import { quotaToDisplay } from '../../utils/quota.js'
import {
  adminApproveAllRefundAppeals,
  adminApproveRefundAppeal,
  adminGetRefundAppeal,
  adminListRefundAppeals,
  adminRejectRefundAppeal,
} from '../../services/refundAppeals.js'

const statusOptions = [
  { value: '', label: '全部状态' },
  { value: 'pending', label: '待审核' },
  { value: 'approved', label: '已通过' },
  { value: 'rejected', label: '已驳回' },
]

const statusMeta = {
  pending: { label: '待审核', cls: 'bg-clay-yellow-100 text-clay-yellow-ink', icon: Clock },
  approved: { label: '已通过', cls: 'bg-clay-green-100 text-clay-green-ink', icon: CheckCircle2 },
  rejected: { label: '已驳回', cls: 'bg-clay-pink-100 text-clay-pink-ink', icon: XCircle },
}

function formatTime(ts) {
  if (!ts) return '-'
  return new Date(ts * 1000).toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function getItems(res) {
  return res?.data?.items ?? res?.data ?? []
}

function getTotal(res) {
  return res?.data?.total ?? 0
}

export default function AdminRefundAppeals() {
  const toast = useToast()
  const [items, setItems] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [status, setStatus] = useState('pending')
  const [keyword, setKeyword] = useState('')
  const [detailOpen, setDetailOpen] = useState(false)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detail, setDetail] = useState(null)
  const [reviewNote, setReviewNote] = useState('')
  const [reviewing, setReviewing] = useState(false)
  const [approvingAll, setApprovingAll] = useState(false)

  const fetchData = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await adminListRefundAppeals({ p: 1, size: 50, status, keyword })
      if (res?.success === false) throw new Error(res.message || '申诉加载失败')
      const list = getItems(res)
      setItems(Array.isArray(list) ? list : [])
      setTotal(getTotal(res))
    } catch (err) {
      setError(err?.response?.data?.message || err.message || '申诉加载失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  const stats = useMemo(() => {
    let pending = 0
    let approved = 0
    let rejected = 0
    for (const item of items) {
      if (item.status === 'pending') pending++
      if (item.status === 'approved') approved++
      if (item.status === 'rejected') rejected++
    }
    return { pending, approved, rejected }
  }, [items])

  const openDetail = async (item) => {
    setDetailOpen(true)
    setDetail(null)
    setReviewNote('')
    setDetailLoading(true)
    try {
      const res = await adminGetRefundAppeal(item.id)
      if (res?.success === false) throw new Error(res.message || '详情加载失败')
      setDetail(res?.data ?? null)
    } catch (err) {
      toast(err?.response?.data?.message || err.message || '详情加载失败', 'error')
    } finally {
      setDetailLoading(false)
    }
  }

  const handleReview = async (action) => {
    const appeal = detail?.appeal
    if (!appeal || reviewing) return
    if (action === 'reject' && !reviewNote.trim()) {
      toast('驳回时需要填写原因', 'warning')
      return
    }
    setReviewing(true)
    try {
      const payload = { review_note: reviewNote.trim() }
      const res =
        action === 'approve'
          ? await adminApproveRefundAppeal(appeal.id, payload)
          : await adminRejectRefundAppeal(appeal.id, payload)
      if (res?.success === false) throw new Error(res.message || '审核失败')
      toast(action === 'approve' ? '已通过并补偿余额' : '已驳回申诉', 'success')
      setDetailOpen(false)
      await fetchData()
    } catch (err) {
      toast(err?.response?.data?.message || err.message || '审核失败', 'error')
    } finally {
      setReviewing(false)
    }
  }

  const handleApproveAll = async () => {
    const note = window.prompt('将通过所有待审核空回申诉，并立即补偿余额。可填写统一审核备注：', '批量审核通过')
    if (note === null) return
    if (!window.confirm('确认一键通过所有待审核申诉吗？该操作会逐单补偿余额。')) return
    setApprovingAll(true)
    try {
      const res = await adminApproveAllRefundAppeals({ review_note: note.trim() })
      if (res?.success === false) throw new Error(res.message || '批量通过失败')
      const data = res?.data || {}
      toast(`已通过 ${data.approved || 0} 个申诉${data.failed ? `，失败 ${data.failed} 个` : ''}`, data.failed ? 'warning' : 'success')
      await fetchData()
    } catch (err) {
      toast(err?.response?.data?.message || err.message || '批量通过失败', 'error')
    } finally {
      setApprovingAll(false)
    }
  }

  const actions = (
    <>
      <ClayButton variant="ghost" onClick={fetchData} disabled={loading} className="!px-5">
        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        刷新
      </ClayButton>
      <ClayButton variant="secondary" onClick={handleApproveAll} disabled={approvingAll} className="!px-5">
        <CheckCircle2 className="w-4 h-4" />
        一键通过所有
      </ClayButton>
    </>
  )

  return (
    <ClayAdminShell
      title="空回申诉"
      subtitle="人工审核用户提交的 48 小时内疑似空回记录，通过后以管理日志形式补偿余额。"
      actions={actions}
    >
      <div className="grid sm:grid-cols-3 gap-4 mb-5">
        <Stat label="当前列表" value={total || items.length} tone="blue" />
        <Stat label="待审核" value={stats.pending} tone="yellow" />
        <Stat label="已处理" value={stats.approved + stats.rejected} tone="green" />
      </div>

      <ClayCard className="!p-4 md:!p-5 mb-5 !overflow-visible">
        <div className="grid md:grid-cols-[220px_1fr_auto] gap-3 items-center">
          <ClaySelect value={status} options={statusOptions} onChange={setStatus} />
          <div className="relative">
            <ClayInput
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') fetchData()
              }}
              placeholder="搜索用户名、用户 ID 或申诉单 ID"
              className="!pl-12"
            />
            <Search className="w-5 h-5 absolute left-5 top-1/2 -translate-y-1/2 text-clay-faint" />
          </div>
          <ClayButton variant="secondary" onClick={fetchData} className="!px-5">
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
          <p className="font-semibold">加载申诉中…</p>
        </div>
      ) : items.length === 0 ? (
        <ClayCard className="text-center !py-16">
          <ShieldCheck className="w-9 h-9 mx-auto mb-3 text-clay-faint" />
          <p className="font-bold text-clay-faint">暂无申诉</p>
        </ClayCard>
      ) : (
        <ClayCard className="!p-0 overflow-hidden">
          <div className="hidden lg:grid grid-cols-[110px_1fr_150px_150px_160px_120px] gap-4 px-6 py-4 text-xs font-black text-clay-faint uppercase border-b border-clay-line/10 bg-clay-bg/50">
            <span>状态</span>
            <span>用户</span>
            <span>记录数</span>
            <span>补偿额度</span>
            <span>提交时间</span>
            <span className="text-right">操作</span>
          </div>
          <div className="divide-y divide-black/5">
            {items.map((item) => (
              <AppealRow key={item.id} item={item} onDetail={openDetail} />
            ))}
          </div>
        </ClayCard>
      )}

      <ClayModal
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        title={detail?.appeal ? `申诉单 #${detail.appeal.id}` : '申诉详情'}
        size="xl"
        footer={
          detail?.appeal?.status === 'pending' ? (
            <>
              <ClayButton variant="ghost" onClick={() => handleReview('reject')} disabled={reviewing}>
                <XCircle className="w-4 h-4" />
                驳回
              </ClayButton>
              <ClayButton variant="secondary" onClick={() => handleReview('approve')} disabled={reviewing}>
                <CheckCircle2 className="w-4 h-4" />
                通过并补偿
              </ClayButton>
            </>
          ) : null
        }
      >
        {detailLoading ? (
          <div className="flex flex-col items-center gap-3 py-12 text-clay-faint">
            <Loader2 className="w-8 h-8 animate-spin" />
            <p className="font-semibold">加载详情中…</p>
          </div>
        ) : detail?.appeal ? (
          <AppealDetail
            appeal={detail.appeal}
            items={detail.items || []}
            reviewNote={reviewNote}
            setReviewNote={setReviewNote}
          />
        ) : (
          <p className="text-clay-faint font-bold">暂无详情</p>
        )}
      </ClayModal>
    </ClayAdminShell>
  )
}

function Stat({ label, value, tone }) {
  const cls = {
    blue: 'text-clay-blue-ink',
    yellow: 'text-clay-yellow-ink',
    green: 'text-clay-green-ink',
  }[tone]
  return (
    <ClayCard className="!p-5">
      <div className="text-xs font-black text-clay-faint uppercase mb-1">{label}</div>
      <div className={`text-3xl font-black tabular-nums ${cls}`}>{value}</div>
    </ClayCard>
  )
}

function StatusBadge({ status }) {
  const meta = statusMeta[status] ?? statusMeta.pending
  const Icon = meta.icon
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-clay-pill text-xs font-black shadow-clay-sm ${meta.cls}`}>
      <Icon className="w-3.5 h-3.5" />
      {meta.label}
    </span>
  )
}

function AppealRow({ item, onDetail }) {
  return (
    <div className="grid lg:grid-cols-[110px_1fr_150px_150px_160px_120px] gap-4 px-5 md:px-6 py-5 items-center">
      <div>
        <StatusBadge status={item.status} />
      </div>
      <div className="min-w-0">
        <div className="font-black truncate">{item.username || `用户 ${item.user_id}`}</div>
        <div className="text-xs font-semibold text-clay-faint mt-1">
          ID {item.user_id} · 申诉单 #{item.id}
        </div>
      </div>
      <div className="text-sm font-black tabular-nums">{item.total_items} 条</div>
      <div className="text-sm font-black text-clay-pink-ink">{quotaToDisplay(item.refund_quota || 0).text}</div>
      <div className="text-xs font-bold text-clay-faint">{formatTime(item.created_at)}</div>
      <div className="flex justify-start lg:justify-end">
        <button
          type="button"
          onClick={() => onDetail(item)}
          className="clay-icon-btn-lg"
          title="查看详情"
          aria-label="查看详情"
        >
          <Eye className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}

function AppealDetail({ appeal, items, reviewNote, setReviewNote }) {
  return (
    <div className="space-y-5">
      <div className="grid md:grid-cols-4 gap-3">
        <InfoCell label="状态" value={<StatusBadge status={appeal.status} />} />
        <InfoCell label="记录数" value={`${appeal.total_items} 条`} />
        <InfoCell label="补偿额度" value={quotaToDisplay(appeal.refund_quota || 0).text} tone="pink" />
        <InfoCell label="提交时间" value={formatTime(appeal.created_at)} />
      </div>

      <div className="rounded-clay bg-clay-bg shadow-clay-inset p-4">
        <div className="text-xs font-black text-clay-faint mb-2">用户说明</div>
        <div className="text-sm font-semibold text-clay-ink whitespace-pre-wrap break-words">
          {appeal.reason || '用户未填写补充说明'}
        </div>
      </div>

      {appeal.status === 'pending' ? (
        <label className="block">
          <span className="block text-sm font-extrabold text-clay-ink mb-2">审核备注 / 驳回原因</span>
          <textarea
            value={reviewNote}
            onChange={(e) => setReviewNote(e.target.value)}
            className="clay-input min-h-[110px] resize-y leading-7"
            placeholder="通过可留空；驳回时必须填写原因"
          />
        </label>
      ) : (
        <div className="rounded-clay bg-white/45 shadow-clay-inset p-4">
          <div className="text-xs font-black text-clay-faint mb-2">审核备注</div>
          <div className="text-sm font-semibold text-clay-ink whitespace-pre-wrap break-words">
            {appeal.review_note || '-'}
          </div>
        </div>
      )}

      <div>
        <div className="text-sm font-extrabold text-clay-ink mb-3">疑似空回明细</div>
        <div className="space-y-3 max-h-[360px] overflow-y-auto pr-1">
          {items.map((item) => (
            <div key={item.id} className="rounded-clay bg-white/45 shadow-clay-inset p-4">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
                <div className="font-mono text-xs font-black break-all">{item.model_name || '-'}</div>
                <div className="text-sm font-black text-clay-pink-ink">{quotaToDisplay(item.quota || 0).text}</div>
              </div>
              <div className="grid sm:grid-cols-3 gap-2 text-xs font-semibold text-clay-faint">
                <span>日志 #{item.log_id}</span>
                <span>输出 {item.completion_tokens || 0}</span>
                <span>{formatTime(item.log_created_at)}</span>
              </div>
              {(item.token_name || item.request_id) && (
                <div className="mt-2 text-xs text-clay-faint break-all">
                  {item.token_name && <span>令牌：{item.token_name}</span>}
                  {item.token_name && item.request_id && <span className="mx-2">·</span>}
                  {item.request_id && <span className="font-mono">Request ID：{item.request_id}</span>}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function InfoCell({ label, value, tone }) {
  const cls = tone === 'pink' ? 'text-clay-pink-ink' : 'text-clay-ink'
  return (
    <div className="rounded-clay bg-white/45 shadow-clay-inset p-4">
      <div className="text-[11px] font-black text-clay-faint mb-1">{label}</div>
      <div className={`font-black ${cls}`}>{value}</div>
    </div>
  )
}
