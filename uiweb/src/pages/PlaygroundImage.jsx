import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Cpu,
  Download,
  Image as ImageIcon,
  Layers,
  Loader2,
  Sparkles,
  Trash2,
  Wand2,
  X,
  RotateCcw,
  Maximize2,
} from 'lucide-react'
import ClayButton from '../components/clay/ClayButton.jsx'
import ClayIconButton from '../components/clay/ClayIconButton.jsx'
import ClayModal from '../components/clay/ClayModal.jsx'
import ClaySelect from '../components/clay/ClaySelect.jsx'
import PlaygroundShell from '../components/layout/PlaygroundShell.jsx'
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
  { value: 'auto', label: '自动' },
  { value: '1024x1024', label: '1024 × 1024' },
  { value: '1792x1024', label: '1792 × 1024' },
  { value: '1024x1792', label: '1024 × 1792' },
  { value: '512x512', label: '512 × 512' },
]
const QUALITY_PRESETS = [
  { value: 'auto', label: '自动' },
  { value: 'low', label: '低 · 省' },
  { value: 'medium', label: '中' },
  { value: 'high', label: '高 · 清' },
  { value: 'standard', label: 'standard' },
  { value: 'hd', label: 'HD' },
]
const STYLE_PRESETS = [
  { value: '', label: '默认' },
  { value: 'vivid', label: 'vivid' },
  { value: 'natural', label: 'natural' },
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
  try { const raw = window.localStorage.getItem(CONFIG_KEY); return raw ? JSON.parse(raw) : null } catch (_) { return null }
}
function safeWriteConfig(cfg) { try { window.localStorage.setItem(CONFIG_KEY, JSON.stringify(cfg)) } catch (_) {} }
function formatTime(ts) {
  if (!ts) return ''
  const num = typeof ts === 'number' ? (ts < 1e12 ? ts * 1000 : ts) : new Date(ts).getTime()
  const d = new Date(num); const now = new Date()
  const sameDay = d.toDateString() === now.toDateString()
  if (sameDay) return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  return `${d.getMonth() + 1}/${d.getDate()}`
}

