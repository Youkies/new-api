import { useEffect, useMemo, useState } from 'react'
import {
  Bell,
  Edit3,
  Loader2,
  Megaphone,
  Pin,
  Plus,
  RefreshCw,
  Search,
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
  adminCreateAnnouncement,
  adminDeleteAnnouncement,
  adminListAnnouncements,
  adminPatchAnnouncement,
  adminUpdateAnnouncement,
} from '../../services/announcements.js'

const emptyForm = {
  title: '',
  summary: '',
  content: '',
  priority: 0,
  starts_at_text: '',
  ends_at_text: '',
  enabled: true,
  pinned: false,
  force_popup: false,
}

const enabledOptions = [
  { value: '', label: '全部状态' },
  { value: 'true', label: '已启用' },
  { value: 'false', label: '已停用' },
]

function pad(n) {
  return String(n).padStart(2, '0')
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

function getItems(res) {
  return res?.data?.items ?? res?.data ?? []
}

function getTotal(res) {
  return res?.data?.total ?? 0
}

function formFromAnnouncement(item) {
  if (!item) return { ...emptyForm }
  return {
    title: item.title || '',
    summary: item.summary || '',
    content: item.content || '',
    priority: item.priority || 0,
    starts_at_text: timestampToText(item.starts_at),
    ends_at_text: timestampToText(item.ends_at),
    enabled: Boolean(item.enabled),
    pinned: Boolean(item.pinned),
    force_popup: Boolean(item.force_popup),
  }
}

function formToPayload(form) {
  return {
    title: form.title.trim(),
    summary: form.summary.trim(),
    content: form.content.trim(),
    content_format: 'markdown',
    type: 'normal',
    scope: 'all',
    force_popup: form.force_popup,
    pinned: form.pinned,
    enabled: form.enabled,
    priority: Number(form.priority) || 0,
    starts_at: textToTimestamp(form.starts_at_text),
    ends_at: textToTimestamp(form.ends_at_text),
  }
}

function activeLabel(item) {
  if (!item.enabled) return { text: '停用', cls: 'bg-white/60 text-clay-faint' }
  const now = Math.floor(Date.now() / 1000)
  if (item.starts_at && item.starts_at > now) return { text: '待生效', cls: 'bg-clay-yellow-100 text-[#8a6a32]' }
  if (item.ends_at && item.ends_at < now) return { text: '已过期', cls: 'bg-white/60 text-clay-faint' }
  return { text: '生效中', cls: 'bg-clay-green-100 text-[#3d6b4f]' }
}

export default function AdminAnnouncements() {
  const toast = useToast()
  const [items, setItems] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [keyword, setKeyword] = useState('')
  const [enabled, setEnabled] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)

  const fetchData = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await adminListAnnouncements({ p: 1, size: 50, keyword, enabled })
      if (res?.success === false) throw new Error(res.message || '公告加载失败')
      const list = getItems(res)
      setItems(Array.isArray(list) ? list : [])
      setTotal(getTotal(res))
    } catch (err) {
      setError(err?.response?.data?.message || err.message || '公告加载失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  const stats = useMemo(() => {
    let force = 0
    let pinned = 0
    let enabledCount = 0
    for (const item of items) {
      if (item.force_popup) force++
      if (item.pinned) pinned++
      if (item.enabled) enabledCount++
    }
    return { force, pinned, enabledCount }
  }, [items])

  const openCreate = () => {
    setEditing(null)
    setForm({ ...emptyForm })
    setModalOpen(true)
  }

  const openEdit = (item) => {
    setEditing(item)
    setForm(formFromAnnouncement(item))
    setModalOpen(true)
  }

  const updateForm = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const handleSave = async () => {
    const payload = formToPayload(form)
    if (!payload.title || !payload.content) {
      toast('标题和内容不能为空', 'warning')
      return
    }
    if (payload.starts_at && payload.ends_at && payload.starts_at > payload.ends_at) {
      toast('开始时间不能晚于结束时间', 'warning')
      return
    }
    setSaving(true)
    try {
      const res = editing
        ? await adminUpdateAnnouncement(editing.id, payload)
        : await adminCreateAnnouncement(payload)
      if (res?.success === false) throw new Error(res.message || '保存失败')
      toast(editing ? '公告已更新，版本号已递增' : '公告已创建', 'success')
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
      const res = await adminPatchAnnouncement(item.id, payload)
      if (res?.success === false) throw new Error(res.message || '更新失败')
      await fetchData()
    } catch (err) {
      toast(err?.response?.data?.message || err.message || '更新失败', 'error')
    }
  }

  const handleDelete = async (item) => {
    if (!window.confirm(`确认删除公告「${item.title}」吗？`)) return
    try {
      const res = await adminDeleteAnnouncement(item.id)
      if (res?.success === false) throw new Error(res.message || '删除失败')
      toast('公告已删除', 'success')
      await fetchData()
    } catch (err) {
      toast(err?.response?.data?.message || err.message || '删除失败', 'error')
    }
  }

  const actions = (
    <>
      <ClayButton variant="ghost" onClick={fetchData} className="!px-5">
        <RefreshCw className="w-4 h-4" />
        刷新
      </ClayButton>
      <ClayButton variant="primary" onClick={openCreate} className="!px-5">
        <Plus className="w-4 h-4" />
        新建公告
      </ClayButton>
    </>
  )

  return (
    <ClayAdminShell
      title="公告管理"
      subtitle="管理强制弹窗与主页历史公告。完整编辑会递增版本号，用户需重新确认。"
      actions={actions}
    >
      <div className="grid sm:grid-cols-3 gap-4 mb-5">
        <Stat label="公告总数" value={total || items.length} tone="blue" />
        <Stat label="强制弹窗" value={stats.force} tone="pink" />
        <Stat label="已启用" value={stats.enabledCount} tone="green" />
      </div>

      <ClayCard className="!p-4 md:!p-5 mb-5 !overflow-visible">
        <div className="grid md:grid-cols-[1fr_220px_auto] gap-3 items-center">
          <div className="relative">
            <ClayInput
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') fetchData()
              }}
              placeholder="搜索标题或摘要"
              className="!pl-12"
            />
            <Search className="w-5 h-5 absolute left-5 top-1/2 -translate-y-1/2 text-clay-faint" />
          </div>
          <ClaySelect value={enabled} options={enabledOptions} onChange={setEnabled} />
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
          <p className="font-semibold">加载公告中…</p>
        </div>
      ) : items.length === 0 ? (
        <ClayCard className="text-center !py-16">
          <Megaphone className="w-9 h-9 mx-auto mb-3 text-clay-faint" />
          <p className="font-bold text-clay-faint">还没有公告</p>
        </ClayCard>
      ) : (
        <ClayCard className="!p-0 overflow-hidden">
          <div className="hidden lg:grid grid-cols-[1.2fr_120px_160px_180px_190px] gap-4 px-6 py-4 text-xs font-black text-clay-faint uppercase border-b border-black/5 bg-clay-bg/50">
            <span>标题</span>
            <span>状态</span>
            <span>开关</span>
            <span>时间</span>
            <span className="text-right">操作</span>
          </div>
          <div className="divide-y divide-black/5">
            {items.map((item) => (
              <AnnouncementRow
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
        title={editing ? `编辑公告 #${editing.id}` : '新建公告'}
        size="xl"
        footer={
          <>
            <ClayButton variant="ghost" onClick={() => setModalOpen(false)}>
              取消
            </ClayButton>
            <ClayButton variant="primary" onClick={handleSave} disabled={saving}>
              {saving ? '保存中' : '保存公告'}
            </ClayButton>
          </>
        }
      >
        <div className="grid gap-4">
          <Field label="标题">
            <ClayInput value={form.title} onChange={(e) => updateForm('title', e.target.value)} />
          </Field>
          <Field label="摘要">
            <ClayInput value={form.summary} onChange={(e) => updateForm('summary', e.target.value)} />
          </Field>
          <Field label="内容">
            <textarea
              className="clay-input min-h-[220px] resize-y leading-7"
              value={form.content}
              onChange={(e) => updateForm('content', e.target.value)}
            />
          </Field>
          <div className="grid md:grid-cols-3 gap-4">
            <Field label="优先级">
              <ClayInput
                type="number"
                value={form.priority}
                onChange={(e) => updateForm('priority', e.target.value)}
              />
            </Field>
            <Field label="开始时间">
              <ClayInput
                value={form.starts_at_text}
                onChange={(e) => updateForm('starts_at_text', e.target.value)}
                placeholder="2026-04-28 10:00"
              />
            </Field>
            <Field label="结束时间">
              <ClayInput
                value={form.ends_at_text}
                onChange={(e) => updateForm('ends_at_text', e.target.value)}
                placeholder="留空为长期有效"
              />
            </Field>
          </div>
          <div className="grid sm:grid-cols-3 gap-4">
            <ToggleField label="启用" checked={form.enabled} onChange={(v) => updateForm('enabled', v)} />
            <ToggleField label="置顶" checked={form.pinned} onChange={(v) => updateForm('pinned', v)} />
            <ToggleField
              label="强制弹窗"
              checked={form.force_popup}
              onChange={(v) => updateForm('force_popup', v)}
            />
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
    pink: 'text-[#8a4860]',
    green: 'text-[#3d6b4f]',
  }[tone]
  return (
    <ClayCard className="!p-5">
      <div className="text-xs font-black text-clay-faint uppercase mb-1">{label}</div>
      <div className={`text-3xl font-black tabular-nums ${cls}`}>{value}</div>
    </ClayCard>
  )
}

function AnnouncementRow({ item, onEdit, onPatch, onDelete }) {
  const status = activeLabel(item)
  return (
    <div className="grid lg:grid-cols-[1.2fr_120px_160px_180px_190px] gap-4 px-5 md:px-6 py-5 items-center">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2 mb-2">
          {item.pinned && (
            <span className="inline-flex items-center gap-1 text-[11px] font-black px-2.5 py-1 rounded-clay-pill bg-clay-yellow-100 text-[#8a6a32]">
              <Pin className="w-3 h-3" />
              置顶
            </span>
          )}
          {item.force_popup && (
            <span className="inline-flex items-center gap-1 text-[11px] font-black px-2.5 py-1 rounded-clay-pill bg-clay-pink-100 text-[#8a4860]">
              <Bell className="w-3 h-3" />
              强制
            </span>
          )}
          <span className="text-[11px] font-black px-2.5 py-1 rounded-clay-pill bg-white/60 text-clay-faint">
            v{item.version}
          </span>
        </div>
        <div className="font-black truncate" title={item.title}>
          {item.title}
        </div>
        {item.summary && (
          <div className="text-xs font-semibold text-clay-faint mt-1 line-clamp-2">{item.summary}</div>
        )}
      </div>

      <div>
        <span className={`inline-flex px-3 py-1 rounded-clay-pill text-xs font-black ${status.cls}`}>
          {status.text}
        </span>
      </div>

      <div className="flex items-center gap-3">
        <ClayToggle
          checked={item.enabled}
          onChange={(v) => onPatch(item, { enabled: v })}
        />
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
