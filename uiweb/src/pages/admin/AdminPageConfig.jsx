import { useEffect, useMemo, useState } from 'react'
import {
  ArrowDown,
  ArrowUp,
  Globe2,
  Link2,
  Loader2,
  Plus,
  RefreshCw,
  Save,
  Trash2,
  Zap,
} from 'lucide-react'
import ClayAlert from '../../components/clay/ClayAlert.jsx'
import ClayButton from '../../components/clay/ClayButton.jsx'
import ClayCard from '../../components/clay/ClayCard.jsx'
import ClayInput from '../../components/clay/ClayInput.jsx'
import ClaySelect from '../../components/clay/ClaySelect.jsx'
import ClayToggle from '../../components/clay/ClayToggle.jsx'
import ClayAdminShell from '../../components/layout/ClayAdminShell.jsx'
import { useToast } from '../../context/ToastContext.jsx'
import { adminGetPageConfig, adminSavePageConfig } from '../../services/pageConfig.js'

const toneOptions = [
  { value: 'pink', label: '桃粉' },
  { value: 'blue', label: '湖蓝' },
  { value: 'green', label: '薄荷' },
  { value: 'yellow', label: '暖黄' },
]

const iconOptions = [
  { value: 'globe', label: '全球' },
  { value: 'zap', label: '加速' },
  { value: 'link', label: '链接' },
]

function makeId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID()
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

function newUrlRow() {
  return {
    local_id: makeId(),
    url: '',
    label: '',
    desc: '',
    icon: 'link',
    tone: 'blue',
    enabled: true,
  }
}

function badgeRowFromItem(item, index) {
  return {
    local_id: makeId(),
    key: item?.key || ['default', 'standard', 'pro', 'super', 'ultra'][index] || '',
    label: item?.label || '',
    short_label: item?.short_label || item?.shortLabel || '',
    tagline: item?.tagline || '',
  }
}

function rowFromItem(item, index) {
  return {
    local_id: makeId(),
    url: item?.url || '',
    label: item?.label || `地址 ${index + 1}`,
    desc: item?.desc || '',
    icon: iconOptions.some((option) => option.value === item?.icon) ? item.icon : 'link',
    tone: toneOptions.some((option) => option.value === item?.tone) ? item.tone : 'blue',
    enabled: item?.enabled !== false,
  }
}

function payloadFromRows(rows) {
  return rows.map(({ local_id: _, ...row }) => ({
    ...row,
    url: row.url.trim(),
    label: row.label.trim(),
    desc: row.desc.trim(),
  }))
}

function badgePayloadFromRows(rows) {
  return rows.map(({ local_id: _, ...row }) => ({
    ...row,
    key: row.key.trim(),
    label: row.label.trim(),
    short_label: row.short_label.trim(),
    tagline: row.tagline.trim(),
  }))
}