export default function PlaygroundImage() {
  const toast = useToast()
  const isMobile = useIsMobile()
  const abortRef = useRef(null)
  const inputRef = useRef(null)

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
        setGroups(gs); setPricing(pr)
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
    if (!model || !availableModels.some((m) => m.name === model)) setModel(availableModels[0].name)
  }, [availableModels, model])

  const groupOptions = useMemo(() => groups.map((g) => ({
    value: g.name,
    label: g.name === 'auto' ? '自动' : `${g.name}${g.ratio !== undefined ? ` · ${g.ratio}x` : ''}`,
  })), [groups])
  const modelOptions = useMemo(() => availableModels.map((m) => ({
    value: m.name,
    label: m.vendor ? `${m.vendor} · ${m.name}` : m.name,
  })), [availableModels])

  const stop = useCallback(() => {
    if (abortRef.current) { abortRef.current.abort(); abortRef.current = null }
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
      if (!datas.length) { toast('上游未返回图片', 'error'); return }
      const saved = []
      for (const d of datas) {
        const body = { prompt: text, model, group_name: group, size: payload.size || '', quality: payload.quality || '', style: payload.style || '' }
        if (d?.b64_json) body.b64_json = d.b64_json
        else if (d?.url) body.url = d.url
        else continue
        try {
          const view = await savePlaygroundImage(body)
          if (view) saved.push(view)
        } catch (e) { console.warn('savePlaygroundImage failed', e) }
      }
      if (saved.length) {
        setHistory((prev) => [...saved, ...prev].slice(0, 60))
        toast(`已生成 ${saved.length} 张`, 'success')
        setPreviewId(saved[0].id)
      } else {
        toast('图片保存失败', 'warning')
      }
    } catch (e) {
      if (e?.name === 'AbortError') toast('已中止', 'info')
      else toast(e?.message || '生图失败', 'error')
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
    } catch (e) { toast(e?.response?.data?.message || e?.message || '删除失败', 'error') }
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
      document.body.appendChild(a); a.click(); document.body.removeChild(a)
      setTimeout(() => URL.revokeObjectURL(url), 4000)
    } catch (e) { toast(e?.message || '下载失败', 'error') }
  }, [toast])

  const previewItem = useMemo(() => history.find((it) => it.id === previewId), [history, previewId])

  const headerActions = null

  const footer = (
    <div
      className="fixed bottom-3 left-1/2 z-20 w-full max-w-4xl -translate-x-1/2 px-3 sm:bottom-5 sm:px-6"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0)' }}
    >
      <div className="rounded-3xl border border-white/40 bg-clay-surface/95 p-2 shadow-clay backdrop-blur sm:p-3">
        {/* Chips row */}
        <div className="clay-scrollbar-none flex items-center gap-1.5 overflow-x-auto px-1 pb-1.5">
          <Chip icon={<Cpu className="h-3 w-3" />} label="模型">
            <ClaySelect value={model} onChange={setModel} options={modelOptions.length ? modelOptions : [{ value: '', label: loadingMeta ? '加载中…' : '无可用模型' }]} disabled={loadingMeta || !modelOptions.length} className="!min-h-7 !rounded-clay-pill !px-2 !py-0.5 !text-[12px] !font-bold !shadow-none !bg-clay-bg !text-clay-ink" />
          </Chip>
          <Chip icon={<Layers className="h-3 w-3" />} label="分组">
            <ClaySelect value={group} onChange={setGroup} options={groupOptions.length ? groupOptions : [{ value: 'auto', label: '自动' }]} disabled={loadingMeta} className="!min-h-7 !rounded-clay-pill !px-2 !py-0.5 !text-[12px] !font-bold !shadow-none !bg-clay-bg !text-clay-ink" />
          </Chip>
          <Chip icon={<ImageIcon className="h-3 w-3" />} label="尺寸">
            <ClaySelect value={size} onChange={setSize} options={SIZE_PRESETS} className="!min-h-7 !rounded-clay-pill !px-2 !py-0.5 !text-[12px] !font-bold !shadow-none !bg-clay-bg !text-clay-ink" />
          </Chip>
          <Chip icon={<Sparkles className="h-3 w-3" />} label="质量">
            <ClaySelect value={quality} onChange={setQuality} options={QUALITY_PRESETS} className="!min-h-7 !rounded-clay-pill !px-2 !py-0.5 !text-[12px] !font-bold !shadow-none !bg-clay-bg !text-clay-ink" />
          </Chip>
          <Chip icon={<Wand2 className="h-3 w-3" />} label="风格">
            <ClaySelect value={style} onChange={setStyle} options={STYLE_PRESETS} className="!min-h-7 !rounded-clay-pill !px-2 !py-0.5 !text-[12px] !font-bold !shadow-none !bg-clay-bg !text-clay-ink" />
          </Chip>
          <Chip icon={<Layers className="h-3 w-3" />} label="数量">
            <ClaySelect value={String(n)} onChange={(v) => setN(parseInt(v, 10) || 1)} options={[1, 2, 3, 4].map((v) => ({ value: String(v), label: `${v} 张` }))} className="!min-h-7 !rounded-clay-pill !px-2 !py-0.5 !text-[12px] !font-bold !shadow-none !bg-clay-bg !text-clay-ink" />
          </Chip>
        </div>
        <textarea
          ref={inputRef}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value.slice(0, 4000))}
          placeholder="描述你想要的画面，越具体越好…"
          rows={isMobile ? 2 : 3}
          disabled={generating}
          className="block max-h-40 w-full resize-none border-0 bg-transparent px-2 py-1.5 text-[15px] font-medium text-clay-ink placeholder:font-bold placeholder:text-clay-faint focus:outline-none disabled:opacity-50"
          style={{ minHeight: 44 }}
        />
        <div className="flex items-center justify-between gap-2 px-1">
          <div className="truncate text-[11px] font-bold text-clay-faint">
            {prompt.length > 0 && <span>{prompt.length}/4000</span>}
          </div>
          <div className="flex items-center gap-2">
            {generating ? (
              <ClayButton type="button" variant="secondary" onClick={stop} className="!min-h-9 !px-3 !text-xs">
                <X className="h-3.5 w-3.5" strokeWidth={2.8} />
                停止
              </ClayButton>
            ) : (
              <ClayButton type="button" onClick={() => handleGenerate()} disabled={!model || !prompt.trim()} className="!min-h-9 !px-4 !text-xs">
                <Wand2 className="h-3.5 w-3.5" strokeWidth={2.8} />
                生成
              </ClayButton>
            )}
          </div>
        </div>
      </div>
    </div>
  )

  return (
    <PlaygroundShell tab="image" actions={headerActions} footer={footer}>
      <div className="pt-4">
        {loadingHistory ? (
          <div className="flex h-40 items-center justify-center text-sm font-bold text-clay-faint">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> 加载历史…
          </div>
        ) : history.length === 0 ? (
          <EmptyHint onPick={(t) => setPrompt(t)} isMobile={isMobile} />
        ) : (
          <>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-black text-clay-ink">历史画廊</h3>
              <span className="text-[11px] font-bold text-clay-faint">{history.length} 张</span>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 lg:grid-cols-4">
              {history.map((it) => (
                <button
                  key={it.id}
                  type="button"
                  onClick={() => setPreviewId(it.id)}
                  className="group relative aspect-square overflow-hidden rounded-2xl bg-white/70 shadow-clay-sm transition active:scale-95"
                  title={it.prompt}
                >
                  <img
                    src={it.image_url}
                    alt={it.prompt}
                    className="h-full w-full object-cover transition group-hover:scale-[1.03]"
                    loading="lazy"
                  />
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/65 via-black/15 to-transparent px-2 pb-1.5 pt-6 text-left text-[11px] font-bold text-white">
                    <div className="line-clamp-2 leading-snug">{it.prompt}</div>
                  </div>
                  <div className="absolute right-1.5 top-1.5 hidden h-7 w-7 items-center justify-center rounded-full bg-white/85 text-clay-ink shadow-clay-sm backdrop-blur group-hover:flex">
                    <Maximize2 className="h-3.5 w-3.5" strokeWidth={2.8} />
                  </div>
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      <ClayModal
        open={!!previewItem}
        onClose={() => setPreviewId(null)}
        title="生图预览"
        size="lg"
        footer={previewItem ? (
          <>
            <ClayButton type="button" variant="ghost" onClick={() => { setPrompt(previewItem.prompt); setPreviewId(null); toast('已填入 prompt', 'info') }}>
              <RotateCcw className="h-4 w-4" strokeWidth={2.8} />
              再生
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
            <div className="overflow-hidden rounded-2xl bg-clay-bg">
              <img src={previewItem.image_url} alt={previewItem.prompt} className="block max-h-[60vh] w-full object-contain" />
            </div>
            <div className="rounded-2xl bg-clay-bg p-3">
              <div className="text-[11px] font-bold uppercase tracking-wider text-clay-faint">Prompt</div>
              <div className="mt-1 whitespace-pre-wrap break-words text-[13.5px] font-medium leading-6">{previewItem.prompt}</div>
            </div>
            <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-bold text-clay-faint">
              {previewItem.model && <span className="rounded-clay-pill bg-clay-yellow-100 px-2 py-0.5 text-[#8a6a32]">{previewItem.model}</span>}
              {previewItem.size && <span className="rounded-clay-pill bg-clay-bg px-2 py-0.5">{previewItem.size}</span>}
              {previewItem.quality && <span className="rounded-clay-pill bg-clay-bg px-2 py-0.5">{previewItem.quality}</span>}
              {previewItem.style && <span className="rounded-clay-pill bg-clay-bg px-2 py-0.5">{previewItem.style}</span>}
              {previewItem.group_name && previewItem.group_name !== 'auto' && (
                <span className="rounded-clay-pill bg-clay-purple-100 px-2 py-0.5 text-[#6b4d83]">{previewItem.group_name}</span>
              )}
              <span>{formatTime(previewItem.created_at)}</span>
              <button
                type="button"
                onClick={() => handleDelete(previewItem.id)}
                className="ml-auto inline-flex items-center gap-1 rounded-clay-pill px-2 py-0.5 text-clay-pink-400 hover:bg-clay-pink-100 hover:text-clay-pink-ink"
              >
                <Trash2 className="h-3.5 w-3.5" strokeWidth={2.8} />
                删除
              </button>
            </div>
          </div>
        )}
      </ClayModal>
    </PlaygroundShell>
  )
}

function Chip({ icon, label, children }) {
  return (
    <div className="flex shrink-0 items-center gap-1 rounded-clay-pill bg-clay-bg pl-2 pr-0.5 py-0.5 shadow-clay-inset-sm">
      <span className="flex items-center gap-1 text-[11px] font-black text-clay-faint">
        {icon}
        {label}
      </span>
      <div className="min-w-[110px] max-w-[180px] sm:min-w-[130px] sm:max-w-[220px]">{children}</div>
    </div>
  )
}

function EmptyHint({ onPick, isMobile }) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-5 px-2 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-clay-purple-100 text-[#6b4d83] shadow-clay-sm">
        <Wand2 className="h-6 w-6" strokeWidth={2.6} />
      </div>
      <div>
        <h3 className="text-lg font-black sm:text-xl">用 prompt 生成图片</h3>
        <p className="mt-1 text-[13px] font-bold text-clay-faint">底部输入框写下你想要的画面</p>
      </div>
      <div className={`flex w-full max-w-2xl ${isMobile ? 'flex-col' : 'flex-wrap justify-center'} gap-2`}>
        {PROMPT_PRESETS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => onPick(s)}
            className="min-h-10 rounded-2xl bg-white/60 px-4 py-2 text-left text-sm font-bold text-clay-ink shadow-clay-sm transition hover:bg-clay-purple-100 hover:text-[#6b4d83] active:scale-[0.98]"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  )
}
