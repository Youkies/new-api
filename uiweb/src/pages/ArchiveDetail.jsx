import { useEffect, useState, useCallback, useSyncExternalStore, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  Layers, Plus, Trash2, Pencil, Share2, Copy, ChevronLeft,
  RefreshCw, AlertTriangle, ToggleLeft, ToggleRight, Hash, ArrowRight,
  Tag, Cpu,
} from 'lucide-react'
import ClayCard from '../components/clay/ClayCard.jsx'
import ClayButton from '../components/clay/ClayButton.jsx'
import ClayField from '../components/clay/ClayField.jsx'
import ClaySelect from '../components/clay/ClaySelect.jsx'
import ClayModal from '../components/clay/ClayModal.jsx'
import ClayConsoleShell from '../components/layout/ClayConsoleShell.jsx'
import { useToast } from '../context/ToastContext.jsx'
import {
  getArchive, createAlias, updateAlias, deleteAlias,
  enableArchiveShare, disableArchiveShare, getArchiveOptions,
} from '../services/archives.js'
import { copyTextToClipboard } from '../utils/clipboard.js'

const mobileQuery = typeof window !== 'undefined' ? window.matchMedia('(max-width: 767px)') : null
function useIsMobile() {
  return useSyncExternalStore(
    (cb) => { mobileQuery?.addEventListener('change', cb); return () => mobileQuery?.removeEventListener('change', cb) },
    () => mobileQuery?.matches ?? false,
  )
}

function AliasCard({ a, onEdit, onDelete }) {
  return (
    <div className="clay-card-interactive !p-4 !rounded-clay">
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="font-mono text-sm font-black truncate flex-1 inline-flex items-center gap-1.5">
          <Tag className="w-3.5 h-3.5 text-clay-purple-300 shrink-0" strokeWidth={2.5} />
          <span className="truncate">{a.alias_name}</span>
        </div>
        {a.disabled_reason && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-clay-pill text-[11px] font-black bg-amber-100 text-amber-700 shadow-clay shrink-0">
            <AlertTriangle className="w-3 h-3" />
            已禁用
          </span>
        )}
      </div>
      <div className="flex items-center gap-2 text-xs mb-3 min-w-0 flex-wrap">
        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-clay-pill bg-clay-purple-100 text-[#6b4d83] shadow-clay shrink-0">
          <Layers className="w-3 h-3" strokeWidth={2.5} />
          <span className="text-xs font-black">{a.source_group}</span>
        </span>
        <ArrowRight className="w-4 h-4 text-clay-faint shrink-0" strokeWidth={3} />
        <span
          className="inline-flex items-center gap-1.5 font-mono text-xs font-black bg-clay-yellow-100 text-[#8a6a32] shadow-clay px-2.5 py-1 rounded-clay-pill flex-1 min-w-0 truncate"
          title={a.source_model}
        >
          <Cpu className="w-3 h-3 shrink-0" strokeWidth={2.5} />
          <span className="truncate">{a.source_model}</span>
        </span>
      </div>
      {a.disabled_reason && (
        <div className="text-[11px] text-amber-700 mb-2 break-words font-bold">{a.disabled_reason}</div>
      )}
      <div className="flex items-center justify-end gap-1">
        <button onClick={onEdit} className="p-1.5 rounded-clay-sm hover:bg-white/40 transition-colors" title="编辑">
          <Pencil className="w-4 h-4 text-clay-faint" />
        </button>
        <button onClick={onDelete} className="p-1.5 rounded-clay-sm hover:bg-clay-pink-100/40 transition-colors" title="删除">
          <Trash2 className="w-4 h-4 text-clay-pink-400" />
        </button>
      </div>
    </div>
  )
}

