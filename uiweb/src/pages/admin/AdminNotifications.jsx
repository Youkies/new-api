import { useEffect, useMemo, useState } from 'react'
import {
  Bell,
  CheckCircle2,
  CircleDollarSign,
  Edit3,
  Loader2,
  Megaphone,
  Pin,
  Plus,
  RefreshCw,
  Search,
  ShieldCheck,
  Trash2,
} from 'lucide-react'
import ClayAlert from '../../components/clay/ClayAlert.jsx'
import ClayButton from '../../components/clay/ClayButton.jsx'
import ClayCard from '../../components/clay/ClayCard.jsx'
import ClayInput from '../../components/clay/ClayInput.jsx'
import ClayModal from '../../components/clay/ClayModal.jsx'
import ClaySelect from '../../components/clay/ClaySelect.jsx'
import ClayToggle from '../../components/clay/ClayToggle.jsx'
import ClayAdminShell from '../../components/layout/ClayAdminShell.jsx'
import { useToast } from '../../context/ToastContext.jsx'
import {
  adminCreateNotification,
  adminDeleteNotification,
  adminListNotifications,
  adminPatchNotification,
  adminUpdateNotification,
} from '../../services/notifications.js'

const emptyForm = {
  title: '',
  summary: '',
  content: '',
  content_format: 'plain',
  category: 'system',
  level: 'info',
  source_type: 'manual',
  source_key: '',
  source_id: 0,
  source_version: 1,
  target_type: 'all',
  target_user_id: '',
  target_group: '',
  action_url: '',
  priority: 0,
  starts_at_text: '',
  ends_at_text: '',
  enabled: true,
  pinned: false,
  popup: false,
  require_ack: false,
}

const categoryOptions = [
  { value: '', label: '全部类型' },
  { value: 'announcement', label: '公告' },
  { value: 'billing', label: '充值' },
  { value: 'appeal', label: '申诉' },
  { value: 'system', label: '系统' },
]

const editCategoryOptions = categoryOptions.filter((item) => item.value)

const levelOptions = [
  { value: 'info', label: '普通' },
  { value: 'success', label: '成功' },
  { value: 'warning', label: '提醒' },
  { value: 'error', label: '错误' },
]

const targetOptions = [
  { value: '', label: '全部目标' },
  { value: 'all', label: '全部用户' },
  { value: 'user', label: '指定用户' },
  { value: 'group', label: '指定分组' },
  { value: 'admin', label: '管理员' },
]

const enabledOptions = [
  { value: '', label: '全部状态' },
  { value: 'true', label: '已启用' },
  { value: 'false', label: '已停用' },
]

const categoryMeta = {
  announcement: { label: '公告', cls: 'bg-clay-blue-100 text-[#2c5582]', icon: Megaphone },
  billing: { label: '充值', cls: 'bg-clay-green-100 text-[#3d6b4f]', icon: CircleDollarSign },
  appeal: { label: '申诉', cls: 'bg-clay-yellow-100 text-[#8a6a32]', icon: ShieldCheck },
  system: { label: '系统', cls: 'bg-white/60 text-clay-faint', icon: Bell },
}

function pad(n) {
  return String(n).padStart(2, '0')
}

