import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, NavLink } from 'react-router-dom'
import {
  ArrowLeft,
  Cpu,
  Download,
  Image as ImageIcon,
  Layers,
  Loader2,
  MessageSquare,
  Sparkles,
  Trash2,
  Wand2,
  X,
  RotateCcw,
} from 'lucide-react'
import ClayButton from '../components/clay/ClayButton.jsx'
import ClayCard from '../components/clay/ClayCard.jsx'
import ClayIconButton from '../components/clay/ClayIconButton.jsx'
import ClayModal from '../components/clay/ClayModal.jsx'
import ClaySelect from '../components/clay/ClaySelect.jsx'
import ClayConsoleShell from '../components/layout/ClayConsoleShell.jsx'
import { useToast } from '../context/ToastContext.jsx'
import {
  deleteSavedPlaygroundImage,
  filterModelsByGroup,
  generatePlaygroundImage,
  listPlaygroundGroups,
  listPlaygroundPricing,
  listSavedPlaygroundImages,
  pickImageModels,
  savePlaygroundImage,
} from '../services/playgroundAI.js'

const CONFIG_KEY = 'uiweb.playground.image.config'

const SIZE_PRESETS = [
  { value: '1024x1024', label: '1024 × 1024 · 正方形' },
  { value: '1792x1024', label: '1792 × 1024 · 宽屏' },
  { value: '1024x1792', label: '1024 × 1792 · 竖图' },
  { value: '512x512', label: '512 × 512 · 小图' },
  { value: 'auto', label: '自动 (Auto)' },
]

const QUALITY_PRESETS = [
  { value: 'auto', label: '自动' },
  { value: 'low', label: '低 (低成本)' },
  { value: 'medium', label: '中' },
  { value: 'high', label: '高 (高清)' },
  { value: 'standard', label: 'standard' },
  { value: 'hd', label: 'HD' },
]

const STYLE_PRESETS = [
  { value: '', label: '默认' },
  { value: 'vivid', label: 'vivid · 鲜艳' },
  { value: 'natural', label: 'natural · 自然' },
]

const PROMPT_PRESETS = [
  '一只在云朵上奔跑的橘色小猫，黏土质感，柔和粉彩光',
  '清晨阳光照进窗台的咖啡杯，文艺向，胶片质感',
  '未来主义城市夜景，霓虹色彩，雨后地面反光',
  '一只穿宇航服的柴犬漂浮在太空中，皮克斯电影海报风',
]

function useIsMobile() {
  const [m, setM] = useState(() => typeof window !== 'undefined' && window.matchMedia('(max-width: 767px)').matches)
  useEffect(() => {
    if (typeof window === 'undefined') return
    const mq = window.matchMedia('(max-width: 767px)')
    const onChange = (e) => setM(e.matches)
    mq.addEventListener?.('change', onChange)
    return () => mq.removeEventListener?.('change', onChange)
  }, [])
  return m
}

function safeReadConfig() {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(CONFIG_KEY)
    return raw ? JSON.parse(raw) : null
  } catch (_) { return null }
}

function safeWriteConfig(cfg) {
  try { window.localStorage.setItem(CONFIG_KEY, JSON.stringify(cfg)) } catch (_) {}
}

function formatTime(ts) {
  if (!ts) return ''
  const num = typeof ts === 'number' ? (ts < 1e12 ? ts * 1000 : ts) : new Date(ts).getTime()
  const d = new Date(num)
  const now = new Date()
  const sameDay = d.toDateString() === now.toDateString()
  if (sameDay) return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  return `${d.getMonth() + 1}/${d.getDate()}`
}

