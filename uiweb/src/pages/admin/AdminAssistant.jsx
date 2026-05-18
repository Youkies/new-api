import { useEffect, useMemo, useState } from 'react'
import {
  Edit3,
  Loader2,
  Plus,
  RefreshCw,
  Save,
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
  adminCreateAssistantDocument,
  adminDeleteAssistantDocument,
  adminGetAssistantConfig,
  adminListAssistantDocuments,
  adminListAssistantSessions,
  adminSaveAssistantConfig,
  adminUpdateAssistantDocument,
} from '../../services/assistant.js'

const providerOptions = [
  { value: 'site', label: '站内助手账号' },
  { value: 'external', label: '外部自定义' },
]

const emptyDoc = {
  title: '',
  content: '',
  enabled: true,
  sort_order: 0,
}

function getItems(res) {
  return res?.data?.items ?? res?.data ?? []
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

function formFromConfig(config) {
  return {
    enabled: Boolean(config?.enabled),
    assistant_name: config?.assistant_name || 'Youkies 的 AI 分身',
    welcome_message: config?.welcome_message || '',
    provider_type: config?.provider_type || 'site',
    base_url: config?.base_url || '',
    api_key: '',
    clear_api_key: false,
    model_name: config?.model_name || 'gpt-5.4-mini',
    system_prompt: config?.system_prompt || '',
    allow_screenshot: config?.allow_screenshot !== false,
    knowledge_enabled: config?.knowledge_enabled !== false,
    store_sessions: config?.store_sessions !== false,
    daily_limit: config?.daily_limit || 8,
    max_image_kb: Math.round((config?.max_image_bytes || 800 * 1024) / 1024),
  }
}

function configPayload(form) {
  return {
    ...form,
    daily_limit: Math.min(8, Math.max(1, Number(form.daily_limit) || 8)),
    max_image_bytes: Math.max(128, Number(form.max_image_kb) || 800) * 1024,
  }
}

function decisionLabel(decision) {
  return {
    self_solve: '自助',
    submit_appeal: '申诉',
    manual_review: '人工',
    insufficient_info: '不足',
  }[decision] || decision || '-'
}

export default function AdminAssistant() {
  const toast = useToast()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [config, setConfig] = useState(null)
  const [form, setForm] = useState(formFromConfig(null))
  const [docs, setDocs] = useState([])
  const [sessions, setSessions] = useState([])
  const [docModalOpen, setDocModalOpen] = useState(false)
  const [editingDoc, setEditingDoc] = useState(null)
  const [docForm, setDocForm] = useState(emptyDoc)

  const fetchData = async () => {
    setLoading(true)
    setError('')
    try {
      const [configRes, docsRes, sessionsRes] = await Promise.all([
        adminGetAssistantConfig(),
        adminListAssistantDocuments(),
        adminListAssistantSessions({ p: 1, size: 20 }),
      ])
      if (configRes?.success === false) throw new Error(configRes.message || '配置加载失败')
      const nextConfig = configRes?.data || {}
      setConfig(nextConfig)
      setForm(formFromConfig(nextConfig))
      setDocs(getItems(docsRes))
      setSessions(getItems(sessionsRes))
    } catch (err) {
      setError(err?.response?.data?.message || err.message || 'AI 助手配置加载失败')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  const docStats = useMemo(() => {
    const enabled = docs.filter((item) => item.enabled).length
    return { total: docs.length, enabled }
  }, [docs])

  const updateForm = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }))
  }

  const saveConfig = async () => {
    setSaving(true)
    try {
      const res = await adminSaveAssistantConfig(configPayload(form))
      if (res?.success === false) throw new Error(res.message || '保存失败')
      const nextConfig = res.data
      setConfig(nextConfig)
      setForm(formFromConfig(nextConfig))
      toast('AI 助手配置已保存', 'success')
    } catch (err) {
      toast(err?.response?.data?.message || err.message || '保存失败', 'error')
    } finally {
      setSaving(false)
    }
  }

  const openCreateDoc = () => {
    setEditingDoc(null)
    setDocForm({ ...emptyDoc })
    setDocModalOpen(true)
  }

  const openEditDoc = (doc) => {
    setEditingDoc(doc)
    setDocForm({
      title: doc.title || '',
      content: doc.content || '',
      enabled: Boolean(doc.enabled),
      sort_order: doc.sort_order || 0,
    })
    setDocModalOpen(true)
  }

  const saveDoc = async () => {
    const payload = {
      ...docForm,
      title: docForm.title.trim(),
      content: docForm.content.trim(),
      sort_order: Number(docForm.sort_order) || 0,
    }
    if (!payload.title || !payload.content) {
      toast('知识文档标题和内容不能为空', 'warning')
      return
    }
    try {
      const res = editingDoc
        ? await adminUpdateAssistantDocument(editingDoc.id, payload)
        : await adminCreateAssistantDocument(payload)
      if (res?.success === false) throw new Error(res.message || '保存知识文档失败')
      toast(editingDoc ? '知识文档已更新' : '知识文档已创建', 'success')
      setDocModalOpen(false)
      const docsRes = await adminListAssistantDocuments()
      setDocs(getItems(docsRes))
    } catch (err) {
      toast(err?.response?.data?.message || err.message || '保存知识文档失败', 'error')
    }
  }

  const deleteDoc = async (doc) => {
    if (!window.confirm(`确认删除知识文档「${doc.title}」吗？`)) return
    try {
      const res = await adminDeleteAssistantDocument(doc.id)
      if (res?.success === false) throw new Error(res.message || '删除失败')
      toast('知识文档已删除', 'success')
      setDocs((prev) => prev.filter((item) => item.id !== doc.id))
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
      <ClayButton variant="primary" onClick={saveConfig} disabled={saving} className="!px-5">
        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
        保存配置
      </ClayButton>
    </>
  )

  return (
    <ClayAdminShell
      title="AI 助手"
      subtitle="配置用户控制台右下角的 Youkies AI 分身、模型来源、知识文档和使用边界。"
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
          <p className="font-semibold">加载 AI 助手配置中…</p>
        </div>
      ) : (
        <div className="grid gap-6">
          <div className="grid md:grid-cols-3 gap-4">
            <Stat label="助手状态" value={form.enabled ? '已启用' : '未启用'} tone={form.enabled ? 'green' : 'pink'} />
            <Stat label="知识文档" value={`${docStats.enabled}/${docStats.total}`} tone="blue" />
            <Stat label="近期开口" value={sessions.length} tone="purple" />
          </div>

          <ClayAlert tone="info">
            推荐创建一个站内用户 `ai-assistant`，给它单独分组、额度和专用 Token，用于承担每位用户每日免费对话。免费次数用完后，用户可选择使用自己的余额继续对话，并按当前模型正常扣费。
          </ClayAlert>

          <ClayCard className="!overflow-visible">
            <div className="flex items-center justify-between gap-4 mb-5">
              <div>
                <h2 className="text-2xl font-black tracking-tight">基础配置</h2>
                <p className="text-sm text-clay-faint font-semibold mt-1">留空 API Key 会保持原值不变。</p>
              </div>
              <ClayToggle checked={form.enabled} onChange={(v) => updateForm('enabled', v)} />
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <Field label="助手名称">
                <ClayInput
                  value={form.assistant_name}
                  onChange={(e) => updateForm('assistant_name', e.target.value)}
                />
              </Field>
              <Field label="模型来源">
                <ClaySelect
                  value={form.provider_type}
                  options={providerOptions}
                  onChange={(value) => updateForm('provider_type', value)}
                />
              </Field>
              <Field label={form.provider_type === 'site' ? '站内 API 地址' : '外部 Base URL'}>
                <ClayInput
                  value={form.base_url}
                  onChange={(e) => updateForm('base_url', e.target.value)}
                  placeholder={form.provider_type === 'site' ? '留空自动使用当前站点 /v1' : 'https://api.example.com/v1'}
                />
              </Field>
              <Field label={form.provider_type === 'site' ? '助手专用 Token' : '外部 API Key'}>
                <ClayInput
                  value={form.api_key}
                  onChange={(e) => updateForm('api_key', e.target.value)}
                  placeholder={config?.has_api_key ? `已保存：${config.api_key_masked}` : 'sk-...'}
                />
              </Field>
              <Field label="模型名称">
                <ClayInput
                  value={form.model_name}
                  onChange={(e) => updateForm('model_name', e.target.value)}
                  placeholder="gpt-5.4-mini"
                />
              </Field>
              <Field label="每日每用户免费次数">
                <ClayInput
                  type="number"
                  min="1"
                  max="8"
                  value={form.daily_limit}
                  onChange={(e) => updateForm('daily_limit', e.target.value)}
                />
              </Field>
              <Field label="截图上限 KB">
                <ClayInput
                  type="number"
                  value={form.max_image_kb}
                  onChange={(e) => updateForm('max_image_kb', e.target.value)}
                />
              </Field>
              <div className="grid gap-3">
                <ToggleLine label="允许截图" checked={form.allow_screenshot} onChange={(v) => updateForm('allow_screenshot', v)} />
                <ToggleLine label="启用知识文档" checked={form.knowledge_enabled} onChange={(v) => updateForm('knowledge_enabled', v)} />
                <ToggleLine label="记录会话摘要" checked={form.store_sessions} onChange={(v) => updateForm('store_sessions', v)} />
              </div>
            </div>

            <div className="grid gap-4 mt-4">
              <Field label="欢迎语">
                <ClayInput
                  value={form.welcome_message}
                  onChange={(e) => updateForm('welcome_message', e.target.value)}
                />
              </Field>
              <Field label="系统提示词">
                <textarea
                  className="clay-input min-h-[240px] resize-y leading-7"
                  value={form.system_prompt}
                  onChange={(e) => updateForm('system_prompt', e.target.value)}
                />
              </Field>
            </div>
          </ClayCard>

          <ClayCard>
            <div className="flex flex-wrap items-center justify-between gap-4 mb-5">
              <div>
                <h2 className="text-2xl font-black tracking-tight">知识文档</h2>
                <p className="text-sm text-clay-faint font-semibold mt-1">第一版按文档顺序取片段喂给 AI，适合放常见问题和处理边界。</p>
              </div>
              <ClayButton variant="secondary" onClick={openCreateDoc} className="!px-5">
                <Plus className="w-4 h-4" />
                新建文档
              </ClayButton>
            </div>

            {docs.length === 0 ? (
              <div className="rounded-clay bg-white/45 shadow-clay-inset p-8 text-center text-clay-faint font-bold">
                暂无知识文档
              </div>
            ) : (
              <div className="grid gap-3">
                {docs.map((doc) => (
                  <div
                    key={doc.id}
                    className="rounded-clay bg-white/45 shadow-clay-inset p-4 flex flex-col md:flex-row md:items-center justify-between gap-4"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <span className={`text-[11px] font-black px-3 py-1 rounded-clay-pill ${doc.enabled ? 'bg-clay-green-100 text-clay-green-ink' : 'bg-white/60 text-clay-faint'}`}>
                          {doc.enabled ? '启用' : '停用'}
                        </span>
                        <span className="text-[11px] font-black px-3 py-1 rounded-clay-pill bg-white/60 text-clay-faint">
                          排序 {doc.sort_order || 0}
                        </span>
                      </div>
                      <div className="font-black truncate">{doc.title}</div>
                      <div className="text-xs font-semibold text-clay-faint mt-1 line-clamp-2">{doc.content}</div>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <IconButton title="编辑" onClick={() => openEditDoc(doc)}>
                        <Edit3 className="w-4 h-4" />
                      </IconButton>
                      <IconButton title="删除" danger onClick={() => deleteDoc(doc)}>
                        <Trash2 className="w-4 h-4" />
                      </IconButton>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </ClayCard>

          <ClayCard>
            <h2 className="text-2xl font-black tracking-tight mb-5">最近会话</h2>
            {sessions.length === 0 ? (
              <div className="rounded-clay bg-white/45 shadow-clay-inset p-8 text-center text-clay-faint font-bold">
                暂无会话记录
              </div>
            ) : (
              <div className="grid gap-3">
                {sessions.map((item) => (
                  <div key={item.id} className="rounded-clay bg-white/45 shadow-clay-inset p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[11px] font-black px-3 py-1 rounded-clay-pill bg-clay-blue-100 text-clay-blue-ink">
                          {decisionLabel(item.decision)}
                        </span>
                        <span className="text-xs font-bold text-clay-faint">用户 #{item.user_id}</span>
                        <span className="text-xs font-bold text-clay-faint">{item.page_path || '-'}</span>
                      </div>
                      <span className="text-xs font-bold text-clay-faint">{formatTime(item.created_at)}</span>
                    </div>
                    <div className="text-sm font-bold line-clamp-2">{item.question || '仅截图'}</div>
                    {item.answer_summary && (
                      <div className="text-xs text-clay-faint font-semibold mt-2 line-clamp-2">{item.answer_summary}</div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </ClayCard>
        </div>
      )}

      <ClayModal
        open={docModalOpen}
        onClose={() => setDocModalOpen(false)}
        title={editingDoc ? '编辑知识文档' : '新建知识文档'}
        size="xl"
        footer={
          <>
            <ClayButton variant="ghost" onClick={() => setDocModalOpen(false)}>
              取消
            </ClayButton>
            <ClayButton variant="primary" onClick={saveDoc}>
              保存文档
            </ClayButton>
          </>
        }
      >
        <div className="grid gap-4">
          <Field label="标题">
            <ClayInput value={docForm.title} onChange={(e) => setDocForm((prev) => ({ ...prev, title: e.target.value }))} />
          </Field>
          <Field label="排序">
            <ClayInput
              type="number"
              value={docForm.sort_order}
              onChange={(e) => setDocForm((prev) => ({ ...prev, sort_order: e.target.value }))}
            />
          </Field>
          <ToggleLine
            label="启用文档"
            checked={docForm.enabled}
            onChange={(v) => setDocForm((prev) => ({ ...prev, enabled: v }))}
          />
          <Field label="内容">
            <textarea
              className="clay-input min-h-[260px] resize-y leading-7"
              value={docForm.content}
              onChange={(e) => setDocForm((prev) => ({ ...prev, content: e.target.value }))}
            />
          </Field>
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

function ToggleLine({ label, checked, onChange }) {
  return (
    <div className="rounded-clay bg-white/45 shadow-clay-inset p-4 flex items-center justify-between gap-3">
      <span className="font-extrabold text-sm">{label}</span>
      <ClayToggle checked={checked} onChange={onChange} />
    </div>
  )
}

function IconButton({ title, danger = false, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={title}
      className={`clay-icon-btn-lg ${danger ? 'clay-icon-btn-danger' : ''}`}
    >
      {children}
    </button>
  )
}

function Stat({ label, value, tone }) {
  const cls = {
    blue: 'text-clay-blue-ink',
    pink: 'text-clay-pink-ink',
    green: 'text-clay-green-ink',
    purple: 'text-clay-purple-ink',
  }[tone]
  return (
    <ClayCard className="!p-5">
      <div className="text-xs font-black text-clay-faint uppercase mb-1">{label}</div>
      <div className={`text-2xl font-black tabular-nums ${cls}`}>{value}</div>
    </ClayCard>
  )
}
