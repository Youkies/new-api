import { useEffect, useMemo, useState } from 'react'
import {
  CheckCircle2,
  ImagePlus,
  Loader2,
  Pencil,
  RefreshCw,
  Search,
  Send,
  Trash2,
  UtensilsCrossed,
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
import {
  adminApprovePlaygroundFood,
  adminDeletePlaygroundFood,
  adminListPlaygroundFoods,
  adminRejectPlaygroundFood,
  adminUpdatePlaygroundFood,
} from '../../services/playgroundFoods.js'

const categoryOptions = [
  { value: 'breakfast', label: '🌤️ 早餐' },
  { value: 'rice', label: '🍚 盖饭' },
  { value: 'noodles', label: '🍜 粉面' },
  { value: 'spicy', label: '🔥 麻辣' },
  { value: 'global', label: '🌏 异国' },
  { value: 'snack', label: '🌙 夜宵' },
  { value: 'dessert', label: '🍰 甜品' },
  { value: 'drink', label: '🥤 饮品' },
]

const statusOptions = [
  { value: '', label: '全部状态' },
  { value: 'pending', label: '待审核' },
  { value: 'approved', label: '已入池' },
  { value: 'rejected', label: '已驳回' },
]

const statusMeta = {
  pending: { label: '待审核', cls: 'bg-clay-yellow-100 text-clay-yellow-ink' },
  approved: { label: '已入池', cls: 'bg-clay-green-100 text-clay-green-ink' },
  rejected: { label: '已驳回', cls: 'bg-clay-pink-100 text-clay-pink-ink' },
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

function makeForm(item = null) {
  return {
    name: item?.name || '',
    description: item?.description || '',
    category: item?.category || 'breakfast',
    review_note: item?.review_note || '',
    image: null,
    imagePreview: item?.image_url || '',
  }
}

export default function AdminPlaygroundFoods() {
  const toast = useToast()
  const [items, setItems] = useState([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [status, setStatus] = useState('pending')
  const [keyword, setKeyword] = useState('')
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(makeForm())

  const fetchData = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await adminListPlaygroundFoods({ p: 1, size: 80, status, keyword })
      if (res?.success === false) throw new Error(res.message || '菜品加载失败')
      const list = getItems(res)
      setItems(Array.isArray(list) ? list : [])
      setTotal(getTotal(res))
    } catch (err) {
      setError(err?.response?.data?.message || err.message || '菜品加载失败')
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
      if (item.status === 'pending') pending += 1
      if (item.status === 'approved') approved += 1
      if (item.status === 'rejected') rejected += 1
    }
    return { pending, approved, rejected }
  }, [items])

  const openEdit = (item) => {
    setEditing(item)
    setForm(makeForm(item))
  }

  const closeEdit = () => {
    setEditing(null)
    setForm(makeForm())
  }

  const handleImage = (file) => {
    if (!file) {
      setForm((prev) => ({ ...prev, image: null, imagePreview: editing?.image_url || '' }))
      return
    }
    if (!file.type?.startsWith('image/')) {
      toast('请选择图片文件', 'error')
      return
    }
    if (file.size > 800 * 1024) {
      toast('图片不能超过 800KB', 'error')
      return
    }
    const reader = new FileReader()
    reader.onload = () => setForm((prev) => ({ ...prev, image: file, imagePreview: reader.result || '' }))
    reader.readAsDataURL(file)
  }

  const payload = () => ({
    name: form.name.trim(),
    description: form.description.trim(),
    category: form.category,
    icon: '🍽️',
    review_note: form.review_note.trim(),
    image: form.image,
  })

  const saveOnly = async () => {
    if (!editing || saving) return
    setSaving(true)
    try {
      const res = await adminUpdatePlaygroundFood(editing.id, payload())
      if (res?.success === false) throw new Error(res.message || '保存失败')
      toast('菜品已保存', 'success')
      closeEdit()
      await fetchData()
    } catch (err) {
      toast(err?.response?.data?.message || err.message || '保存失败', 'error')
    } finally {
      setSaving(false)
    }
  }

  const approve = async () => {
    if (!editing || saving) return
    if (!form.name.trim()) {
      toast('菜品名称不能为空', 'error')
      return
    }
    if (!form.imagePreview && !form.image) {
      toast('批准入池前需要图片', 'error')
      return
    }
    setSaving(true)
    try {
      const res = await adminApprovePlaygroundFood(editing.id, payload())
      if (res?.success === false) throw new Error(res.message || '批准失败')
      toast('已加入公共菜品池', 'success')
      closeEdit()
      await fetchData()
    } catch (err) {
      toast(err?.response?.data?.message || err.message || '批准失败', 'error')
    } finally {
      setSaving(false)
    }
  }

  const reject = async (item = editing) => {
    if (!item || saving) return
    const note = window.prompt('填写驳回原因：', form.review_note || item.review_note || '')
    if (note === null) return
    setSaving(true)
    try {
      const res = await adminRejectPlaygroundFood(item.id, { review_note: note.trim() })
      if (res?.success === false) throw new Error(res.message || '驳回失败')
      toast('已驳回投稿', 'success')
      closeEdit()
      await fetchData()
    } catch (err) {
      toast(err?.response?.data?.message || err.message || '驳回失败', 'error')
    } finally {
      setSaving(false)
    }
  }

  const remove = async (item) => {
    if (!item || !window.confirm(`确认删除「${item.name}」吗？`)) return
    try {
      const res = await adminDeletePlaygroundFood(item.id)
      if (res?.success === false) throw new Error(res.message || '删除失败')
      toast('已删除菜品', 'info')
      await fetchData()
    } catch (err) {
      toast(err?.response?.data?.message || err.message || '删除失败', 'error')
    }
  }

  const actions = (
    <ClayButton variant="ghost" onClick={fetchData} disabled={loading} className="!px-5">
      <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
      刷新
    </ClayButton>
  )

  return (
    <ClayAdminShell title="游乐场菜品" subtitle="审核用户投稿，编辑后加入“今天吃什么呀”公共菜品池。" actions={actions}>
      <div className="mb-5 grid gap-4 sm:grid-cols-3">
        <Stat label="当前列表" value={total || items.length} tone="blue" />
        <Stat label="待审核" value={stats.pending} tone="yellow" />
        <Stat label="已入池" value={stats.approved} tone="green" />
      </div>

      <ClayCard className="mb-5 !overflow-visible !p-4 md:!p-5">
        <div className="grid items-center gap-3 md:grid-cols-[220px_1fr_auto]">
          <ClaySelect value={status} options={statusOptions} onChange={setStatus} />
          <div className="relative">
            <ClayInput
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') fetchData()
              }}
              placeholder="搜索菜品、描述或提交人"
              className="!pl-12"
            />
            <Search className="absolute left-5 top-1/2 h-5 w-5 -translate-y-1/2 text-clay-faint" />
          </div>
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
          <p className="font-semibold">加载菜品中…</p>
        </div>
      ) : items.length === 0 ? (
        <ClayCard className="text-center !py-16">
          <UtensilsCrossed className="mx-auto mb-3 h-9 w-9 text-clay-faint" />
          <p className="font-bold text-clay-faint">暂无菜品投稿</p>
        </ClayCard>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {items.map((item) => (
            <FoodCard key={item.id} item={item} onEdit={openEdit} onReject={reject} onDelete={remove} />
          ))}
        </div>
      )}

      <ClayModal
        open={Boolean(editing)}
        onClose={closeEdit}
        title={editing ? `审核菜品 #${editing.id}` : '审核菜品'}
        size="lg"
        footer={(
          <>
            <ClayButton type="button" variant="ghost" onClick={() => reject()} disabled={saving || !editing}>
              <XCircle className="h-4 w-4" />
              驳回
            </ClayButton>
            <ClayButton type="button" variant="secondary" onClick={saveOnly} disabled={saving || !editing}>
              <Pencil className="h-4 w-4" />
              保存编辑
            </ClayButton>
            <ClayButton type="button" onClick={approve} disabled={saving || !editing}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              批准入池
            </ClayButton>
          </>
        )}
      >
        <div className="grid gap-5 md:grid-cols-[170px_1fr]">
          <div className="rounded-[28px] bg-clay-bg p-4 shadow-clay-inset">
            <div className="flex aspect-square items-center justify-center overflow-hidden rounded-[24px] bg-clay-surface shadow-clay-sm">
              {form.imagePreview ? (
                <img src={form.imagePreview} alt="菜品预览" className="h-full w-full object-cover" />
              ) : (
                <ImagePlus className="h-8 w-8 text-clay-faint" strokeWidth={2.6} />
              )}
            </div>
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              onChange={(e) => handleImage(e.target.files?.[0])}
              className="mt-4 block w-full text-xs font-bold text-clay-faint file:mb-2 file:rounded-clay-pill file:border-0 file:bg-clay-bg file:px-3 file:py-2 file:font-black file:text-clay-ink file:shadow-clay-sm"
            />
          </div>
          <div className="space-y-4">
            <label className="block">
              <span className="mb-2 block text-sm font-black">菜品名称</span>
              <ClayInput
                value={form.name}
                onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                maxLength={40}
              />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-black">描述</span>
              <textarea
                className="clay-input min-h-24 resize-none"
                value={form.description}
                onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                maxLength={200}
              />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-black">分类</span>
              <ClaySelect
                value={form.category}
                options={categoryOptions}
                onChange={(value) => setForm((prev) => ({ ...prev, category: value }))}
              />
            </label>
            <label className="block">
              <span className="mb-2 block text-sm font-black">审核备注</span>
              <textarea
                className="clay-input min-h-20 resize-none"
                value={form.review_note}
                onChange={(e) => setForm((prev) => ({ ...prev, review_note: e.target.value }))}
                maxLength={500}
              />
            </label>
          </div>
        </div>
      </ClayModal>
    </ClayAdminShell>
  )
}