function timestampToText(ts) {
  if (!ts) return ''
  const d = new Date(ts * 1000)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function textToTimestamp(value) {
  const raw = String(value || '').trim()
  if (!raw) return 0
  const normalized = raw.replace(/\//g, '-').replace(' ', 'T')
  const withSeconds = normalized.length === 16 ? `${normalized}:00` : normalized
  const d = new Date(withSeconds)
  if (Number.isNaN(d.getTime())) return 0
  return Math.floor(d.getTime() / 1000)
}

function formatTime(ts) {
  if (!ts) return '长期'
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

function formFromNotification(item) {
  if (!item) return { ...emptyForm }
  return {
    title: item.title || '',
    summary: item.summary || '',
    content: item.content || '',
    content_format: item.content_format || 'plain',
    category: item.category || 'system',
    level: item.level || 'info',
    source_type: item.source_type || 'manual',
    source_key: item.source_key || '',
    source_id: item.source_id || 0,
    source_version: item.source_version || 1,
    target_type: item.target_type || 'all',
    target_user_id: item.target_user_id || '',
    target_group: item.target_group || '',
    action_url: item.action_url || '',
    priority: item.priority || 0,
    starts_at_text: timestampToText(item.starts_at),
    ends_at_text: timestampToText(item.ends_at),
    enabled: Boolean(item.enabled),
    pinned: Boolean(item.pinned),
    popup: Boolean(item.popup),
    require_ack: Boolean(item.require_ack),
  }
}

function formToPayload(form) {
  return {
    title: form.title.trim(),
    summary: form.summary.trim(),
    content: form.content.trim(),
    content_format: form.content_format || 'plain',
    category: form.category || 'system',
    level: form.level || 'info',
    source_type: form.source_type || 'manual',
    source_key: form.source_key || '',
    source_id: Number(form.source_id) || 0,
    source_version: Number(form.source_version) || 1,
    target_type: form.target_type || 'all',
    target_user_id: Number(form.target_user_id) || 0,
    target_group: form.target_group.trim(),
    action_url: form.action_url.trim(),
    popup: form.popup,
    require_ack: form.require_ack,
    pinned: form.pinned,
    enabled: form.enabled,
    priority: Number(form.priority) || 0,
    starts_at: textToTimestamp(form.starts_at_text),
    ends_at: textToTimestamp(form.ends_at_text),
  }
}

export default function AdminNotifications() {
  const toast = useToast()
  const [items, setItems] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [category, setCategory] = useState('')
  const [targetType, setTargetType] = useState('')
  const [enabled, setEnabled] = useState('')
  const [keyword, setKeyword] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)

  const fetchData = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await adminListNotifications({
        p: 1,
        size: 50,
        category,
        target_type: targetType,
        keyword,
        enabled,
      })
      if (res?.success === false) throw new Error(res.message || '通知加载失败')
      const list = getItems(res)
      setItems(Array.isArray(list) ? list : [])
      setTotal(getTotal(res))
    } catch (err) {
      setError(err?.response?.data?.message || err.message || '通知加载失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  const stats = useMemo(() => {
    let enabledCount = 0
    let ack = 0
    let popup = 0
    for (const item of items) {
      if (item.enabled) enabledCount++
      if (item.require_ack) ack++
      if (item.popup) popup++
    }
    return { enabledCount, ack, popup }
  }, [items])

  const openCreate = () => {
    setEditing(null)
    setForm({ ...emptyForm })
    setModalOpen(true)
  }

  const openEdit = (item) => {
    setEditing(item)
    setForm(formFromNotification(item))
    setModalOpen(true)
  }

  const updateForm = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const handleSave = async () => {
    const payload = formToPayload(form)
    if (!payload.title) {
      toast('通知标题不能为空', 'warning')
      return
    }
    if (payload.target_type === 'user' && !payload.target_user_id) {
      toast('指定用户通知需要填写用户 ID', 'warning')
      return
    }
    if (payload.target_type === 'group' && !payload.target_group) {
      toast('分组通知需要填写分组名', 'warning')
      return
    }
    if (payload.starts_at && payload.ends_at && payload.starts_at > payload.ends_at) {
      toast('开始时间不能晚于结束时间', 'warning')
      return
    }
    setSaving(true)
    try {
      const res = editing
        ? await adminUpdateNotification(editing.id, payload)
        : await adminCreateNotification(payload)
      if (res?.success === false) throw new Error(res.message || '保存失败')
      toast(editing ? '通知已更新' : '通知已创建', 'success')
      setModalOpen(false)
      await fetchData()
    } catch (err) {
      toast(err?.response?.data?.message || err.message || '保存失败', 'error')
    } finally {
      setSaving(false)
    }
  }

  const handlePatch = async (item, payload) => {
    try {
      const res = await adminPatchNotification(item.id, payload)
      if (res?.success === false) throw new Error(res.message || '更新失败')
      await fetchData()
    } catch (err) {
      toast(err?.response?.data?.message || err.message || '更新失败', 'error')
    }
  }

  const handleDelete = async (item) => {
    if (!window.confirm(`确认删除通知「${item.title}」吗？`)) return
    try {
      const res = await adminDeleteNotification(item.id)
      if (res?.success === false) throw new Error(res.message || '删除失败')
      toast('通知已删除', 'success')
      await fetchData()
    } catch (err) {
      toast(err?.response?.data?.message || err.message || '删除失败', 'error')
    }
  }

  const actions = (
    <>
      <ClayButton variant="ghost" onClick={fetchData} disabled={loading} className="!px-5">
        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        刷新
      </ClayButton>
      <ClayButton variant="primary" onClick={openCreate} className="!px-5">
        <Plus className="w-4 h-4" />
        新建通知
      </ClayButton>
    </>
  )

  return (
    <ClayAdminShell
      title="通知管理"
      subtitle="管理用户通知时间轴。公告、充值和申诉会自动写入，也可以手动创建运营通知。"
      actions={actions}
    >
      <div className="grid sm:grid-cols-3 gap-4 mb-5">
        <Stat label="通知总数" value={total || items.length} tone="blue" />
        <Stat label="需要确认" value={stats.ack} tone="yellow" />
        <Stat label="已启用" value={stats.enabledCount} tone="green" />
      </div>

      <ClayCard className="!p-4 md:!p-5 mb-5 !overflow-visible">
        <div className="grid lg:grid-cols-[160px_160px_160px_1fr_auto] gap-3 items-center">
          <ClaySelect value={category} options={categoryOptions} onChange={setCategory} />
          <ClaySelect value={targetType} options={targetOptions} onChange={setTargetType} />
          <ClaySelect value={enabled} options={enabledOptions} onChange={setEnabled} />
          <div className="relative">
            <ClayInput
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') fetchData()
              }}
              placeholder="搜索标题、摘要、来源或用户 ID"
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
          <p className="font-semibold">加载通知中…</p>
        </div>
      ) : items.length === 0 ? (
        <ClayCard className="text-center !py-16">
          <Bell className="w-9 h-9 mx-auto mb-3 text-clay-faint" />
          <p className="font-bold text-clay-faint">还没有通知</p>
        </ClayCard>
      ) : (
        <ClayCard className="!p-0 overflow-hidden">
          <div className="hidden lg:grid grid-cols-[120px_1fr_150px_160px_170px_190px] gap-4 px-6 py-4 text-xs font-black text-clay-faint uppercase border-b border-black/5 bg-clay-bg/50">
            <span>类型</span>
            <span>标题</span>
            <span>目标</span>
            <span>开关</span>
            <span>时间</span>
            <span className="text-right">操作</span>
          </div>
          <div className="divide-y divide-black/5">
            {items.map((item) => (
              <NotificationRow
                key={item.id}
                item={item}
                onEdit={openEdit}
                onPatch={handlePatch}
                onDelete={handleDelete}
              />
            ))}
          </div>
        </ClayCard>
      )}

      <ClayModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? `编辑通知 #${editing.id}` : '新建通知'}
        size="xl"
        footer={
          <>
            <ClayButton variant="ghost" onClick={() => setModalOpen(false)}>
              取消
            </ClayButton>
            <ClayButton variant="primary" onClick={handleSave} disabled={saving}>
              {saving ? '保存中' : '保存通知'}
            </ClayButton>
          </>
        }
      >
        <div className="grid gap-4">
          <div className="grid md:grid-cols-3 gap-4">
            <Field label="类型">
              <ClaySelect value={form.category} options={editCategoryOptions} onChange={(v) => updateForm('category', v)} />
            </Field>
            <Field label="级别">
              <ClaySelect value={form.level} options={levelOptions} onChange={(v) => updateForm('level', v)} />
            </Field>
            <Field label="目标">
              <ClaySelect value={form.target_type} options={targetOptions.filter((item) => item.value)} onChange={(v) => updateForm('target_type', v)} />
            </Field>
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            {form.target_type === 'user' && (
              <Field label="用户 ID">
                <ClayInput value={form.target_user_id} onChange={(e) => updateForm('target_user_id', e.target.value)} />
              </Field>
            )}
            {form.target_type === 'group' && (
              <Field label="用户分组">
                <ClayInput value={form.target_group} onChange={(e) => updateForm('target_group', e.target.value)} />
              </Field>
            )}
            <Field label="跳转地址">
              <ClayInput value={form.action_url} onChange={(e) => updateForm('action_url', e.target.value)} placeholder="/logs" />
            </Field>
          </div>
          <Field label="标题">
            <ClayInput value={form.title} onChange={(e) => updateForm('title', e.target.value)} />
          </Field>
          <Field label="摘要">
            <ClayInput value={form.summary} onChange={(e) => updateForm('summary', e.target.value)} />
          </Field>
          <Field label="内容">
            <textarea
              className="clay-input min-h-[180px] resize-y leading-7"
              value={form.content}
              onChange={(e) => updateForm('content', e.target.value)}
            />
          </Field>
          <div className="grid md:grid-cols-3 gap-4">
            <Field label="优先级">
              <ClayInput type="number" value={form.priority} onChange={(e) => updateForm('priority', e.target.value)} />
            </Field>
            <Field label="开始时间">
              <ClayInput value={form.starts_at_text} onChange={(e) => updateForm('starts_at_text', e.target.value)} placeholder="2026-05-04 10:00" />
            </Field>
            <Field label="结束时间">
              <ClayInput value={form.ends_at_text} onChange={(e) => updateForm('ends_at_text', e.target.value)} placeholder="留空为长期有效" />
            </Field>
          </div>
          <div className="grid sm:grid-cols-4 gap-4">
            <ToggleField label="启用" checked={form.enabled} onChange={(v) => updateForm('enabled', v)} />
            <ToggleField label="置顶" checked={form.pinned} onChange={(v) => updateForm('pinned', v)} />
            <ToggleField label="弹窗" checked={form.popup} onChange={(v) => updateForm('popup', v)} />
            <ToggleField label="需确认" checked={form.require_ack} onChange={(v) => updateForm('require_ack', v)} />
          </div>
        </div>
      </ClayModal>
    </ClayAdminShell>
  )
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="block text-sm font-extrabold text-clay-ink mb-2">{label}</span>
      {children}
    </label>
  )
}

