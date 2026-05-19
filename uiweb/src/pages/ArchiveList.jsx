import { useEffect, useState, useCallback, useSyncExternalStore } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Layers, Plus, Trash2, Pencil, Share2, Download,
  RefreshCw, ChevronRight, Hash,
} from 'lucide-react'
import ClayCard from '../components/clay/ClayCard.jsx'
import ClayButton from '../components/clay/ClayButton.jsx'
import ClayField from '../components/clay/ClayField.jsx'
import ClayModal from '../components/clay/ClayModal.jsx'
import ClayConsoleShell from '../components/layout/ClayConsoleShell.jsx'
import TutorialButton from '../components/tutorial/TutorialButton.jsx'
import { useToast } from '../context/ToastContext.jsx'
import {
  listArchives, createArchive, updateArchive, deleteArchive,
} from '../services/archives.js'

const mobileQuery = typeof window !== 'undefined' ? window.matchMedia('(max-width: 767px)') : null
function useIsMobile() {
  return useSyncExternalStore(
    (cb) => { mobileQuery?.addEventListener('change', cb); return () => mobileQuery?.removeEventListener('change', cb) },
    () => mobileQuery?.matches ?? false,
  )
}

function ArchiveCard({ a, onOpen, onEdit, onDelete }) {
  return (
    <div
      className="clay-card-interactive !p-5 !rounded-clay cursor-pointer"
      onClick={onOpen}
    >
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-9 h-9 rounded-full shadow-clay-sm bg-clay-purple-100 flex items-center justify-center shrink-0">
            <Layers className="w-4 h-4 text-clay-purple-ink" />
          </div>
          <div className="min-w-0">
            <div className="font-bold text-sm truncate max-w-[180px]">{a.name}</div>
            <div className="text-[11px] text-clay-faint mt-0.5 flex items-center gap-1">
              <Hash className="w-3 h-3" />
              <span className="truncate max-w-[150px]">{a.slug}</span>
            </div>
          </div>
        </div>
        <ChevronRight className="w-4 h-4 text-clay-faint mt-1.5 shrink-0" />
      </div>

      {a.description && (
        <div className="text-xs text-clay-faint mb-3 line-clamp-2">{a.description}</div>
      )}

      <div className="flex items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-clay-pill text-xs font-black bg-clay-purple-100 text-clay-purple-ink shadow-clay-sm">
            <Layers className="w-3 h-3" strokeWidth={2.5} />
            {a.alias_count} 个别名
          </span>
          {a.share_enabled && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-clay-pill text-xs font-black bg-clay-green-100 text-clay-green-ink shadow-clay-sm">
              <Share2 className="w-3 h-3" strokeWidth={2.5} />
              已分享
            </span>
          )}
        </div>
        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          <button onClick={onEdit} className="clay-icon-btn" title="重命名" aria-label="重命名">
            <Pencil className="w-4 h-4" />
          </button>
          <button onClick={onDelete} className="clay-icon-btn-danger" title="删除" aria-label="删除">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}