export default function AdminPageConfig() {
  const toast = useToast()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [rows, setRows] = useState([])
  const [badgeRows, setBadgeRows] = useState([])
  const [updatedAt, setUpdatedAt] = useState(0)

  const enabledCount = useMemo(() => rows.filter((item) => item.enabled).length, [rows])

  const fetchData = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await adminGetPageConfig()
      if (res?.success === false) throw new Error(res.message || '页面配置加载失败')
      const list = Array.isArray(res?.data?.api_urls) ? res.data.api_urls : []
      const badges = Array.isArray(res?.data?.membership_badges) ? res.data.membership_badges : []
      setRows(list.map(rowFromItem))
      setBadgeRows(badges.map(badgeRowFromItem))
      setUpdatedAt(res?.data?.updated_at || 0)
    } catch (err) {
      setError(err?.response?.data?.message || err.message || '页面配置加载失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  const updateRow = (id, key, value) => {
    setRows((prev) => prev.map((row) => (row.local_id === id ? { ...row, [key]: value } : row)))
  }

  const updateBadgeRow = (id, key, value) => {
    setBadgeRows((prev) => prev.map((row) => (row.local_id === id ? { ...row, [key]: value } : row)))
  }

  const moveRow = (index, direction) => {
    setRows((prev) => {
      const nextIndex = index + direction
      if (nextIndex < 0 || nextIndex >= prev.length) return prev
      const next = [...prev]
      const [item] = next.splice(index, 1)
      next.splice(nextIndex, 0, item)
      return next
    })
  }

  const deleteRow = (id) => {
    setRows((prev) => prev.filter((row) => row.local_id !== id))
  }

  const save = async () => {
    const payload = payloadFromRows(rows)
    const membershipBadges = badgePayloadFromRows(badgeRows)
    if (payload.length === 0) {
      toast('至少需要配置一个 API 地址', 'warning')
      return
    }
    if (!payload.some((item) => item.enabled)) {
      toast('至少需要启用一个 API 地址', 'warning')
      return
    }
    if (payload.some((item) => !item.url)) {
      toast('API 地址不能为空', 'warning')
      return
    }
    if (membershipBadges.some((item) => !item.key || !item.label || !item.short_label)) {
      toast('会员铭牌名称和短名不能为空', 'warning')
      return
    }
    setSaving(true)
    try {
      const res = await adminSavePageConfig({ api_urls: payload, membership_badges: membershipBadges })
      if (res?.success === false) throw new Error(res.message || '保存失败')
      const list = Array.isArray(res?.data?.api_urls) ? res.data.api_urls : payload
      const badges = Array.isArray(res?.data?.membership_badges) ? res.data.membership_badges : membershipBadges
      setRows(list.map(rowFromItem))
      setBadgeRows(badges.map(badgeRowFromItem))
      setUpdatedAt(res?.data?.updated_at || 0)
      toast('页面配置已保存', 'success')
    } catch (err) {
      toast(err?.response?.data?.message || err.message || '保存失败', 'error')
    } finally {
      setSaving(false)
    }
  }

  const actions = (
    <>
      <ClayButton variant="ghost" onClick={fetchData} className="!px-5">
        <RefreshCw className="w-4 h-4" />
        刷新
      </ClayButton>
      <ClayButton variant="primary" onClick={save} disabled={saving} className="!px-5">
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
        保存配置
      </ClayButton>
    </>
  )

  return (
    <ClayAdminShell
      title="页面配置"
      subtitle="管理新 UI 中需要高频微调的页面内容。"
      actions={actions}
    >
      {error && (
        <ClayAlert tone="error" className="mb-5">
          {error}
        </ClayAlert>
      )}

      {loading ? (
        <div className="flex flex-col items-center gap-3 py-16 text-clay-faint">
          <Loader2 className="w-8 h-8 animate-spin" />
          <p className="font-semibold">加载页面配置中…</p>
        </div>
      ) : (
        <div className="grid gap-5">
          <div className="grid sm:grid-cols-3 gap-4">
            <Stat label="地址总数" value={rows.length} tone="blue" />
            <Stat label="已启用" value={enabledCount} tone="green" />
            <Stat label="最后更新" value={updatedAt ? '已保存' : '默认'} tone="pink" />
          </div>

          <ClayAlert tone="info">
            页面配置会影响用户侧新 UI。API 地址用于 `/api-urls`，会员铭牌会显示在控制台页头、头像角标和会员卡片里。
          </ClayAlert>

          <ClayCard className="!overflow-visible">
            <div className="flex flex-wrap items-center justify-between gap-4 mb-5">
              <div>
                <h2 className="text-2xl font-black tracking-tight">API 地址页</h2>
                <p className="text-sm text-clay-faint font-semibold mt-1">
                  用户在 `/api-urls` 看到的地址会按下方顺序展示，并原样复制。
                </p>
              </div>
              <ClayButton variant="secondary" onClick={() => setRows((prev) => [...prev, newUrlRow()])} className="!px-5">
                <Plus className="w-4 h-4" />
                新增地址
              </ClayButton>
            </div>

            {rows.length === 0 ? (
              <div className="rounded-clay bg-white/45 shadow-clay-inset p-8 text-center text-clay-faint font-bold">
                还没有地址，先新增一个。
              </div>
            ) : (
              <div className="grid gap-4">
                {rows.map((row, index) => (
                  <URLRow
                    key={row.local_id}
                    row={row}
                    index={index}
                    total={rows.length}
                    onChange={updateRow}
                    onMove={moveRow}
                    onDelete={deleteRow}
                  />
                ))}
              </div>
            )}
          </ClayCard>

          <ClayCard className="!overflow-visible">
            <div className="mb-5">
              <h2 className="text-2xl font-black tracking-tight">会员铭牌</h2>
              <p className="text-sm text-clay-faint font-semibold mt-1">
                修改不同会员身份旁边的短描述，不改变真实用户分组和权限。
              </p>
            </div>

            <div className="grid gap-4">
              {badgeRows.map((row) => (
                <MembershipBadgeRow
                  key={row.local_id}
                  row={row}
                  onChange={updateBadgeRow}
                />
              ))}
            </div>
          </ClayCard>
        </div>
      )}
    </ClayAdminShell>
  )
}

