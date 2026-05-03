import { useEffect, useState, useCallback, useSyncExternalStore } from 'react'
import {
  KeyRound, Plus, Search, Copy, Trash2, Eye, EyeOff,
  ToggleLeft, ToggleRight, Pencil, ChevronLeft, ChevronRight,
  Clock, Shield, Layers, Infinity, RefreshCw,
} from 'lucide-react'
import ClayCard from '../components/clay/ClayCard.jsx'
import ClayButton from '../components/clay/ClayButton.jsx'
import ClayField from '../components/clay/ClayField.jsx'
import ClaySelect from '../components/clay/ClaySelect.jsx'
import ClayModal from '../components/clay/ClayModal.jsx'
import ClayAlert from '../components/clay/ClayAlert.jsx'
import ClayConsoleShell from '../components/layout/ClayConsoleShell.jsx'
import { useToast } from '../context/ToastContext.jsx'
import { quotaToDisplay, displayToQuota } from '../utils/quota.js'
import {
  listTokens, addToken, updateToken, updateTokenStatus,
  deleteToken, getTokenKey, getUserGroups,
} from '../services/tokens.js'
import { copyTextToClipboard } from '../utils/clipboard.js'

const mobileQuery = typeof window !== 'undefined' ? window.matchMedia('(max-width: 767px)') : null
function useIsMobile() {
  return useSyncExternalStore(
    (cb) => { mobileQuery?.addEventListener('change', cb); return () => mobileQuery?.removeEventListener('change', cb) },
    () => mobileQuery?.matches ?? false,
  )
}

const STATUS_MAP = {
  1: { label: '已启用', cls: 'bg-emerald-100 text-emerald-700' },
  2: { label: '已禁用', cls: 'bg-gray-200 text-gray-600' },
  3: { label: '已过期', cls: 'bg-amber-100 text-amber-700' },
  4: { label: '已耗尽', cls: 'bg-red-100 text-red-600' },
}

function fmtTime(ts) {
  if (!ts || ts <= 0) return '永不过期'
  return new Date(ts * 1000).toLocaleString('zh-CN', {
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  })
}

function fmtCreated(ts) {
  if (!ts || ts <= 0) return '-'
  return new Date(ts * 1000).toLocaleString('zh-CN', {
    month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  })
}

function parseModels(str) {
  if (!str) return []
  try {
    const arr = JSON.parse(str)
    return Array.isArray(arr) ? arr : []
  } catch (_) {
    return str.split(',').map((s) => s.trim()).filter(Boolean)
  }
}