export default function ArchiveDetail() {
  const toast = useToast()
  const navigate = useNavigate()
  const isMobile = useIsMobile()
  const { id } = useParams()
  const archiveId = parseInt(id, 10)

  const [archive, setArchive] = useState(null)
  const [aliases, setAliases] = useState([])
  const [loading, setLoading] = useState(false)
  const [options, setOptions] = useState({ groups: [] })

  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({ alias_name: '', source_group: '', source_model: '' })
  const [saving, setSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await getArchive(archiveId)
      if (!res?.success) throw new Error(res?.message ?? '加载失败')
      setArchive(res.data?.archive)
      setAliases(res.data?.aliases ?? [])
    } catch (e) {
      toast(e?.response?.data?.message ?? e.message ?? '加载失败', 'error')
    } finally {
      setLoading(false)
    }
  }, [archiveId, toast])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    getArchiveOptions().then((res) => {
      setOptions(res?.data ?? { groups: [] })
    }).catch(() => {})
  }, [])

  const groupOptions = useMemo(() => (
    (options.groups || []).map((g) => ({
      value: g.name,
      label: g.name,
      subtitle: g.description || g.name,
    }))
  ), [options.groups])

  const modelOptions = useMemo(() => {
    const grp = (options.groups || []).find((g) => g.name === form.source_group)
    const models = grp?.models || []
    return models.map((m) => ({ value: m, label: m }))
  }, [options.groups, form.source_group])

  const openCreate = () => {
    setEditing(null)
    const firstGroup = groupOptions[0]?.value || ''
    setForm({ alias_name: '', source_group: firstGroup, source_model: '' })
    setShowModal(true)
  }

  const openEdit = (al) => {
    setEditing(al)
    setForm({
      alias_name: al.alias_name,
      source_group: al.source_group,
      source_model: al.source_model,
    })
    setShowModal(true)
  }

  const onSave = async () => {
    if (!form.source_group) { toast('请选择源分组', 'error'); return }
    if (!form.source_model) { toast('请选择源模型', 'error'); return }
    setSaving(true)
    try {
      if (editing) {
        const res = await updateAlias(archiveId, editing.id, form)
        if (!res?.success) throw new Error(res?.message ?? '更新失败')
        toast('已更新')
      } else {
        const res = await createAlias(archiveId, form)
        if (!res?.success) throw new Error(res?.message ?? '创建失败')
        // Surface the actual alias_name in case backend auto-prefixed on collision.
        const finalName = res?.data?.alias_name
        if (finalName && finalName !== (form.alias_name.trim() || form.source_model)) {
          toast(`已创建，因冲突自动重命名为「${finalName}」`)
        } else {
          toast('已创建')
        }
      }
      setShowModal(false)
      load()
    } catch (e) {
      toast(e?.response?.data?.message ?? e.message ?? '操作失败', 'error')
    } finally {
      setSaving(false)
    }
  }

  const onDelete = async (al) => {
    if (!confirm(`确认删除别名「${al.alias_name}」？`)) return
    try {
      const res = await deleteAlias(archiveId, al.id)
      if (!res?.success) throw new Error(res?.message ?? '删除失败')
      toast('已删除')
      load()
    } catch (e) {
      toast(e?.response?.data?.message ?? e.message ?? '删除失败', 'error')
    }
  }

  const onToggleShare = async () => {
    try {
      if (archive?.share_enabled) {
        const res = await disableArchiveShare(archiveId)
        if (!res?.success) throw new Error(res?.message ?? '操作失败')
        toast('已关闭分享')
      } else {
        const res = await enableArchiveShare(archiveId)
        if (!res?.success) throw new Error(res?.message ?? '操作失败')
        toast('分享已开启')
      }
      load()
    } catch (e) {
      toast(e?.response?.data?.message ?? e.message ?? '操作失败', 'error')
    }
  }

  const copyShareCode = async () => {
    if (!archive?.share_code) return
    try {
      await copyTextToClipboard(archive.share_code)
      toast('分享码已复制')
    } catch (_) {
      toast('复制失败，请手动复制', 'error')
    }
  }

  const copyShareLink = async () => {
    if (!archive?.share_code) return
    const link = `${window.location.origin}/archives/share/${archive.share_code}`
    try {
      await copyTextToClipboard(link)
      toast('分享链接已复制')
    } catch (_) {
      toast('复制失败，请手动复制', 'error')
    }
  }

  return (
    <ClayConsoleShell
      title={archive?.name || '存档详情'}
      subtitle={archive?.description}
      compactHeader
      actions={
        <ClayButton variant="primary" onClick={openCreate}>
          <Plus className="w-4 h-4" /> 新建别名
        </ClayButton>
      }
    >
      <div className="mb-4">
        <ClayButton variant="ghost" onClick={() => navigate('/archives')}>
          <ChevronLeft className="w-4 h-4" /> 返回存档列表
        </ClayButton>
      </div>

      {archive && (
        <ClayCard className="!p-5 mb-6">
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-12 h-12 rounded-full shadow-clay bg-clay-blue-100 flex items-center justify-center shrink-0">
                <Layers className="w-5 h-5 text-clay-blue-300" />
              </div>
              <div className="min-w-0">
                <div className="font-bold text-base">{archive.name}</div>
                <div className="text-xs text-clay-faint mt-0.5 flex items-center gap-1">
                  <Hash className="w-3 h-3" />
                  <span className="font-mono">{archive.slug}</span>
                </div>
              </div>
            </div>

            <div className="rounded-clay bg-clay-bg p-4 shadow-clay-inset w-full sm:w-auto sm:min-w-[280px]">
              <div className="flex items-center justify-between gap-3 mb-2">
                <div className="flex items-center gap-2 text-sm font-black">
                  <Share2 className="w-4 h-4 text-clay-blue-300" />
                  分享
                </div>
                <button type="button" onClick={onToggleShare} className="p-0.5 shrink-0">
                  {archive.share_enabled
                    ? <ToggleRight className="w-7 h-7 text-emerald-500" />
                    : <ToggleLeft className="w-7 h-7 text-gray-400" />}
                </button>
              </div>
              {archive.share_enabled && archive.share_code && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 bg-white/50 rounded-clay-sm px-3 py-2">
                    <code className="text-xs flex-1 font-mono truncate">{archive.share_code}</code>
                    <button onClick={copyShareCode} className="p-1 rounded-clay-sm hover:bg-white/40 transition-colors shrink-0" title="复制分享码">
                      <Copy className="w-3.5 h-3.5 text-clay-faint" />
                    </button>
                  </div>
                  <ClayButton variant="ghost" className="w-full" onClick={copyShareLink}>
                    <Copy className="w-3.5 h-3.5" /> 复制分享链接
                  </ClayButton>
                </div>
              )}
              {!archive.share_enabled && (
                <p className="text-[11px] text-clay-faint mt-1">
                  开启后会生成短码和链接，别人可以预览并导入到自己的账户。
                </p>
              )}
            </div>
          </div>
        </ClayCard>
      )}

      {loading && (
        <ClayCard className="!py-12 text-center">
          <div className="flex flex-col items-center gap-3">
            <RefreshCw className="w-8 h-8 text-clay-faint animate-spin" />
            <span className="text-clay-faint font-bold">加载中…</span>
          </div>
        </ClayCard>
      )}

      {!loading && aliases.length === 0 && (
        <ClayCard className="!py-12 text-center">
          <div className="flex flex-col items-center gap-3">
            <Layers className="w-10 h-10 text-clay-faint/50" />
            <span className="text-clay-faint font-bold">还没有别名</span>
            <ClayButton variant="primary" onClick={openCreate}>
              <Plus className="w-4 h-4" /> 新建别名
            </ClayButton>
          </div>
        </ClayCard>
      )}

      {!loading && aliases.length > 0 && (
        <div className={isMobile ? 'space-y-3' : 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3'}>
          {aliases.map((a) => (
            <AliasCard
              key={a.id}
              a={a}
              onEdit={() => openEdit(a)}
              onDelete={() => onDelete(a)}
            />
          ))}
        </div>
      )}

      <ClayModal open={showModal} onClose={() => setShowModal(false)} title={editing ? '编辑别名' : '新建别名'} size="md">
        {(() => {
          // Effective alias: what would actually be stored if the user saves now.
          const effectiveAlias = (form.alias_name || '').trim() || form.source_model || ''
          // Collision: same alias_name already exists in this archive (excluding the one being edited).
          const collision = effectiveAlias && aliases.some((a) => (
            a.alias_name === effectiveAlias && (!editing || a.id !== editing.id)
          ))
          const autoPrefixed = collision && form.source_group
            ? `${form.source_group}/${effectiveAlias}`
            : ''
          return (
            <div className="space-y-4">
              <div>
                <label className="block ml-4 mb-2 font-bold text-sm text-clay-ink">别名</label>
                <ClayField
                  value={form.alias_name}
                  onChange={(e) => setForm({ ...form, alias_name: e.target.value })}
                  placeholder={form.source_model || '留空则使用源模型名'}
                  hint="支持中文、字母、数字、下划线、点、冒号、斜杠、连字符；不能含 '@' 或空格"
                  maxLength={64}
                  className="!mb-0"
                />
              </div>
              <div>
                <label className="block ml-4 mb-2 font-bold text-sm text-clay-ink">源分组</label>
                <ClaySelect
                  value={form.source_group}
                  onChange={(v) => setForm({ ...form, source_group: v, source_model: '' })}
                  options={groupOptions}
                  placeholder="选择分组"
                />
              </div>
              <div>
                <label className="block ml-4 mb-2 font-bold text-sm text-clay-ink">源模型</label>
                <ClaySelect
                  value={form.source_model}
                  onChange={(v) => setForm({ ...form, source_model: v })}
                  options={modelOptions}
                  placeholder={form.source_group ? '选择模型' : '请先选择分组'}
                  disabled={!form.source_group}
                />
              </div>
              {collision && autoPrefixed && (
                <div className="rounded-clay-sm bg-amber-100/60 px-3 py-2 text-xs text-amber-700">
                  存档内已存在「{effectiveAlias}」，保存后将自动重命名为「{autoPrefixed}」。
                </div>
              )}
            </div>
          )
        })()}
        <div className="flex flex-col-reverse items-stretch gap-3 mt-6 sm:flex-row sm:items-center sm:justify-end">
          <ClayButton variant="ghost" onClick={() => setShowModal(false)}>取消</ClayButton>
          <ClayButton variant="primary" onClick={onSave} disabled={saving}>{saving ? '保存中…' : '保存'}</ClayButton>
        </div>
      </ClayModal>
    </ClayConsoleShell>
  )
}