function MembershipBadgeRow({ row, onChange }) {
  return (
    <div className="rounded-clay bg-white/45 shadow-clay-inset p-4 md:p-5">
      <div className="grid md:grid-cols-[140px_1fr_140px] gap-4">
        <Field label="分组 key">
          <ClayInput value={row.key} onChange={(e) => onChange(row.local_id, 'key', e.target.value)} placeholder="pro" />
        </Field>
        <Field label="铭牌名称">
          <ClayInput value={row.label} onChange={(e) => onChange(row.local_id, 'label', e.target.value)} placeholder="Pro优" />
        </Field>
        <Field label="短名">
          <ClayInput value={row.short_label} onChange={(e) => onChange(row.local_id, 'short_label', e.target.value)} placeholder="Pro" />
        </Field>
      </div>
      <Field label="描述">
        <textarea
          value={row.tagline}
          onChange={(e) => onChange(row.local_id, 'tagline', e.target.value)}
          placeholder="更优价格与常用高级模型"
          className="clay-input min-h-[72px] resize-y"
        />
      </Field>
    </div>
  )
}

function URLRow({ row, index, total, onChange, onMove, onDelete }) {
  return (
    <div className="rounded-clay bg-white/45 shadow-clay-inset p-4 md:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-3">
          <PreviewIcon icon={row.icon} />
          <div>
            <div className="font-black">地址 {index + 1}</div>
            <div className="text-xs font-bold text-clay-faint">{row.enabled ? '展示中' : '已隐藏'}</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <ClayToggle checked={row.enabled} onChange={(value) => onChange(row.local_id, 'enabled', value)} />
          <IconButton title="上移" disabled={index === 0} onClick={() => onMove(index, -1)}>
            <ArrowUp className="w-4 h-4" />
          </IconButton>
          <IconButton title="下移" disabled={index === total - 1} onClick={() => onMove(index, 1)}>
            <ArrowDown className="w-4 h-4" />
          </IconButton>
          <IconButton title="删除" danger onClick={() => onDelete(row.local_id)}>
            <Trash2 className="w-4 h-4" />
          </IconButton>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <Field label="名称">
          <ClayInput value={row.label} onChange={(e) => onChange(row.local_id, 'label', e.target.value)} placeholder="通用地址" />
        </Field>
        <Field label="URL">
          <ClayInput value={row.url} onChange={(e) => onChange(row.local_id, 'url', e.target.value)} placeholder="https://api.example.com" />
        </Field>
        <Field label="说明">
          <ClayInput value={row.desc} onChange={(e) => onChange(row.local_id, 'desc', e.target.value)} placeholder="直连服务器，全球可访问" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="图标">
            <ClaySelect value={row.icon} options={iconOptions} onChange={(value) => onChange(row.local_id, 'icon', value)} />
          </Field>
          <Field label="色彩">
            <ClaySelect value={row.tone} options={toneOptions} onChange={(value) => onChange(row.local_id, 'tone', value)} />
          </Field>
        </div>
      </div>
    </div>
  )
}

function PreviewIcon({ icon }) {
  const Icon = {
    globe: Globe2,
    zap: Zap,
    link: Link2,
  }[icon] || Link2
  return (
    <div className="w-11 h-11 rounded-full bg-clay-bg shadow-clay flex items-center justify-center shrink-0">
      <Icon className="w-5 h-5 text-clay-faint" strokeWidth={2.5} />
    </div>
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

function IconButton({ title, danger = false, disabled = false, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={`w-10 h-10 rounded-full bg-clay-bg shadow-clay flex items-center justify-center transition-opacity ${
        danger ? 'text-clay-pink-400' : ''
      } ${disabled ? 'opacity-40 cursor-not-allowed' : 'hover:shadow-clay-hover'}`}
    >
      {children}
    </button>
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
      <div className={`text-2xl font-black tabular-nums ${cls}`}>{value}</div>
    </ClayCard>
  )
}
