import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Cpu,
  Download,
  Image as ImageIcon,
  Loader2,
  Maximize2,
  MinusCircle,
  Paperclip,
  RotateCcw,
  Sparkles,
  Trash2,
  Wand2,
  X,
} from 'lucide-react'
import ClayButton from '../components/clay/ClayButton.jsx'
import ClayModal from '../components/clay/ClayModal.jsx'
import GlassSelect from '../components/clay/GlassSelect.jsx'
import PlaygroundShell from '../components/layout/PlaygroundShell.jsx'
import { useToast } from '../context/ToastContext.jsx'
import { useUser } from '../context/UserContext.jsx'
import { quotaToDisplay } from '../utils/quota.js'
import {
  editPlaygroundImage,
  filterModelsByGroup,
  generatePlaygroundImage,
  listPlaygroundGroups,
  listPlaygroundPricing,
  pickImageModels,
} from '../services/playgroundAI.js'
import {
  decodeBase64ToBlob,
  deleteImage as idbDeleteImage,
  fetchImageBlobViaProxy,
  listImages as idbListImages,
  saveImage as idbSaveImage,
} from '../services/playgroundImageStore.js'

const CONFIG_KEY = 'uiweb.playground.image.config'

const SIZE_PRESETS = [
  { value: 'auto', label: '自动（默认）' },
  { value: '1024x1024', label: '1024 × 1024' },
  { value: '1792x1024', label: '1792 × 1024' },
  { value: '1024x1792', label: '1024 × 1792' },
  { value: '1536x1024', label: '1536 × 1024' },
  { value: '1024x1536', label: '1024 × 1536' },
  { value: '512x512', label: '512 × 512' },
  { value: '256x256', label: '256 × 256' },
]
const QUALITY_PRESETS = [
  { value: 'auto', label: 'auto（默认）' },
  { value: 'low', label: '低 · 省' },
  { value: 'medium', label: '中' },
  { value: 'high', label: '高 · 清' },
  { value: 'standard', label: 'standard' },
  { value: 'hd', label: 'HD' },
]
const STYLE_PRESETS = [
  { value: '', label: '默认（无）' },
  { value: 'vivid', label: 'vivid · 鲜艳' },
  { value: 'natural', label: 'natural · 自然' },
]
const BACKGROUND_PRESETS = [
  { value: '', label: '默认（auto）' },
  { value: 'auto', label: 'auto · 自动' },
  { value: 'transparent', label: 'transparent · 透明' },
  { value: 'opaque', label: 'opaque · 不透明' },
]
const FORMAT_PRESETS = [
  { value: '', label: '默认（PNG）' },
  { value: 'png', label: 'PNG' },
  { value: 'jpeg', label: 'JPEG' },
  { value: 'webp', label: 'WebP' },
]
const MODERATION_PRESETS = [
  { value: '', label: '默认（standard）' },
  { value: 'auto', label: 'auto · 标准' },
  { value: 'low', label: 'low · 宽松' },
]
const COUNT_PRESETS = [
  { value: '1', label: '1 张（默认）' },
  { value: '2', label: '2 张' },
  { value: '3', label: '3 张' },
  { value: '4', label: '4 张' },
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

const ADV_OPEN_KEY = 'uiweb.playground.image.advanced_open'

export default function PlaygroundImage() {
  const toast = useToast()
  const isMobile = useIsMobile()
  const { user } = useUser()
  const abortRef = useRef(null)
  const inputRef = useRef(null)
  const refImageInput = useRef(null)

  const cfg0 = safeReadConfig() || {}
  const group = '图片与视频生成'
  const [model, setModel] = useState(cfg0.model || '')
  const [size, setSize] = useState(cfg0.size || 'auto')
  const [quality, setQuality] = useState(cfg0.quality || 'auto')
  const [style, setStyle] = useState(cfg0.style || '')
  const [background, setBackground] = useState(cfg0.background || '')
  const [outputFormat, setOutputFormat] = useState(cfg0.output_format || '')
  const [moderation, setModeration] = useState(cfg0.moderation || '')
  const [n, setN] = useState(cfg0.n || 1)
  const [prompt, setPrompt] = useState(cfg0.prompt || '')
  const [negativePrompt, setNegativePrompt] = useState(cfg0.negative_prompt || '')
  const [advancedOpen, setAdvancedOpen] = useState(() => {
    try { return window.localStorage.getItem(ADV_OPEN_KEY) === '1' } catch (_) { return false }
  })
  const [inputCollapsed, setInputCollapsed] = useState(false)

  // Reference images: { id, file, previewUrl, name, mime }
  const [refImages, setRefImages] = useState([])

  const [groups, setGroups] = useState([])
  const [pricing, setPricing] = useState({})
  const [loadingMeta, setLoadingMeta] = useState(true)

  const [history, setHistory] = useState([])
  const [loadingHistory, setLoadingHistory] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [previewId, setPreviewId] = useState(null)
  const [generatingSince, setGeneratingSince] = useState(0)
  const [, setTick] = useState(0)
  useEffect(() => {
    if (!generating) { setGeneratingSince(0); return }
    setGeneratingSince(Date.now())
    const t = setInterval(() => setTick((x) => x + 1), 1000)
    return () => clearInterval(t)
  }, [generating])
  const elapsedSec = generatingSince ? Math.max(0, Math.floor((Date.now() - generatingSince) / 1000)) : 0

  useEffect(() => {
    safeWriteConfig({ model, size, quality, style, background, output_format: outputFormat, moderation, n, prompt, negative_prompt: negativePrompt })
  }, [group, model, size, quality, style, background, outputFormat, moderation, n, prompt, negativePrompt])
  useEffect(() => { try { window.localStorage.setItem(ADV_OPEN_KEY, advancedOpen ? '1' : '0') } catch (_) {} }, [advancedOpen])

  useEffect(() => {
    let cancelled = false
    setLoadingMeta(true)
    Promise.all([listPlaygroundGroups(), listPlaygroundPricing()])
      .then(([gs, pr]) => {
        if (cancelled) return
        setGroups(gs); setPricing(pr)
      })
      .catch((e) => { if (!cancelled) toast(e?.response?.data?.message || e?.message || '加载失败', 'error') })
      .finally(() => { if (!cancelled) setLoadingMeta(false) })
    return () => { cancelled = true }
  }, [])

  // Track active blob URLs so we can revoke them on cleanup.
  const blobUrlsRef = useRef(new Map())
  const ensureBlobUrl = useCallback((id, blob) => {
    const m = blobUrlsRef.current
    if (m.has(id)) return m.get(id)
    const u = URL.createObjectURL(blob)
    m.set(id, u)
    return u
  }, [])
  const revokeBlobUrl = useCallback((id) => {
    const m = blobUrlsRef.current
    const u = m.get(id)
    if (u) { try { URL.revokeObjectURL(u) } catch (_) {} ; m.delete(id) }
  }, [])
  useEffect(() => () => {
    for (const u of blobUrlsRef.current.values()) {
      try { URL.revokeObjectURL(u) } catch (_) {}
    }
    blobUrlsRef.current.clear()
  }, [])

  useEffect(() => {
    let cancelled = false
    setLoadingHistory(true)
    idbListImages(60)
      .then((items) => {
        if (cancelled) return
        const enriched = items.map((it) => ({ ...it, image_url: ensureBlobUrl(it.id, it.blob) }))
        setHistory(enriched)
      })
      .catch((e) => { if (!cancelled) console.warn('listImages failed', e) })
      .finally(() => { if (!cancelled) setLoadingHistory(false) })
    return () => { cancelled = true }
  }, [ensureBlobUrl])

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

  // ---- Cost estimation ----
  const estimate = useMemo(() => {
    const cur = imageModels.find((m) => m.name === model)
    const price = parseFloat(cur?.modelPrice)
    if (!cur || !Number.isFinite(price) || price <= 0) {
      return { quota: 0, text: '', loaded: !!cur }
    }
    const ratios = pricing?.group_ratio || {}
    let groupRatio = ratios[group]
    if (group === 'auto' || groupRatio == null) {
      const userGroup = ratios.default != null ? 'default' : null
      groupRatio = userGroup != null ? ratios[userGroup] : 1
    }
    const gr = Number(groupRatio) || 1
    let qpu = 500000
    try {
      const raw = parseFloat(window.localStorage.getItem('quota_per_unit') || '500000')
      if (Number.isFinite(raw) && raw > 0) qpu = raw
    } catch (_) {}
    const nClamped = Math.max(1, Math.min(4, Number(n) || 1))
    const quota = price * gr * nClamped * qpu
    const text = quotaToDisplay(quota, 3).text
    return { quota, text, loaded: true }
  }, [imageModels, model, pricing, group, n])

  const userQuota = Number(user?.quota ?? 0)
  const insufficient = estimate.quota > 0 && userQuota > 0 && userQuota < estimate.quota * 1.1
  const noBalance = estimate.quota > 0 && userQuota > 0 && userQuota < estimate.quota

  // ---- Reference images ----
  const addRefImages = useCallback((files) => {
    const accepted = Array.from(files || []).filter((f) => f.type.startsWith('image/'))
    if (!accepted.length) return
    setRefImages((prev) => {
      const remaining = 4 - prev.length
      if (remaining <= 0) { toast('最多 4 张参考图', 'warning'); return prev }
      const items = accepted.slice(0, remaining).map((file) => ({
        id: crypto.randomUUID(),
        file,
        previewUrl: URL.createObjectURL(file),
        name: file.name,
        mime: file.type,
      }))
      return [...prev, ...items]
    })
  }, [toast])

  const removeRefImage = useCallback((id) => {
    setRefImages((prev) => {
      const item = prev.find((x) => x.id === id)
      if (item?.previewUrl) try { URL.revokeObjectURL(item.previewUrl) } catch (_) {}
      return prev.filter((x) => x.id !== id)
    })
  }, [])

  const addHistoryAsRef = useCallback((item) => {
    if (!item?.blob) return
    setRefImages((prev) => {
      if (prev.length >= 4) { toast('最多 4 张参考图', 'warning'); return prev }
      const ext = (item.mime || 'image/png').split('/')[1] || 'png'
      const file = new File([item.blob], `ref-${item.id}.${ext}`, { type: item.mime || 'image/png' })
      const newItem = { id: crypto.randomUUID(), file, previewUrl: URL.createObjectURL(file), name: file.name, mime: file.type }
      return [...prev, newItem]
    })
    toast('已加入参考图', 'info')
  }, [toast])

  // Cleanup ref image blob URLs on unmount
  useEffect(() => () => {
    for (const img of refImages) {
      try { URL.revokeObjectURL(img.previewUrl) } catch (_) {}
    }
  }, [])

  // Paste to add reference images
  useEffect(() => {
    const handlePaste = (e) => {
      const items = Array.from(e.clipboardData?.items || [])
      const files = items.filter((i) => i.type.startsWith('image/')).map((i) => i.getAsFile()).filter(Boolean)
      if (files.length) addRefImages(files)
    }
    document.addEventListener('paste', handlePaste)
    return () => document.removeEventListener('paste', handlePaste)
  }, [addRefImages])

  // ---- Generate / Stop ----
  const stop = useCallback(() => {
    if (abortRef.current) { abortRef.current.abort(); abortRef.current = null }
  }, [])

  const handleGenerate = useCallback(async (overridePrompt) => {
    const text = (overridePrompt ?? prompt).trim()
    if (!text) { toast('请先输入 prompt', 'error'); return }
    if (!model) { toast('请先选择模型', 'error'); return }
    if (generating) return

    const neg = negativePrompt.trim()
    const fullPrompt = neg ? `${text}. No: ${neg}` : text

    const payload = { model, group, prompt: fullPrompt }
    if (size && size !== 'auto') payload.size = size
    if (quality && quality !== 'auto') payload.quality = quality
    if (style) payload.style = style
    if (background) payload.background = background
    if (outputFormat) payload.output_format = outputFormat
    if (moderation) payload.moderation = moderation
    const nClamped = Math.max(1, Math.min(4, Number(n) || 1))
    if (nClamped > 1) payload.n = nClamped

    const ctrl = new AbortController()
    abortRef.current = ctrl
    setGenerating(true)
    try {
      const res = refImages.length > 0
        ? await editPlaygroundImage({ payload, images: refImages, signal: ctrl.signal })
        : await generatePlaygroundImage({ payload, signal: ctrl.signal })

      const datas = Array.isArray(res?.data) ? res.data : []
      if (!datas.length) { toast('上游未返回图片', 'error'); return }
      const saved = []
      for (const d of datas) {
        let blob = null
        try {
          if (d?.b64_json) {
            blob = decodeBase64ToBlob(d.b64_json, 'image/png')
          } else if (d?.url) {
            blob = await fetchImageBlobViaProxy(d.url)
          } else {
            continue
          }
        } catch (e) {
          console.warn('image decode/proxy failed', e)
          continue
        }
        const meta = {
          blob,
          mime: blob.type,
          prompt: text,
          model,
          group_name: group,
          size: payload.size || '',
          quality: payload.quality || '',
          style: payload.style || '',
        }
        try {
          const item = await idbSaveImage(meta)
          const view = { ...item, image_url: ensureBlobUrl(item.id, item.blob) }
          saved.push(view)
        } catch (e) { console.warn('idbSaveImage failed', e) }
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
      else if (e?.message?.toLowerCase().includes('timeout') || e?.status === 504 || e?.status === 524)
        toast('生图超时，模型响应较慢，请稍后重试', 'error')
      else toast(e?.message || '生图失败，请稍后重试', 'error')
    } finally {
      abortRef.current = null
      setGenerating(false)
    }
  }, [editPlaygroundImage, ensureBlobUrl, generating, group, model, n, negativePrompt, prompt, quality, refImages, size, style, toast])

  const handleDelete = useCallback(async (id) => {
    try {
      await idbDeleteImage(id)
      revokeBlobUrl(id)
      setHistory((prev) => prev.filter((it) => it.id !== id))
      if (previewId === id) setPreviewId(null)
      toast('已删除', 'info')
    } catch (e) { toast(e?.message || '删除失败', 'error') }
  }, [previewId, revokeBlobUrl, toast])

  const handleDownload = useCallback((item) => {
    try {
      if (!item?.blob) { toast('图片数据缺失', 'error'); return }
      const url = URL.createObjectURL(item.blob)
      const a = document.createElement('a')
      a.href = url
      const ext = (item.mime || 'image/png').split('/')[1] || 'png'
      a.download = `playground-${item.id}.${ext}`
      document.body.appendChild(a); a.click(); document.body.removeChild(a)
      setTimeout(() => URL.revokeObjectURL(url), 4000)
    } catch (e) { toast(e?.message || '下载失败', 'error') }
  }, [toast])

  const handleDragOver = useCallback((e) => { e.preventDefault() }, [])
  const handleDrop = useCallback((e) => {
    e.preventDefault()
    addRefImages(Array.from(e.dataTransfer?.files || []))
  }, [addRefImages])

  const previewItem = useMemo(() => history.find((it) => it.id === previewId), [history, previewId])

  const isExpanded = !isMobile || !inputCollapsed

  const footer = (
    <div
      className="fixed bottom-3 left-1/2 z-20 w-full max-w-4xl -translate-x-1/2 px-3 sm:bottom-5 sm:px-6"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0)' }}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <div className="rounded-3xl border border-white/55 bg-white/55 px-3 py-3 shadow-[0_18px_60px_-18px_rgba(0,0,0,0.22)] ring-1 ring-black/[0.04] backdrop-blur-2xl sm:px-4 sm:py-3.5">

        {/* Reference image thumbnails */}
        {refImages.length > 0 && isExpanded && (
          <div className="flex flex-wrap gap-1.5 pb-2">
            {refImages.map((img) => (
              <div key={img.id} className="relative h-10 w-10 overflow-hidden rounded-xl border border-white/70 shadow-clay-sm">
                <img src={img.previewUrl} alt="参考图" className="h-full w-full object-cover" />
                <button
                  type="button"
                  onClick={() => removeRefImage(img.id)}
                  className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-clay-pink-300 text-white shadow"
                >
                  <X className="h-2.5 w-2.5" strokeWidth={3} />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Chips row */}
        {isExpanded && (
          <div className="-mx-1 flex flex-wrap items-center gap-1.5 px-1 pb-2 sm:mx-0 sm:px-0">
            <GlassSelect
              icon={<Cpu className="h-3 w-3" strokeWidth={2.8} />}
              value={model}
              onChange={setModel}
              options={modelOptions.length ? modelOptions : [{ value: '', label: loadingMeta ? '加载中…' : '无可用模型' }]}
              disabled={loadingMeta || !modelOptions.length}
              placeholder="选择模型"
              tone="purple"
              minWidth={200}
            />
            <GlassSelect
              icon={<ImageIcon className="h-3 w-3" strokeWidth={2.8} />}
              label="尺寸"
              value={size}
              onChange={setSize}
              options={SIZE_PRESETS}
              minWidth={160}
            />
            {/* Clip icon: add reference images */}
            <button
              type="button"
              onClick={() => refImageInput.current?.click()}
              title="添加参考图（支持拖拽 / 粘贴）"
              className={`inline-flex h-7 shrink-0 items-center gap-1 rounded-full border border-white/60 bg-white/55 px-2.5 text-[11.5px] font-bold ring-1 ring-black/[0.04] transition hover:bg-white/80 ${refImages.length > 0 ? 'text-clay-purple-ink' : 'text-clay-faint'}`}
            >
              <Paperclip className="h-3 w-3" strokeWidth={2.8} />
              {refImages.length > 0 && <span>{refImages.length}/4</span>}
            </button>
            <input
              ref={refImageInput}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => { addRefImages(e.target.files); e.target.value = '' }}
            />
            <button
              type="button"
              onClick={() => setAdvancedOpen((v) => !v)}
              className="inline-flex h-7 shrink-0 items-center gap-1 rounded-full border border-white/60 bg-white/55 px-2.5 text-[11.5px] font-bold text-clay-faint ring-1 ring-black/[0.04] transition hover:bg-white/80"
              title={advancedOpen ? '收起高级参数' : '展开高级参数'}
            >
              高级
              {advancedOpen ? <ChevronUp className="h-3 w-3" strokeWidth={2.8} /> : <ChevronDown className="h-3 w-3" strokeWidth={2.8} />}
            </button>
            {advancedOpen && (
              <>
                <GlassSelect
                  icon={<Sparkles className="h-3 w-3" strokeWidth={2.8} />}
                  label="质量"
                  value={quality}
                  onChange={setQuality}
                  options={QUALITY_PRESETS}
                  minWidth={140}
                />
                <GlassSelect
                  icon={<Wand2 className="h-3 w-3" strokeWidth={2.8} />}
                  label="风格"
                  value={style}
                  onChange={setStyle}
                  options={STYLE_PRESETS}
                  minWidth={140}
                />
                <GlassSelect
                  label="数量"
                  value={String(n)}
                  onChange={(v) => setN(parseInt(v, 10) || 1)}
                  options={COUNT_PRESETS}
                  minWidth={110}
                />
                <GlassSelect
                  label="背景"
                  value={background}
                  onChange={setBackground}
                  options={BACKGROUND_PRESETS}
                  minWidth={150}
                />
                <GlassSelect
                  label="格式"
                  value={outputFormat}
                  onChange={setOutputFormat}
                  options={FORMAT_PRESETS}
                  minWidth={120}
                />
                <GlassSelect
                  label="审核"
                  value={moderation}
                  onChange={setModeration}
                  options={MODERATION_PRESETS}
                  minWidth={130}
                />
              </>
            )}
          </div>
        )}

        {/* Negative prompt — shown inside advanced (full width row) */}
        {isExpanded && advancedOpen && (
          <div className="mb-2 flex items-center gap-2">
            <MinusCircle className="h-3 w-3 shrink-0 text-clay-faint" strokeWidth={2.8} />
            <input
              type="text"
              value={negativePrompt}
              onChange={(e) => setNegativePrompt(e.target.value)}
              placeholder="负面提示词：不要水印、不要文字…（追加到 prompt 末尾）"
              className="min-w-0 flex-1 rounded-2xl border border-white/60 bg-white/55 px-3 py-1 text-[12px] font-medium text-clay-ink placeholder:text-clay-faint/70 focus:outline-none"
            />
          </div>
        )}

        {/* Textarea */}
        {isExpanded && (
          <textarea
            ref={inputRef}
            value={prompt}
            onChange={(e) => setPrompt(e.target.value.slice(0, 4000))}
            placeholder="描述你想要的画面，越具体越好…"
            rows={isMobile ? 2 : 3}
            disabled={generating}
            className="block max-h-40 w-full resize-none border-0 bg-transparent px-1 py-1.5 text-[15px] font-medium text-clay-ink placeholder:font-bold placeholder:text-clay-faint/70 focus:outline-none disabled:opacity-50"
            style={{ minHeight: 44 }}
          />
        )}

        {/* Bottom action bar */}
        <div className="flex items-center justify-between gap-2 pt-1.5">
          <div className="min-w-0 flex-1 truncate text-[11px] font-bold text-clay-faint">
            {estimate.text ? (
              <span className={insufficient ? 'inline-flex items-center gap-1 text-clay-pink-ink' : ''}>
                {insufficient && <AlertTriangle className="h-3 w-3" strokeWidth={2.8} />}
                预估 {estimate.text}
                {estimate.quota > 0 && <span className="ml-1 opacity-70">· {Math.round(estimate.quota).toLocaleString()} quota</span>}
                {noBalance && <span className="ml-1">· 余额不足</span>}
                {insufficient && !noBalance && <span className="ml-1">· 余额偏紧</span>}
              </span>
            ) : prompt.length > 0 ? (
              <span>{prompt.length}/4000</span>
            ) : null}
          </div>
          <div className="flex items-center gap-2">
            {generating ? (
              <button
                type="button"
                onClick={stop}
                className="inline-flex h-9 items-center gap-1.5 rounded-full border border-clay-pink-200/60 bg-clay-pink-100/80 px-4 text-[12.5px] font-black text-clay-pink-ink shadow-[0_4px_14px_-4px_rgba(255,143,179,0.5)] ring-1 ring-clay-pink-200/40 transition hover:bg-clay-pink-100 active:scale-95"
              >
                <X className="h-3.5 w-3.5" strokeWidth={2.8} />
                停止
              </button>
            ) : (
              <button
                type="button"
                onClick={() => handleGenerate()}
                disabled={!model || !prompt.trim()}
                className={`inline-flex h-9 items-center gap-1.5 rounded-full border px-4 text-[12.5px] font-black shadow-[0_6px_18px_-4px_rgba(180,142,232,0.55)] ring-1 ring-white/40 transition hover:brightness-105 active:scale-95 disabled:!from-white/70 disabled:!to-white/70 disabled:!text-clay-faint disabled:!shadow-none disabled:!ring-black/5 disabled:cursor-not-allowed ${
                  insufficient
                    ? 'border-clay-pink-300/60 bg-gradient-to-br from-clay-pink-200 to-clay-pink-300 text-white'
                    : 'border-clay-purple-200/60 bg-gradient-to-br from-clay-purple-100 to-clay-purple-200 text-[#5a3a76]'
                }`}
              >
                <Wand2 className="h-3.5 w-3.5" strokeWidth={2.8} />
                {refImages.length > 0 ? '参考生成' : '生成'}
              </button>
            )}
            {/* Mobile collapse toggle */}
            {isMobile && (
              <button
                type="button"
                onClick={() => setInputCollapsed((v) => !v)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/60 bg-white/55 text-clay-faint ring-1 ring-black/[0.04] transition hover:bg-white/80"
                title={inputCollapsed ? '展开输入框' : '收起输入框'}
              >
                {inputCollapsed
                  ? <ChevronUp className="h-4 w-4" strokeWidth={2.8} />
                  : <ChevronDown className="h-4 w-4" strokeWidth={2.8} />}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )

  return (
    <PlaygroundShell tab="image" actions={null} footer={footer}>
      <div className="pt-4">
        {loadingHistory ? (
          <div className="flex h-40 items-center justify-center text-sm font-bold text-clay-faint">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> 加载历史…
          </div>
        ) : (history.length === 0 && !generating) ? (
          <EmptyHint onPick={(t) => setPrompt(t)} isMobile={isMobile} />
        ) : (
          <>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-black text-clay-ink">历史画廊</h3>
              <span className="text-[11px] font-bold text-clay-faint">{history.length} 张</span>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 lg:grid-cols-4">
              {generating && (
                <div className="relative flex aspect-square flex-col items-center justify-center gap-2 overflow-hidden rounded-2xl border border-clay-pink-200/40 bg-gradient-to-br from-clay-pink-100/60 to-clay-purple-100/60 shadow-clay-sm">
                  <Loader2 className="h-6 w-6 animate-spin text-clay-pink-ink" strokeWidth={2.8} />
                  <div className="text-[12px] font-black text-clay-pink-ink">正在生成 {elapsedSec}s</div>
                </div>
              )}
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
            <ClayButton type="button" variant="ghost" onClick={() => { addHistoryAsRef(previewItem); setPreviewId(null) }}>
              <Paperclip className="h-4 w-4" strokeWidth={2.8} />
              以此为参考
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