function ToggleField({ label, checked, onChange }) {
  return (
    <div className="rounded-clay bg-white/45 shadow-clay-inset p-4 flex items-center justify-between gap-3">
      <span className="font-extrabold text-sm">{label}</span>
      <ClayToggle checked={checked} onChange={onChange} />
    </div>
  )
}

function Stat({ label, value, tone }) {
  const cls = {
    blue: 'text-[#2c5582]',
    yellow: 'text-[#8a6a32]',
    green: 'text-[#3d6b4f]',
  }[tone]
  return (
    <ClayCard className="!p-5">
      <div className="text-xs font-black text-clay-faint uppercase mb-1">{label}</div>
      <div className={`text-3xl font-black tabular-nums ${cls}`}>{value}</div>
    </ClayCard>
  )
}

function CategoryBadge({ category }) {
  const meta = categoryMeta[category] ?? categoryMeta.system
  const Icon = meta.icon
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-clay-pill text-xs font-black ${meta.cls}`}>
      <Icon className="w-3.5 h-3.5" />
      {meta.label}
    </span>
  )
}

function targetText(item) {
  if (item.target_type === 'user') return `用户 ${item.target_user_id}`
  if (item.target_type === 'group') return `分组 ${item.target_group || '-'}`
  if (item.target_type === 'admin') return '管理员'
  return '全部用户'
}

function NotificationRow({ item, onEdit, onPatch, onDelete }) {
  return (
    <div className="grid lg:grid-cols-[120px_1fr_150px_160px_170px_190px] gap-4 px-5 md:px-6 py-5 items-center">
      <div>
        <CategoryBadge category={item.category} />
      </div>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2 mb-2">
          {item.pinned && (
            <span className="inline-flex items-center gap-1 text-[11px] font-black px-2.5 py-1 rounded-clay-pill bg-clay-yellow-100 text-[#8a6a32]">
              <Pin className="w-3 h-3" />
              置顶
            </span>
          )}
          {item.require_ack && (
            <span className="inline-flex items-center gap-1 text-[11px] font-black px-2.5 py-1 rounded-clay-pill bg-clay-pink-100 text-[#8a4860]">
              <CheckCircle2 className="w-3 h-3" />
              确认
            </span>
          )}
        </div>
        <div className="font-black truncate" title={item.title}>
          {item.title}
        </div>
        {item.summary && (
          <div className="text-xs font-semibold text-clay-faint mt-1 line-clamp-2">{item.summary}</div>
        )}
        {item.source_key && (
          <div className="text-[11px] font-mono text-clay-faint mt-1 truncate">{item.source_key}</div>
        )}
      </div>
      <div className="text-sm font-black">{targetText(item)}</div>
      <div className="flex items-center gap-3">
        <ClayToggle checked={item.enabled} onChange={(v) => onPatch(item, { enabled: v })} />
        <span className="text-xs font-bold text-clay-faint">{item.enabled ? '启用' : '停用'}</span>
      </div>
      <div className="text-xs font-bold text-clay-faint leading-5">
        <div>开始：{formatTime(item.starts_at)}</div>
        <div>结束：{formatTime(item.ends_at)}</div>
      </div>
      <div className="flex justify-start lg:justify-end gap-2">
        <button
          type="button"
          onClick={() => onPatch(item, { pinned: !item.pinned })}
          className="w-10 h-10 rounded-full bg-clay-bg shadow-clay flex items-center justify-center hover:shadow-clay-hover"
          title={item.pinned ? '取消置顶' : '置顶'}
        >
          <Pin className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => onEdit(item)}
          className="w-10 h-10 rounded-full bg-clay-bg shadow-clay flex items-center justify-center hover:shadow-clay-hover"
          title="编辑"
        >
          <Edit3 className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => onDelete(item)}
          className="w-10 h-10 rounded-full bg-clay-bg shadow-clay flex items-center justify-center hover:shadow-clay-hover text-clay-pink-400"
          title="删除"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  )
}