function TokenCard({ t, revealedKeys, onRevealKey, onCopyKey, onToggleStatus, openEdit, onDelete }) {
  const st = STATUS_MAP[t.status] ?? STATUS_MAP[2]
  const revealed = revealedKeys[t.id]
  const group = t.group || '-'
  const models = parseModels(t.model_limits)

  return (
    <div className="clay-card-interactive !p-5 !rounded-clay">
      {/* Row 1: icon + name + status */}
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-9 h-9 rounded-full shadow-clay bg-clay-blue-100 flex items-center justify-center shrink-0">
            <KeyRound className="w-4 h-4 text-clay-blue-300" />
          </div>
          <div className="min-w-0">
            <div className="font-bold text-sm truncate max-w-[160px]">{t.name}</div>
            {t.model_limits_enabled && models.length > 0 && (
              <div className="text-[11px] text-clay-faint mt-0.5">
                <Shield className="w-3 h-3 inline mr-0.5 -mt-0.5" />
                限 {models.length} 个模型
              </div>
            )}
          </div>
        </div>
        <span className={`text-[11px] font-extrabold px-2.5 py-0.5 rounded-clay-pill shrink-0 ${st.cls}`}>{st.label}</span>
      </div>

      {/* Row 2: key */}
      <div className="bg-clay-bg shadow-clay-inset rounded-clay-sm px-3 py-2.5 mb-3 flex items-center gap-2">
        <code className="text-xs flex-1 truncate">
          {revealed || (t.key ? `sk-${t.key}` : '***')}
        </code>
        <button onClick={() => onRevealKey(t)} className="p-1 rounded-clay-sm hover:bg-white/40 transition-colors shrink-0" title={revealed ? '隐藏' : '显示'}>
          {revealed ? <EyeOff className="w-3.5 h-3.5 text-clay-faint" /> : <Eye className="w-3.5 h-3.5 text-clay-faint" />}
        </button>
        <button onClick={() => onCopyKey(t)} className="p-1 rounded-clay-sm hover:bg-white/40 transition-colors shrink-0" title="复制">
          <Copy className="w-3.5 h-3.5 text-clay-faint" />
        </button>
      </div>

      {/* Row 3: quota */}
      <div className="flex items-center justify-between gap-3 mb-3 text-xs">
        <span className="text-clay-faint font-bold">额度</span>
        <div className="font-mono">
          <span className="font-bold">{quotaToDisplay(t.used_quota ?? 0).text}</span>
          <span className="text-clay-faint mx-1">/</span>
          {t.unlimited_quota
            ? <span className="inline-flex items-center gap-0.5 text-emerald-600"><Infinity className="w-3.5 h-3.5" /></span>
            : <span className="text-clay-faint">{quotaToDisplay(t.remain_quota ?? 0).text}</span>
          }
        </div>
      </div>

      {/* Row 4: group + time + actions */}
      <div className="flex items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2">
          {group !== '-' ? (
            <span className="px-2 py-0.5 rounded-clay-sm text-[11px] font-bold bg-clay-bg shadow-clay-inset text-clay-faint">
              {group}
            </span>
          ) : (
            <span className="text-clay-faint">默认</span>
          )}
          <span className="text-clay-faint flex items-center gap-1">
            <Clock className="w-3 h-3" />
            <span className={t.expired_time > 0 && t.expired_time * 1000 < Date.now() ? 'text-red-500' : ''}>
              {fmtTime(t.expired_time)}
            </span>
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => onToggleStatus(t)} className="p-1.5 rounded-clay-sm hover:bg-white/40 transition-colors" title={t.status === 1 ? '禁用' : '启用'}>
            {t.status === 1
              ? <ToggleRight className="w-4 h-4 text-emerald-500" />
              : <ToggleLeft className="w-4 h-4 text-gray-400" />}
          </button>
          <button onClick={() => openEdit(t)} className="p-1.5 rounded-clay-sm hover:bg-white/40 transition-colors" title="编辑">
            <Pencil className="w-4 h-4 text-clay-faint" />
          </button>
          <button onClick={() => onDelete(t)} className="p-1.5 rounded-clay-sm hover:bg-clay-pink-100/40 transition-colors" title="删除">
            <Trash2 className="w-4 h-4 text-clay-pink-400" />
          </button>
        </div>
      </div>
    </div>
  )
}