function Stat({ label, value, tone }) {
  const toneCls = {
    blue: 'from-clay-blue-50 to-clay-bg text-clay-blue-300',
    yellow: 'from-clay-yellow-100 to-clay-bg text-clay-yellow-ink',
    green: 'from-clay-green-100 to-clay-bg text-clay-green-ink',
  }[tone] || 'from-clay-bg to-clay-bg text-clay-ink'

  return (
    <ClayCard className={`!p-5 bg-gradient-to-br ${toneCls}`}>
      <div className="text-sm font-black opacity-75">{label}</div>
      <div className="mt-2 text-3xl font-black text-clay-ink">{value}</div>
    </ClayCard>
  )
}

function FoodCard({ item, onEdit, onReject, onDelete }) {
  const meta = statusMeta[item.status] || statusMeta.pending
  return (
    <ClayCard className="!p-4">
      <div className="flex gap-4">
        <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-[24px] bg-clay-bg shadow-clay-inset">
          {item.image_url ? (
            <img src={item.image_url} alt={item.name} className="h-full w-full object-cover" />
          ) : (
            <UtensilsCrossed className="h-7 w-7 text-clay-faint" strokeWidth={2.6} />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="mb-2 flex flex-wrap items-center gap-2">
            <span className={`rounded-clay-pill px-3 py-1 text-xs font-black ${meta.cls}`}>{meta.label}</span>
            <span className="rounded-clay-pill bg-clay-bg px-3 py-1 text-xs font-black text-clay-faint shadow-clay-inset">
              {categoryOptions.find((option) => option.value === item.category)?.label || item.category}
            </span>
          </div>
          <h3 className="truncate text-lg font-black">{item.name}</h3>
          <p className="mt-1 line-clamp-2 text-sm font-semibold text-clay-faint">{item.description || '没有描述'}</p>
          <div className="mt-3 text-xs font-bold text-clay-faint">
            {item.submitted_username || `用户 #${item.submitted_by || '-'}`} · {formatTime(item.created_at)}
          </div>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap justify-end gap-2">
        <ClayButton type="button" variant="danger" size="sm" onClick={() => onDelete(item)}>
          <Trash2 className="h-4 w-4" />
          删除
        </ClayButton>
        {item.status === 'pending' && (
          <ClayButton type="button" variant="warning" size="sm" onClick={() => onReject(item)}>
            <XCircle className="h-4 w-4" />
            驳回
          </ClayButton>
        )}
        <ClayButton type="button" variant="secondary" size="sm" onClick={() => onEdit(item)}>
          {item.status === 'pending' ? <Send className="h-4 w-4" /> : <Pencil className="h-4 w-4" />}
          {item.status === 'pending' ? '审核' : '编辑'}
        </ClayButton>
      </div>
    </ClayCard>
  )
}