export default function PlaygroundImage() {
  const toast = useToast()
  const isMobile = useIsMobile()
  const abortRef = useRef(null)

  const cfg0 = safeReadConfig() || {}
  const [group, setGroup] = useState(cfg0.group || 'auto')
  const [model, setModel] = useState(cfg0.model || '')
  const [size, setSize] = useState(cfg0.size || '1024x1024')
  const [quality, setQuality] = useState(cfg0.quality || 'auto')
  const [style, setStyle] = useState(cfg0.style || '')
  const [n, setN] = useState(cfg0.n || 1)
  const [prompt, setPrompt] = useState('')

  const [groups, setGroups] = useState([])
  const [pricing, setPricing] = useState({})
  const [loadingMeta, setLoadingMeta] = useState(true)

  const [history, setHistory] = useState([])
  const [loadingHistory, setLoadingHistory] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [previewId, setPreviewId] = useState(null)

  useEffect(() => { safeWriteConfig({ group, model, size, quality, style, n }) }, [group, model, size, quality, style, n])

  useEffect(() => {
    let cancelled = false
    setLoadingMeta(true)
    Promise.all([listPlaygroundGroups(), listPlaygroundPricing()])
      .then(([gs, pr]) => {
        if (cancelled) return
        setGroups(gs)
        setPricing(pr)
        if (!group || !gs.some((g) => g.name === group)) setGroup(gs[0]?.name || 'auto')
      })
      .catch((e) => { if (!cancelled) toast(e?.response?.data?.message || e?.message || '加载失败', 'error') })
      .finally(() => { if (!cancelled) setLoadingMeta(false) })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    let cancelled = false
    setLoadingHistory(true)
    listSavedPlaygroundImages(60)
      .then((items) => { if (!cancelled) setHistory(items) })
      .catch((e) => { if (!cancelled && e?.status !== 401 && e?.response?.status !== 401) console.warn('listSavedPlaygroundImages failed', e) })
      .finally(() => { if (!cancelled) setLoadingHistory(false) })
    return () => { cancelled = true }
  }, [])

  const imageModels = useMemo(() => pickImageModels(pricing), [pricing])
  const availableModels = useMemo(() => filterModelsByGroup(imageModels, group), [imageModels, group])

  useEffect(() => {
    if (!availableModels.length) return
    if (!model || !availableModels.some((m) => m.name === model)) {
      setModel(availableModels[0].name)
    }
  }, [availableModels, model])

  const groupOptions = useMemo(() => groups.map((g) => ({
    value: g.name,
    label: g.name === 'auto' ? '自动 (Auto)' : `${g.name}${g.ratio !== undefined ? ` · 倍率 ${g.ratio}` : ''}`,
  })), [groups])

  const modelOptions = useMemo(() => availableModels.map((m) => ({
    value: m.name,
    label: m.vendor ? `${m.vendor} · ${m.name}` : m.name,
  })), [availableModels])

  const stop = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort()
      abortRef.current = null
    }
  }, [])

  const handleGenerate = useCallback(async (overridePrompt) => {
    const text = (overridePrompt ?? prompt).trim()
    if (!text) { toast('请先输入 prompt', 'error'); return }
    if (!model) { toast('请先选择模型', 'error'); return }
    if (generating) return

    const payload = { model, group, prompt: text }
    if (size && size !== 'auto') payload.size = size
    if (quality && quality !== 'auto') payload.quality = quality
    if (style) payload.style = style
    const nClamped = Math.max(1, Math.min(4, Number(n) || 1))
    if (nClamped > 1) payload.n = nClamped

    const ctrl = new AbortController()
    abortRef.current = ctrl
    setGenerating(true)
    try {
      const res = await generatePlaygroundImage({ payload, signal: ctrl.signal })
      const datas = Array.isArray(res?.data) ? res.data : []
      if (!datas.length) {
        toast('上游未返回图片', 'error')
        return
      }
      // Persist each image to backend
      const saved = []
      for (const d of datas) {
        const body = {
          prompt: text,
          model,
          group_name: group,
          size: payload.size || '',
          quality: payload.quality || '',
          style: payload.style || '',
        }
        if (d?.b64_json) body.b64_json = d.b64_json
        else if (d?.url) body.url = d.url
        else continue
        try {
          const view = await savePlaygroundImage(body)
          if (view) saved.push(view)
        } catch (e) {
          // eslint-disable-next-line no-console
          console.warn('savePlaygroundImage failed', e)
        }
      }
      if (saved.length) {
        setHistory((prev) => [...saved, ...prev].slice(0, 60))
        toast(`已生成 ${saved.length} 张`, 'success')
        setPreviewId(saved[0].id)
      } else {
        toast('图片保存失败', 'warning')
      }
    } catch (e) {
      if (e?.name === 'AbortError') {
        toast('已中止', 'info')
      } else {
        toast(e?.message || '生图失败', 'error')
      }
    } finally {
      abortRef.current = null
      setGenerating(false)
    }
  }, [generating, group, model, n, prompt, quality, size, style, toast])

  const handleDelete = useCallback(async (id) => {
    try {
      await deleteSavedPlaygroundImage(id)
      setHistory((prev) => prev.filter((it) => it.id !== id))
      if (previewId === id) setPreviewId(null)
      toast('已删除', 'info')
    } catch (e) {
      toast(e?.response?.data?.message || e?.message || '删除失败', 'error')
    }
  }, [previewId, toast])

  const handleDownload = useCallback(async (item) => {
    try {
      const res = await fetch(item.image_url, { credentials: 'include' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      const ext = (item.image_type || 'image/png').split('/')[1] || 'png'
      a.download = `playground-${item.id}.${ext}`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      setTimeout(() => URL.revokeObjectURL(url), 4000)
    } catch (e) {
      toast(e?.message || '下载失败', 'error')
    }
  }, [toast])

  const previewItem = useMemo(() => history.find((it) => it.id === previewId), [history, previewId])

  return (
    <ClayConsoleShell
      title="AI 游乐场"
      subtitle="对话 · 生图 · 直接使用你的分组与模型"
      compactHeader
      showAssistantWidget={false}
      actions={(
        <ClayButton as={Link} to="/playground" variant="ghost" className="!px-5">
          <ArrowLeft className="h-4 w-4" strokeWidth={2.8} />
          返回
        </ClayButton>
      )}
    >
      {/* Tabs */}
      <div className="mb-4 flex flex-wrap items-center gap-2 sm:mb-6">
        <NavLink
          to="/playground/chat"
          className={({ isActive }) => `inline-flex min-h-10 items-center gap-2 rounded-clay-pill px-4 text-sm font-black transition active:scale-95 ${
            isActive ? 'bg-clay-pink-100 text-clay-pink-ink shadow-clay-sm' : 'bg-clay-bg text-clay-faint shadow-clay-inset-sm hover:text-clay-pink-ink'
          }`}
        >
          <MessageSquare className="h-4 w-4" strokeWidth={2.8} />
          对话
        </NavLink>
        <NavLink
          to="/playground/image"
          end
          className={({ isActive }) => `inline-flex min-h-10 items-center gap-2 rounded-clay-pill px-4 text-sm font-black transition active:scale-95 ${
            isActive ? 'bg-clay-purple-100 text-[#6b4d83] shadow-clay-sm' : 'bg-clay-bg text-clay-faint shadow-clay-inset-sm hover:text-[#6b4d83]'
          }`}
        >
          <ImageIcon className="h-4 w-4" strokeWidth={2.8} />
          生图
        </NavLink>
      </div>

      {/* Model / Group / Size / Quality bar */}
      <ClayCard className="mb-4 !p-3 sm:mb-5 sm:!p-4">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-3 lg:grid-cols-4">
          <PickerRow icon={<Layers className="h-3.5 w-3.5" />} label="分组" color="purple">
            <ClaySelect value={group} onChange={setGroup} options={groupOptions.length ? groupOptions : [{ value: 'auto', label: '自动' }]} disabled={loadingMeta} />
          </PickerRow>
          <PickerRow icon={<Cpu className="h-3.5 w-3.5" />} label="模型" color="yellow">
            <ClaySelect value={model} onChange={setModel} options={modelOptions.length ? modelOptions : [{ value: '', label: loadingMeta ? '加载中…' : '无生图模型' }]} disabled={loadingMeta || !modelOptions.length} />
          </PickerRow>
          <PickerRow icon={<ImageIcon className="h-3.5 w-3.5" />} label="尺寸" color="pink">
            <ClaySelect value={size} onChange={setSize} options={SIZE_PRESETS} />
          </PickerRow>
          <PickerRow icon={<Sparkles className="h-3.5 w-3.5" />} label="质量" color="green">
            <ClaySelect value={quality} onChange={setQuality} options={QUALITY_PRESETS} />
          </PickerRow>
        </div>
        <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2 sm:gap-3">
          <PickerRow icon={<Wand2 className="h-3.5 w-3.5" />} label="风格" color="pink">
            <ClaySelect value={style} onChange={setStyle} options={STYLE_PRESETS} />
          </PickerRow>
          <PickerRow icon={<Layers className="h-3.5 w-3.5" />} label="数量" color="purple">
            <ClaySelect
              value={String(n)}
              onChange={(v) => setN(parseInt(v, 10) || 1)}
              options={[1, 2, 3, 4].map((v) => ({ value: String(v), label: `${v} 张` }))}
            />
          </PickerRow>
        </div>
      </ClayCard>

      {/* Prompt + Action */}
      <ClayCard className="mb-4 !p-4 sm:mb-5 sm:!p-5">
        <div className="mb-2 flex items-center justify-between">
          <span className="inline-flex items-center gap-1.5 rounded-clay-pill bg-clay-pink-100 px-2.5 py-1 text-xs font-black text-clay-pink-ink shadow-clay-sm">
            <Wand2 className="h-3.5 w-3.5" strokeWidth={2.8} />
            Prompt
          </span>
          <span className="text-[11px] font-bold text-clay-faint">{prompt.length}/4000</span>
        </div>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value.slice(0, 4000))}
          placeholder="描述你想要的画面，越具体越好…"
          rows={isMobile ? 3 : 4}
          disabled={generating}
          className="clay-input min-h-[88px] resize-none"
        />
        <div className="mt-3 flex flex-wrap gap-2">
          {PROMPT_PRESETS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPrompt(p)}
              disabled={generating}
              className="rounded-clay-pill bg-clay-bg px-3 py-1.5 text-[12.5px] font-bold text-clay-ink shadow-clay-inset-sm transition hover:bg-clay-purple-100 hover:text-[#6b4d83] active:scale-95 disabled:opacity-60"
            >
              <Sparkles className="-mt-0.5 mr-1 inline h-3 w-3 text-clay-purple-300" strokeWidth={2.8} />
              {p}
            </button>
          ))}
        </div>
        <div className="mt-4 flex items-center justify-end gap-2">
          {generating ? (
            <ClayButton type="button" variant="secondary" onClick={stop}>
              <X className="h-4 w-4" strokeWidth={2.8} />
              停止
            </ClayButton>
          ) : (
            <ClayButton type="button" onClick={() => handleGenerate()} disabled={!model || !prompt.trim()}>
              <Wand2 className="h-4 w-4" strokeWidth={2.8} />
              生成
            </ClayButton>
          )}
        </div>
      </ClayCard>

      {/* History gallery */}
      <ClayCard className="!p-4 sm:!p-5">
        <div className="mb-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <ImageIcon className="h-5 w-5 text-clay-purple-300" strokeWidth={2.8} />
            <h3 className="text-lg font-black">历史画廊</h3>
          </div>
          <span className="rounded-clay-pill bg-clay-bg px-3 py-1 text-xs font-black text-clay-faint shadow-clay-inset">{history.length}</span>
        </div>
        {loadingHistory ? (
          <div className="flex h-40 items-center justify-center text-sm font-bold text-clay-faint">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> 加载中…
          </div>
        ) : history.length === 0 ? (
          <div className="rounded-[24px] bg-clay-bg px-5 py-10 text-center text-sm font-bold text-clay-faint shadow-clay-inset">
            还没有生成记录，输入 prompt 试试
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {history.map((it) => (
              <button
                key={it.id}
                type="button"
                onClick={() => setPreviewId(it.id)}
                className="group relative aspect-square overflow-hidden rounded-[20px] bg-clay-bg shadow-clay-sm transition active:scale-95"
                title={it.prompt}
              >
                <img src={it.image_url} alt={it.prompt} className="h-full w-full object-cover transition group-hover:scale-[1.03]" loading="lazy" />
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/55 via-black/15 to-transparent px-2 pb-2 pt-6 text-left text-[11px] font-bold text-white">
                  <div className="line-clamp-2 leading-snug">{it.prompt}</div>
                  <div className="mt-0.5 text-[10px] opacity-80">{formatTime(it.created_at)}</div>
                </div>
              </button>
            ))}
          </div>
        )}
      </ClayCard>

      {/* Preview Modal */}
      <ClayModal
        open={!!previewItem}
        onClose={() => setPreviewId(null)}
        title="生图预览"
        size="lg"
        footer={previewItem ? (
          <>
            <ClayButton type="button" variant="ghost" onClick={() => {
              setPrompt(previewItem.prompt)
              setPreviewId(null)
              toast('已填入 prompt', 'info')
            }}>
              <RotateCcw className="h-4 w-4" strokeWidth={2.8} />
              用此 prompt 再生
            </ClayButton>
            <ClayButton type="button" onClick={() => handleDownload(previewItem)}>
              <Download className="h-4 w-4" strokeWidth={2.8} />
              下载
            </ClayButton>
          </>
        ) : null}
      >
        {previewItem && (
          <div className="space-y-3">
            <div className="overflow-hidden rounded-[24px] bg-clay-bg shadow-clay-inset">
              <img src={previewItem.image_url} alt={previewItem.prompt} className="block max-h-[60vh] w-full object-contain" />
            </div>
            <div className="rounded-[20px] bg-clay-bg p-3 shadow-clay-inset-sm">
              <div className="text-[11px] font-bold uppercase tracking-wider text-clay-faint">Prompt</div>
              <div className="mt-1 whitespace-pre-wrap break-words text-[13.5px] font-medium leading-6">{previewItem.prompt}</div>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-[11px] font-bold text-clay-faint">
              {previewItem.model && <span className="rounded-clay-pill bg-clay-yellow-100 px-2 py-1 text-[#8a6a32] shadow-clay-sm">{previewItem.model}</span>}
              {previewItem.size && <span className="rounded-clay-pill bg-clay-bg px-2 py-1 shadow-clay-inset-sm">{previewItem.size}</span>}
              {previewItem.quality && <span className="rounded-clay-pill bg-clay-bg px-2 py-1 shadow-clay-inset-sm">{previewItem.quality}</span>}
              {previewItem.style && <span className="rounded-clay-pill bg-clay-bg px-2 py-1 shadow-clay-inset-sm">{previewItem.style}</span>}
              {previewItem.group_name && previewItem.group_name !== 'auto' && (
                <span className="rounded-clay-pill bg-clay-purple-100 px-2 py-1 text-[#6b4d83] shadow-clay-sm">{previewItem.group_name}</span>
              )}
              <button
                type="button"
                onClick={() => handleDelete(previewItem.id)}
                className="ml-auto inline-flex items-center gap-1 rounded-clay-pill bg-clay-bg px-3 py-1 text-clay-pink-400 shadow-clay-inset-sm hover:bg-clay-pink-100 hover:text-clay-pink-ink"
              >
                <Trash2 className="h-3.5 w-3.5" strokeWidth={2.8} />
                删除
              </button>
            </div>
          </div>
        )}
      </ClayModal>
    </ClayConsoleShell>
  )
}

function PickerRow({ icon, label, color, children }) {
  const palette = {
    pink: 'bg-clay-pink-100 text-clay-pink-ink',
    purple: 'bg-clay-purple-100 text-[#6b4d83]',
    yellow: 'bg-clay-yellow-100 text-[#8a6a32]',
    green: 'bg-clay-green-100 text-[#3f6e57]',
    blue: 'bg-clay-blue-100 text-[#43658b]',
  }[color] || 'bg-clay-bg text-clay-ink'
  return (
    <div className="flex items-center gap-2">
      <span className={`inline-flex shrink-0 items-center gap-1.5 rounded-clay-pill px-2.5 py-1 text-xs font-black shadow-clay-sm ${palette}`}>
        {icon}
        {label}
      </span>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  )
}