export default function TokenManage() {
  const toast = useToast()
  const isMobile = useIsMobile()
  const [tokens, setTokens] = useState([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [keyword, setKeyword] = useState('')
  const [loading, setLoading] = useState(false)

  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({ name: '', remain_quota: 0, expired_time: -1, unlimited_quota: true, group: '', display_amount: '' })
  const [saving, setSaving] = useState(false)
  const [groupOptions, setGroupOptions] = useState([])

  const [revealedKeys, setRevealedKeys] = useState({})
  const [expandedRow, setExpandedRow] = useState(null)

  const pageSize = 20

  const load = useCallback(async (p, kw) => {
    setLoading(true)
    try {
      const res = await listTokens({ p, size: pageSize, keyword: kw })
      const data = res?.data
      setTokens(data?.items ?? data ?? [])
      setTotal(data?.total ?? 0)
    } catch (e) {
      toast(e?.response?.data?.message ?? '加载失败', 'error')
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => { load(page, keyword) }, [page]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    getUserGroups().then((res) => {
      const data = res?.data
      if (data && typeof data === 'object') {
        const opts = Object.entries(data).map(([k, v]) => ({
          value: k,
          label: k,
          subtitle: v.desc || k,
          extra: v.ratio != null ? `${v.ratio}x 倍率` : undefined,
        }))
        setGroupOptions(opts)
      }
    }).catch(() => {})
  }, [])

  const onSearch = (e) => {
    e.preventDefault()
    setPage(1)
    load(1, keyword)
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  const openCreate = () => {
    setEditing(null)
    const defaultGroup = groupOptions.find((o) => o.value === 'default') ? 'default' : (groupOptions[0]?.value || '')
    setForm({ name: '', remain_quota: 0, expired_time: -1, unlimited_quota: true, group: defaultGroup, display_amount: '' })
    setShowModal(true)
  }

  const openEdit = (t) => {
    setEditing(t)
    const da = t.unlimited_quota ? '' : quotaToDisplay(t.remain_quota ?? 0).value.toString()
    setForm({
      name: t.name,
      remain_quota: t.remain_quota,
      expired_time: t.expired_time,
      unlimited_quota: t.unlimited_quota,
      group: t.group || '',
      display_amount: da,
    })
    setShowModal(true)
  }

  const onSave = async () => {
    if (!form.name.trim()) { toast('请输入令牌名称', 'error'); return }
    setSaving(true)
    const payload = {
      name: form.name,
      expired_time: form.expired_time,
      unlimited_quota: form.unlimited_quota,
      remain_quota: form.unlimited_quota ? 0 : displayToQuota(parseFloat(form.display_amount) || 0),
      group: form.group,
    }
    try {
      if (editing) {
        const res = await updateToken({ id: editing.id, ...payload })
        if (!res?.success) throw new Error(res?.message ?? '更新失败')
        toast('令牌已更新')
      } else {
        const res = await addToken(payload)
        if (!res?.success) throw new Error(res?.message ?? '创建失败')
        toast('令牌已创建')
      }
      setShowModal(false)
      load(page, keyword)
    } catch (e) {
      toast(e?.response?.data?.message ?? e.message ?? '操作失败', 'error')
    } finally {
      setSaving(false)
    }
  }

  const onToggleStatus = async (t) => {
    const newStatus = t.status === 1 ? 2 : 1
    try {
      const res = await updateTokenStatus({ id: t.id, status: newStatus })
      if (!res?.success) throw new Error(res?.message ?? '操作失败')
      toast(newStatus === 1 ? '已启用' : '已禁用')
      load(page, keyword)
    } catch (e) {
      toast(e?.response?.data?.message ?? e.message ?? '操作失败', 'error')
    }
  }

  const onDelete = async (t) => {
    if (!confirm(`确认删除令牌「${t.name}」？`)) return
    try {
      const res = await deleteToken(t.id)
      if (!res?.success) throw new Error(res?.message ?? '删除失败')
      toast('令牌已删除')
      load(page, keyword)
    } catch (e) {
      toast(e?.response?.data?.message ?? e.message ?? '删除失败', 'error')
    }
  }

  const onRevealKey = async (t) => {
    if (revealedKeys[t.id]) {
      setRevealedKeys((p) => { const n = { ...p }; delete n[t.id]; return n })
      return
    }
    try {
      const res = await getTokenKey(t.id)
      if (res?.data?.key) {
        setRevealedKeys((p) => ({ ...p, [t.id]: `sk-${res.data.key}` }))
      }
    } catch (e) {
      toast('获取密钥失败', 'error')
    }
  }

  const onCopyKey = async (t) => {
    let key = revealedKeys[t.id]
    if (!key) {
      try {
        const res = await getTokenKey(t.id)
        key = res?.data?.key ? `sk-${res.data.key}` : null
      } catch (_) {}
    }
    if (key) {
      try {
        await copyTextToClipboard(key)
        toast('已复制到剪贴板')
      } catch (e) {
        toast('复制失败，请手动复制', 'error')
      }
    } else {
      toast('获取密钥失败', 'error')
    }
  }

  return (
    <ClayConsoleShell
      title="令牌管理"
      subtitle="创建和管理 API 访问令牌"
      actions={
        <ClayButton variant="primary" onClick={openCreate}>
          <Plus className="w-4 h-4" /> 新建令牌
        </ClayButton>
      }
    >
      {/* Search */}
      <form onSubmit={onSearch} className="flex gap-3 mb-6 max-w-md">
        <ClayField
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          placeholder="搜索令牌名称…"
          className="flex-1"
        />
        <ClayButton type="submit" variant="ghost">
          <Search className="w-4 h-4" />
        </ClayButton>
      </form>

      {/* Table (desktop) / Cards (mobile) */}
      {isMobile ? (
        <div className="space-y-3">
          {loading && (
            <ClayCard className="!py-12 text-center">
              <div className="flex flex-col items-center gap-3">
                <RefreshCw className="w-8 h-8 text-clay-faint animate-spin" />
                <span className="text-clay-faint font-bold">加载中…</span>
              </div>
            </ClayCard>
          )}
          {!loading && tokens.length === 0 && (
            <ClayCard className="!py-12 text-center">
              <div className="flex flex-col items-center gap-3">
                <KeyRound className="w-10 h-10 text-clay-faint/50" />
                <span className="text-clay-faint font-bold">暂无令牌</span>
              </div>
            </ClayCard>
          )}
          {!loading && tokens.map((t) => (
            <TokenCard
              key={t.id}
              t={t}
              revealedKeys={revealedKeys}
              onRevealKey={onRevealKey}
              onCopyKey={onCopyKey}
              onToggleStatus={onToggleStatus}
              openEdit={openEdit}
              onDelete={onDelete}
            />
          ))}
        </div>
      ) : (
      <ClayCard className="!p-0 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-black/5 text-left text-clay-faint">
              <th className="px-5 py-3 font-bold">名称</th>
              <th className="px-5 py-3 font-bold">密钥</th>
              <th className="px-5 py-3 font-bold">状态</th>
              <th className="px-5 py-3 font-bold text-right">已用 / 剩余额度</th>
              <th className="px-5 py-3 font-bold">分组</th>
              <th className="px-5 py-3 font-bold">创建 / 过期</th>
              <th className="px-5 py-3 font-bold text-right">操作</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={7} className="px-5 py-12 text-center text-clay-faint">加载中…</td></tr>
            )}
            {!loading && tokens.length === 0 && (
              <tr><td colSpan={7} className="px-5 py-12 text-center text-clay-faint">暂无令牌</td></tr>
            )}
            {!loading && tokens.map((t) => {
              const st = STATUS_MAP[t.status] ?? STATUS_MAP[2]
              const revealed = revealedKeys[t.id]
              const group = t.group || '-'
              const models = parseModels(t.model_limits)
              const isExpanded = expandedRow === t.id

              return (
                <tr
                  key={t.id}
                  className="border-b border-black/5 last:border-0 hover:bg-white/30 transition-colors group/row cursor-pointer"
                  onClick={() => setExpandedRow(isExpanded ? null : t.id)}
                >
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full shadow-clay bg-clay-blue-100 flex items-center justify-center shrink-0">
                        <KeyRound className="w-4 h-4 text-clay-blue-300" />
                      </div>
                      <div className="min-w-0">
                        <div className="font-bold text-sm truncate max-w-[160px]">{t.name}</div>
                        {t.model_limits_enabled && models.length > 0 && (
                          <div className="text-[11px] text-clay-faint mt-0.5">
                            <Shield className="w-3 h-3 inline mr-0.5 -mt-0.5" />
                            限 {models.length} 个模型
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center gap-1.5">
                      <code className="text-xs bg-clay-bg px-2 py-1 rounded-clay-sm max-w-[180px] truncate shadow-clay-inset">
                        {revealed || (t.key ? `sk-${t.key}` : '***')}
                      </code>
                      <button onClick={() => onRevealKey(t)} className="p-1 rounded-clay-sm hover:bg-white/40 transition-colors" title={revealed ? '隐藏' : '显示'}>
                        {revealed ? <EyeOff className="w-3.5 h-3.5 text-clay-faint" /> : <Eye className="w-3.5 h-3.5 text-clay-faint" />}
                      </button>
                      <button onClick={() => onCopyKey(t)} className="p-1 rounded-clay-sm hover:bg-white/40 transition-colors" title="复制">
                        <Copy className="w-3.5 h-3.5 text-clay-faint" />
                      </button>
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${st.cls}`}>{st.label}</span>
                  </td>
                  <td className="px-5 py-3 text-right">
                    <div className="font-mono text-xs">
                      <span className="font-bold">{quotaToDisplay(t.used_quota ?? 0).text}</span>
                      <span className="text-clay-faint mx-1">/</span>
                      {t.unlimited_quota
                        ? <span className="inline-flex items-center gap-0.5 text-emerald-600"><Infinity className="w-3.5 h-3.5" /></span>
                        : <span className="text-clay-faint">{quotaToDisplay(t.remain_quota ?? 0).text}</span>
                      }
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    {group !== '-' ? (
                      <span className="px-2 py-0.5 rounded-clay-sm text-[11px] font-bold bg-clay-bg shadow-clay-inset text-clay-faint">
                        {group}
                      </span>
                    ) : (
                      <span className="text-clay-faint text-xs">默认</span>
                    )}
                  </td>
                  <td className="px-5 py-3">
                    <div className="text-xs space-y-0.5">
                      <div className="text-clay-faint">{fmtCreated(t.created_time)}</div>
                      <div className="flex items-center gap-1">
                        <Clock className="w-3 h-3 text-clay-faint" />
                        <span className={t.expired_time > 0 && t.expired_time * 1000 < Date.now() ? 'text-red-500' : 'text-clay-faint'}>
                          {fmtTime(t.expired_time)}
                        </span>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => onToggleStatus(t)} className="p-1.5 rounded-clay-sm hover:bg-white/40 transition-colors" title={t.status === 1 ? '禁用' : '启用'}>
                        {t.status === 1
                          ? <ToggleRight className="w-4 h-4 text-emerald-500" />
                          : <ToggleLeft className="w-4 h-4 text-gray-400" />}
                      </button>
                      <button onClick={() => openEdit(t)} className="p-1.5 rounded-clay-sm hover:bg-white/40 transition-colors" title="编辑">
                        <Pencil className="w-4 h-4 text-clay-faint" />
                      </button>
                      <button onClick={() => onDelete(t)} className="p-1.5 rounded-clay-sm hover:bg-clay-pink-100/40 transition-colors" title="删除">
                        <Trash2 className="w-4 h-4 text-clay-pink-400" />
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </ClayCard>
      )}

      {/* Summary + Pagination */}
      <div className="flex items-center justify-between mt-6">
        <span className="text-sm text-clay-faint font-bold">共 {total} 个令牌</span>
        {totalPages > 1 && (
          <div className="flex items-center gap-3">
            <ClayButton variant="ghost" disabled={page <= 1} onClick={() => setPage(page - 1)}>
              <ChevronLeft className="w-4 h-4" />
            </ClayButton>
            <span className="text-sm font-extrabold bg-clay-bg shadow-clay-inset px-4 py-1.5 rounded-clay-pill">{page} / {totalPages}</span>
            <ClayButton variant="ghost" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
              <ChevronRight className="w-4 h-4" />
            </ClayButton>
          </div>
        )}
      </div>

      {/* Create / Edit Modal */}
      <ClayModal open={showModal} onClose={() => setShowModal(false)} title={editing ? '编辑令牌' : '新建令牌'} size="md">
        <div className="space-y-4">
          <ClayField label="名称" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="我的令牌" maxLength={50} />
          {groupOptions.length > 0 && (
            <div>
              <label className="block ml-4 mb-2 font-bold text-sm text-clay-ink">分组</label>
              <ClaySelect
                value={form.group}
                onChange={(v) => setForm({ ...form, group: v })}
                options={groupOptions}
                placeholder="选择分组"
              />
            </div>
          )}
          <div className="flex items-center gap-3">
            <label className="text-sm font-bold">无限额度</label>
            <button type="button" onClick={() => setForm({ ...form, unlimited_quota: !form.unlimited_quota })} className="p-0.5">
              {form.unlimited_quota
                ? <ToggleRight className="w-6 h-6 text-emerald-500" />
                : <ToggleLeft className="w-6 h-6 text-gray-400" />}
            </button>
          </div>
          {!form.unlimited_quota && (
            <ClayField
              label="余额"
              type="number"
              step="0.01"
              value={form.display_amount}
              onChange={(e) => setForm({ ...form, display_amount: e.target.value })}
              hint={`内部额度: ${displayToQuota(parseFloat(form.display_amount) || 0).toLocaleString()}`}
              placeholder="0.00"
            />
          )}
          <ClayField
            label="过期时间"
            type="datetime-local"
            value={form.expired_time > 0 ? new Date(form.expired_time * 1000).toISOString().slice(0, 16) : ''}
            onChange={(e) => {
              const v = e.target.value
              setForm({ ...form, expired_time: v ? Math.floor(new Date(v).getTime() / 1000) : -1 })
            }}
            hint="留空表示永不过期"
          />
        </div>
        <div className="flex justify-end gap-3 mt-6">
          <ClayButton variant="ghost" onClick={() => setShowModal(false)}>取消</ClayButton>
          <ClayButton variant="primary" onClick={onSave} disabled={saving}>{saving ? '保存中…' : '保存'}</ClayButton>
        </div>
      </ClayModal>
    </ClayConsoleShell>
  )
}
