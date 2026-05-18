import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Bell,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  CircleDollarSign,
  FileText,
  Loader2,
  Megaphone,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react'
import ClayAlert from '../components/clay/ClayAlert.jsx'
import ClayBadge from '../components/clay/ClayBadge.jsx'
import ClayButton from '../components/clay/ClayButton.jsx'
import ClayCard from '../components/clay/ClayCard.jsx'
import ClayInsetPanel from '../components/clay/ClayInsetPanel.jsx'
import ClayConsoleShell from '../components/layout/ClayConsoleShell.jsx'
import { useNotifications } from '../context/NotificationContext.jsx'
import {
  ackNotification,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '../services/notifications.js'

const categoryOptions = [
  { value: '', label: '全部', icon: Bell },
  { value: 'announcement', label: '公告', icon: Megaphone },
  { value: 'billing', label: '充值', icon: CircleDollarSign },
  { value: 'appeal', label: '申诉', icon: ShieldCheck },
]

const categoryMeta = {
  announcement: { label: '公告', tone: 'blue', icon: Megaphone },
  billing: { label: '充值', tone: 'green', icon: CircleDollarSign },
  appeal: { label: '申诉', tone: 'yellow', icon: ShieldCheck },
  system: { label: '系统', tone: 'inset', icon: Bell },
}

const levelAccent = {
  info: 'before:bg-clay-blue-200',
  success: 'before:bg-clay-green-300',
  warning: 'before:bg-clay-yellow-300',
  error: 'before:bg-clay-pink-300',
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

export default function Notifications() {
  const { refreshUnread } = useNotifications()
  const [items, setItems] = useState([])
  const [total, setTotal] = useState(0)
  const [category, setCategory] = useState('')
  const [unreadOnly, setUnreadOnly] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [actioning, setActioning] = useState('')
  const [expandedIds, setExpandedIds] = useState(() => new Set())

  const fetchData = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await listNotifications({ p: 1, size: 50, category, unread: unreadOnly })
      if (res?.success === false) throw new Error(res.message || '通知加载失败')
      const list = getItems(res)
      setItems(Array.isArray(list) ? list : [])
      setTotal(getTotal(res))
      refreshUnread()
    } catch (err) {
      setError(err?.response?.data?.message || err.message || '通知加载失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [category, unreadOnly])

  const unreadCount = useMemo(() => items.filter((item) => item.unread).length, [items])
  const ackCount = useMemo(() => items.filter((item) => item.require_ack && item.unread).length, [items])
  const listCount = total || items.length

  const toggleExpanded = (id) => {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  const handleRead = async (item) => {
    const key = `${item.id}:${item.require_ack ? 'ack' : 'read'}`
    setActioning(key)
    try {
      const res = item.require_ack ? await ackNotification(item.id) : await markNotificationRead(item.id)
      if (res?.success === false) throw new Error(res.message || '操作失败')
      await fetchData()
    } catch (err) {
      setError(err?.response?.data?.message || err.message || '操作失败')
    } finally {
      setActioning('')
    }
  }

  const handleReadAll = async () => {
    setActioning('all')
    try {
      const res = await markAllNotificationsRead()
      if (res?.success === false) throw new Error(res.message || '操作失败')
      await fetchData()
    } catch (err) {
      setError(err?.response?.data?.message || err.message || '操作失败')
    } finally {
      setActioning('')
    }
  }

  const actions = (
    <>
      <ClayButton
        variant="ghost"
        size="sm"
        onClick={fetchData}
        disabled={loading}
        className="!w-11 !h-11 !p-0 sm:!w-auto sm:!h-auto sm:!px-5 sm:!py-3"
        aria-label="刷新通知"
        title="刷新通知"
      >
        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        <span className="hidden sm:inline">刷新</span>
      </ClayButton>
      <ClayButton
        variant="secondary"
        size="sm"
        onClick={handleReadAll}
        disabled={actioning === 'all'}
        className="!w-11 !h-11 !p-0 sm:!w-auto sm:!h-auto sm:!px-5 sm:!py-3"
        aria-label="全部已读"
        title="全部已读"
      >
        <CheckCircle2 className="w-4 h-4" />
        <span className="hidden sm:inline">全部已读</span>
      </ClayButton>
    </>
  )

  return (
    <ClayConsoleShell
      title="通知"
      subtitle="公告、充值到账和空回申诉状态会汇总到这里；只有手动已读或确认才会清除红点。"
      actions={actions}
      compactHeader
      showMembershipBadge={false}
      showAssistantWidget={false}
    >
      <div className="-mx-5 md:mx-0 mb-3 overflow-x-auto px-5 md:px-0 pb-2 [scrollbar-width:none]">
        <div className="flex w-max min-w-full items-center gap-2">
          {categoryOptions.map((option) => {
            const Icon = option.icon
            const active = category === option.value
            return (
              <button
                key={option.value || 'all'}
                type="button"
                onClick={() => setCategory(option.value)}
                className={`inline-flex shrink-0 items-center gap-1.5 px-3 py-2 rounded-clay-pill text-xs sm:text-sm font-black transition-all duration-200 ease-clay ${
                  active
                    ? 'bg-clay-pink-100 text-clay-pink-ink shadow-clay-sm'
                    : 'bg-clay-bg text-clay-faint shadow-clay-inset-sm hover:text-clay-ink'
                }`}
              >
                <Icon className="w-4 h-4" />
                {option.label}
              </button>
            )
          })}
          <button
            type="button"
            onClick={() => setUnreadOnly((v) => !v)}
            className={`inline-flex shrink-0 items-center gap-1.5 px-3 py-2 rounded-clay-pill text-xs sm:text-sm font-black transition-all duration-200 ease-clay ${
              unreadOnly
                ? 'bg-clay-blue-100 text-clay-blue-ink shadow-clay-sm'
                : 'bg-clay-bg text-clay-faint shadow-clay-inset-sm hover:text-clay-ink'
            }`}
          >
            <Bell className="w-4 h-4" />
            未读
          </button>
        </div>
      </div>

      {error && (
        <ClayAlert tone="error" className="mb-5">
          {error}
        </ClayAlert>
      )}

      <div className="sm:hidden mb-4 rounded-clay-pill bg-clay-bg shadow-clay-inset-sm px-4 py-2.5 text-xs font-black text-clay-faint flex items-center gap-3 overflow-x-auto whitespace-nowrap">
        <span>
          当前 <strong className="text-clay-blue-ink tabular-nums">{listCount}</strong>
        </span>
        <span>
          未读 <strong className="text-clay-pink-ink tabular-nums">{unreadCount}</strong>
        </span>
        <span>
          确认 <strong className="text-clay-yellow-ink tabular-nums">{ackCount}</strong>
        </span>
      </div>

      <div className="hidden sm:grid sm:grid-cols-3 gap-4 mb-5">
        <Stat label="当前列表" value={listCount} tone="blue" />
        <Stat label="未读" value={unreadCount} tone="pink" />
        <Stat label="需要确认" value={ackCount} tone="yellow" />
      </div>

      {loading ? (
        <div className="flex flex-col items-center gap-3 py-10 md:py-16 text-clay-faint">
          <Loader2 className="w-8 h-8 animate-spin" />
          <p className="font-semibold">加载通知中…</p>
        </div>
      ) : items.length === 0 ? (
        <ClayCard className="text-center !py-10 md:!py-16">
          <Bell className="w-9 h-9 mx-auto mb-3 text-clay-faint" />
          <p className="font-bold text-clay-faint">暂无通知</p>
        </ClayCard>
      ) : (
        <div className="space-y-4">
          {items.map((item) => (
            <NotificationCard
              key={item.id}
              item={item}
              loading={actioning === `${item.id}:${item.require_ack ? 'ack' : 'read'}`}
              onRead={handleRead}
              expanded={expandedIds.has(item.id)}
              onToggleExpand={toggleExpanded}
            />
          ))}
        </div>
      )}
    </ClayConsoleShell>
  )
}

function Stat({ label, value, tone }) {
  const cls = {
    blue: 'text-clay-blue-ink',
    pink: 'text-clay-pink-ink',
    yellow: 'text-clay-yellow-ink',
  }[tone]
  return (
    <ClayCard className="!p-5">
      <div className="text-xs font-black text-clay-faint uppercase mb-1 tracking-wider">{label}</div>
      <div className={`text-3xl font-black tabular-nums ${cls}`}>{value}</div>
    </ClayCard>
  )
}

function NotificationCard({ item, loading, onRead, expanded, onToggleExpand }) {
  const meta = categoryMeta[item.category] ?? categoryMeta.system
  const Icon = meta.icon
  const accent = levelAccent[item.level] || levelAccent.info
  const hasContent = Boolean(String(item.content || '').trim())
  const canRead = !hasContent || expanded
  return (
    <ClayCard
      className={`!p-4 md:!p-6 relative overflow-hidden before:absolute before:left-0 before:top-0 before:bottom-0 before:w-1.5 ${accent} ${item.unread ? '' : 'opacity-80'}`}
    >
      <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-3 md:gap-4 pl-2 md:pl-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <ClayBadge tone={meta.tone} icon={<Icon />}>
              {meta.label}
            </ClayBadge>
            {item.unread && <ClayBadge tone="pink">未读</ClayBadge>}
            {item.require_ack && <ClayBadge tone="yellow">需要确认</ClayBadge>}
            <span className="text-xs font-bold text-clay-faint">{formatTime(item.created_at)}</span>
          </div>
          <h2 className="text-lg md:text-2xl font-black tracking-tight break-words">{item.title}</h2>
          {item.summary && (
            <p className="mt-2 text-sm font-bold text-clay-faint leading-relaxed break-words">
              {item.summary}
            </p>
          )}
          {hasContent && expanded && (
            <ClayInsetPanel padding="md" className="mt-3 md:mt-4">
              <div className="whitespace-pre-wrap break-words text-sm font-bold text-clay-ink leading-6 md:leading-7">
                {item.content}
              </div>
            </ClayInsetPanel>
          )}
        </div>
        <div className="flex flex-wrap lg:flex-col gap-2 lg:items-stretch shrink-0">
          {item.action_url && (
            <ClayButton as={Link} to={item.action_url} variant="ghost" size="sm">
              <FileText className="w-4 h-4" />
              查看
            </ClayButton>
          )}
          {hasContent && (
            <ClayButton
              variant={expanded ? 'ghost' : 'secondary'}
              size="sm"
              onClick={() => onToggleExpand(item.id)}
            >
              {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              {expanded ? '收起正文' : '展开正文'}
            </ClayButton>
          )}
          {item.unread && canRead && (
            <ClayButton variant="secondary" size="sm" onClick={() => onRead(item)} disabled={loading}>
              <CheckCircle2 className="w-4 h-4" />
              {item.require_ack ? '我已知晓' : '标记已读'}
            </ClayButton>
          )}
        </div>
      </div>
    </ClayCard>
  )
}