export default function ArchiveList() {
  const toast = useToast()
  const navigate = useNavigate()
  const isMobile = useIsMobile()
  const [archives, setArchives] = useState([])
  const [loading, setLoading] = useState(false)

  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({ name: '', description: '', slug: '' })
  const [saving, setSaving] = useState(false)

  const [showImport, setShowImport] = useState(false)
  const [importCode, setImportCode] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await listArchives()
      setArchives(res?.data ?? [])
    } catch (e) {
      toast(e?.response?.data?.message ?? '加载失败', 'error')
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => { load() }, [load])

  const openCreate = () => {
    setEditing(null)
    setForm({ name: '', description: '', slug: '' })
    setShowModal(true)
  }

  const openEdit = (a) => {
    setEditing(a)
    setForm({ name: a.name, description: a.description || '', slug: a.slug })
    setShowModal(true)
  }

  const onSave = async () => {
    if (!form.name.trim()) { toast('请输入存档名称', 'error'); return }
    setSaving(true)
    try {
      if (editing) {
        const res = await updateArchive(editing.id, form)
        if (!res?.success) throw new Error(res?.message ?? '更新失败')
        toast('已更新')
      } else {
        const res = await createArchive(form)
        if (!res?.success) throw new Error(res?.message ?? '创建失败')
        toast('已创建')
      }
      setShowModal(false)
      load()
    } catch (e) {
      toast(e?.response?.data?.message ?? e.message ?? '操作失败', 'error')
    } finally {
      setSaving(false)
    }
  }

  const onDelete = async (a) => {
    if (!confirm(`确认删除存档「${a.name}」？所有别名都会被删除，绑定该存档的 Key 会被解除绑定。`)) return
    try {
      const res = await deleteArchive(a.id)
      if (!res?.success) throw new Error(res?.message ?? '删除失败')
      toast('已删除')
      load()
    } catch (e) {
      toast(e?.response?.data?.message ?? e.message ?? '删除失败', 'error')
    }
  }

  const onImportSubmit = () => {
    const code = importCode.trim()
    if (!code) { toast('请输入分享码', 'error'); return }
    setShowImport(false)
    navigate(`/archives/share/${encodeURIComponent(code)}`)
  }

  return (
    <ClayConsoleShell
      title="模型别名存档"
      subtitle="自建分组，把不同分组的模型重命名后统一在 Key 上调用"
      actions={
        <div className="flex items-center gap-2">
          <TutorialButton tours={['archive-create', 'archive-import']}>新手指引</TutorialButton>
          <ClayButton variant="ghost" onClick={() => setShowImport(true)}>
            <Download className="w-4 h-4" /> 导入
          </ClayButton>
          <ClayButton variant="primary" onClick={openCreate}>
            <Plus className="w-4 h-4" /> 新建存档
          </ClayButton>
        </div>
      }
    >
      {loading && (
        <ClayCard className="!py-12 text-center">
          <div className="flex flex-col items-center gap-3">
            <RefreshCw className="w-8 h-8 text-clay-faint animate-spin" />
            <span className="text-clay-faint font-bold">加载中…</span>
          </div>
        </ClayCard>
      )}

      {!loading && archives.length === 0 && (
        <ClayCard className="!py-16 text-center">
          <div className="flex flex-col items-center gap-4 max-w-sm mx-auto">
            <Layers className="w-12 h-12 text-clay-faint/50" />
            <div>
              <div className="font-bold text-base mb-1">还没有存档</div>
              <div className="text-xs text-clay-faint">
                新建一个存档，添加跨分组的模型别名，
                然后在 Key 上绑定即可生效。
              </div>
            </div>
            <ClayButton variant="primary" onClick={openCreate}>
              <Plus className="w-4 h-4" /> 新建第一个存档
            </ClayButton>
          </div>
        </ClayCard>
      )}

      {!loading && archives.length > 0 && (
        <div className={isMobile ? 'space-y-3' : 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4'}>
          {archives.map((a) => (
            <ArchiveCard
              key={a.id}
              a={a}
              onOpen={() => navigate(`/archives/${a.id}`)}
              onEdit={() => openEdit(a)}
              onDelete={() => onDelete(a)}
            />
          ))}
        </div>
      )}

      <ClayModal open={showModal} onClose={() => setShowModal(false)} title={editing ? '编辑存档' : '新建存档'} size="md">
        <div className="space-y-4">
          <ClayField
            label="名称"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="例如：便宜模型组"
            maxLength={64}
          />
          <ClayField
            label="描述"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="可选"
            maxLength={255}
          />
          <ClayField
            label="Slug"
            value={form.slug}
            onChange={(e) => setForm({ ...form, slug: e.target.value })}
            placeholder="留空则自动生成"
            hint="用于前缀路由 model=slug@alias-name"
            maxLength={64}
          />
        </div>
        <div className="flex flex-col-reverse items-stretch gap-3 mt-6 sm:flex-row sm:items-center sm:justify-end">
          <ClayButton variant="ghost" onClick={() => setShowModal(false)}>取消</ClayButton>
          <ClayButton variant="primary" onClick={onSave} disabled={saving}>{saving ? '保存中…' : '保存'}</ClayButton>
        </div>
      </ClayModal>

      <ClayModal open={showImport} onClose={() => setShowImport(false)} title="导入分享存档" size="md">
        <div className="space-y-4">
          <ClayField
            label="分享码"
            value={importCode}
            onChange={(e) => setImportCode(e.target.value)}
            placeholder="例如：a1B2c3D4eF"
            hint="从别人那里复制的分享码"
          />
        </div>
        <div className="flex flex-col-reverse items-stretch gap-3 mt-6 sm:flex-row sm:items-center sm:justify-end">
          <ClayButton variant="ghost" onClick={() => setShowImport(false)}>取消</ClayButton>
          <ClayButton variant="primary" onClick={onImportSubmit}>预览</ClayButton>
        </div>
      </ClayModal>
    </ClayConsoleShell>
  )
}
