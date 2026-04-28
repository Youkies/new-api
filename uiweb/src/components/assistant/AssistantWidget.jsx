import { useEffect, useMemo, useRef, useState } from 'react'
import { Bot, ImagePlus, Loader2, Send, ShieldAlert, Sparkles, Trash2, X } from 'lucide-react'
import ClayAlert from '../clay/ClayAlert.jsx'
import ClayButton from '../clay/ClayButton.jsx'
import ClayCard from '../clay/ClayCard.jsx'
import { useToast } from '../../context/ToastContext.jsx'
import { analyzeAssistant, getAssistantClientConfig } from '../../services/assistant.js'

const DECISION_LABEL = {
  self_solve: '可自助处理',
  submit_appeal: '建议提交申诉',
  manual_review: '建议人工处理',
  insufficient_info: '信息不足',
}

function getDataSize(dataURL) {
  const raw = String(dataURL || '')
  const comma = raw.indexOf(',')
  if (comma < 0) return 0
  return Math.floor((raw.length - comma - 1) * 0.75)
}

export default function AssistantWidget() {
  const toast = useToast()
  const fileRef = useRef(null)
  const [config, setConfig] = useState(null)
  const [open, setOpen] = useState(false)
  const [question, setQuestion] = useState('')
  const [screenshots, setScreenshots] = useState([])
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let mounted = true
    getAssistantClientConfig()
      .then((res) => {
        if (!mounted) return
        if (res?.success === false) return
        setConfig(res?.data || null)
      })
      .catch(() => {})
    return () => {
      mounted = false
    }
  }, [])

  const enabled = Boolean(config?.enabled)
  const maxImageBytes = config?.max_image_bytes || 800 * 1024
  const assistantName = config?.assistant_name || 'Youkies 的 AI 分身'
  const welcome = config?.welcome_message || '把错误截图和问题发给我，我会先帮你判断是否需要人工处理。'

  const imageTotal = useMemo(
    () => screenshots.reduce((sum, item) => sum + getDataSize(item.data_url), 0),
    [screenshots],
  )

  if (!enabled) return null

  const readFile = (file) => {
    if (!file) return
    if (!file.type.startsWith('image/')) {
      toast('只能上传图片截图', 'warning')
      return
    }
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      toast('截图仅支持 PNG、JPEG 或 WebP', 'warning')
      return
    }
    if (file.size > maxImageBytes) {
      toast(`截图不能超过 ${(maxImageBytes / 1024 / 1024).toFixed(1)}MB`, 'warning')
      return
    }
    if (screenshots.length >= 2) {
      toast('最多上传 2 张截图', 'warning')
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      const dataURL = String(reader.result || '')
      setScreenshots((prev) => [...prev, { name: file.name || 'screenshot', data_url: dataURL }])
    }
    reader.readAsDataURL(file)
  }

  const onPaste = (event) => {
    const files = Array.from(event.clipboardData?.files || [])
    const image = files.find((file) => file.type.startsWith('image/'))
    if (image) {
      event.preventDefault()
      readFile(image)
    }
  }

  const submit = async () => {
    const trimmed = question.trim()
    if (!trimmed && screenshots.length === 0) {
      toast('请先描述问题或上传截图', 'warning')
      return
    }
    setLoading(true)
    setError('')
    setResult(null)
    try {
      const res = await analyzeAssistant({
        question: trimmed,
        page_path: window.location.pathname,
        screenshots: screenshots.map((item) => ({ data_url: item.data_url })),
      })
      if (res?.success === false) throw new Error(res.message || 'AI 助手分析失败')
      setResult(res.data)
    } catch (err) {
      setError(err?.response?.data?.message || err.message || 'AI 助手分析失败')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed right-5 bottom-5 z-[9990] w-16 h-16 rounded-full bg-clay-pink-100 shadow-clay hover:shadow-clay-hover active:shadow-clay-active transition-all duration-200 ease-clay flex items-center justify-center text-[#8a4860]"
        aria-label={assistantName}
        title={assistantName}
      >
        <Bot className="w-7 h-7" strokeWidth={2.5} />
      </button>

      {open && (
        <div className="fixed inset-0 z-[9999] bg-clay-bg/70 backdrop-blur-sm flex items-end md:items-center justify-center p-3 md:p-5">
          <ClayCard className="relative w-full md:max-w-2xl max-h-[88vh] overflow-y-auto !p-5 md:!p-7">
            <div className="flex items-start justify-between gap-4 mb-5">
              <div className="flex items-center gap-3 min-w-0">
                <div className="clay-icon-box !w-12 !h-12 text-clay-pink-300 shrink-0">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-xl md:text-2xl font-black tracking-tight">{assistantName}</h3>
                  <p className="text-sm text-clay-faint font-semibold leading-relaxed">{welcome}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="w-9 h-9 rounded-full bg-clay-bg shadow-clay flex items-center justify-center shrink-0"
                aria-label="关闭"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <ClayAlert tone="warning" className="mb-4">
              AI 仅做预诊断，不会承诺退款或替代管理员审核。截图中如果有密钥、订单号等敏感信息，建议先打码。
            </ClayAlert>

            <textarea
              className="clay-input min-h-[130px] resize-y leading-7 mb-4"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onPaste={onPaste}
              placeholder="描述你遇到的问题，也可以直接粘贴截图..."
            />

            {config?.allow_screenshot && (
              <div className="mb-4">
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={(e) => {
                    readFile(e.target.files?.[0])
                    e.target.value = ''
                  }}
                />
                <div className="flex flex-wrap items-center gap-3">
                  <ClayButton variant="ghost" onClick={() => fileRef.current?.click()} className="!px-5">
                    <ImagePlus className="w-4 h-4" />
                    上传截图
                  </ClayButton>
                  <span className="text-xs font-bold text-clay-faint">
                    最多 2 张，当前约 {(imageTotal / 1024).toFixed(0)}KB
                  </span>
                </div>
                {screenshots.length > 0 && (
                  <div className="flex flex-wrap gap-3 mt-3">
                    {screenshots.map((item, index) => (
                      <div key={`${item.name}-${index}`} className="relative">
                        <img
                          src={item.data_url}
                          alt="截图预览"
                          className="w-24 h-24 rounded-clay object-cover shadow-clay"
                        />
                        <button
                          type="button"
                          onClick={() => setScreenshots((prev) => prev.filter((_, i) => i !== index))}
                          className="absolute -right-2 -top-2 w-8 h-8 rounded-full bg-clay-bg shadow-clay flex items-center justify-center text-clay-pink-400"
                          aria-label="删除截图"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {error && (
              <ClayAlert tone="error" className="mb-4">
                {error}
              </ClayAlert>
            )}

            {result && (
              <div className="rounded-clay bg-white/45 shadow-clay-inset p-5 mb-4">
                <div className="flex items-center gap-2 mb-3">
                  <span className="clay-badge !bg-clay-blue-100">
                    {DECISION_LABEL[result.decision] || '预诊断'}
                  </span>
                  {result.summary && (
                    <span className="text-sm font-extrabold text-clay-ink">{result.summary}</span>
                  )}
                </div>
                <div className="whitespace-pre-wrap leading-7 text-sm font-semibold text-clay-ink">
                  {result.answer}
                </div>
              </div>
            )}

            <div className="flex flex-col sm:flex-row sm:justify-between gap-3">
              <div className="inline-flex items-center gap-2 text-xs text-clay-faint font-bold">
                <ShieldAlert className="w-4 h-4" />
                每日最多 {config?.daily_limit || 10} 次
              </div>
              <ClayButton variant="primary" onClick={submit} disabled={loading}>
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                {loading ? '分析中' : '发送给 AI 分身'}
              </ClayButton>
            </div>
          </ClayCard>
        </div>
      )}
    </>
  )
}
