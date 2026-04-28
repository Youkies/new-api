import { useEffect, useMemo, useRef, useState } from 'react'
import { Bot, ImagePlus, Loader2, Send, ShieldAlert, Sparkles, Trash2, X } from 'lucide-react'
import ClayAlert from '../clay/ClayAlert.jsx'
import ClayButton from '../clay/ClayButton.jsx'
import ClayCard from '../clay/ClayCard.jsx'
import { useToast } from '../../context/ToastContext.jsx'
import { getAssistantClientConfig, streamAssistantChat } from '../../services/assistant.js'

function getDataSize(dataURL) {
  const raw = String(dataURL || '')
  const comma = raw.indexOf(',')
  if (comma < 0) return 0
  return Math.floor((raw.length - comma - 1) * 0.75)
}

function makeId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function ChatBubble({ message }) {
  const isUser = message.role === 'user'
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[86%] rounded-clay-lg px-5 py-4 shadow-clay ${
          isUser
            ? 'bg-clay-pink-100 text-[#8a4860]'
            : 'bg-white/45 text-clay-ink'
        }`}
      >
        {message.screenshots?.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-3">
            {message.screenshots.map((item, index) => (
              <img
                key={`${message.id}-${index}`}
                src={item.data_url}
                alt="截图"
                className="w-20 h-20 rounded-clay object-cover shadow-clay-sm"
              />
            ))}
          </div>
        )}
        <div className="whitespace-pre-wrap leading-7 text-sm font-semibold">
          {message.content || (message.streaming ? '正在思考…' : '')}
          {message.streaming && <span className="inline-block w-2 h-4 ml-1 align-middle bg-clay-blue-200 animate-pulse rounded-full" />}
        </div>
      </div>
    </div>
  )
}

export default function AssistantWidget() {
  const toast = useToast()
  const fileRef = useRef(null)
  const scrollRef = useRef(null)
  const [config, setConfig] = useState(null)
  const [open, setOpen] = useState(false)
  const [question, setQuestion] = useState('')
  const [screenshots, setScreenshots] = useState([])
  const [messages, setMessages] = useState([])
  const [loading, setLoading] = useState(false)
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

  useEffect(() => {
    if (!open) return
    requestAnimationFrame(() => {
      if (scrollRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight
      }
    })
  }, [messages, open])

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
    const userMessage = {
      id: makeId(),
      role: 'user',
      content: trimmed || '请帮我看一下截图里的问题。',
      screenshots,
    }
    const assistantId = makeId()
    const assistantMessage = {
      id: assistantId,
      role: 'assistant',
      content: '',
      streaming: true,
    }
    const nextMessages = [...messages, userMessage, assistantMessage]
    setMessages(nextMessages)
    setQuestion('')
    setScreenshots([])
    setLoading(true)
    setError('')
    try {
      await streamAssistantChat(
        {
          page_path: window.location.pathname,
          messages: [...messages, userMessage].map((item) => ({
            role: item.role,
            content: item.content,
          })),
          screenshots: userMessage.screenshots.map((item) => ({ data_url: item.data_url })),
        },
        (chunk) => {
          setMessages((prev) => prev.map((item) => (
            item.id === assistantId
              ? { ...item, content: `${item.content}${chunk}` }
              : item
          )))
        },
      )
      setMessages((prev) => prev.map((item) => (
        item.id === assistantId ? { ...item, streaming: false } : item
      )))
    } catch (err) {
      const message = err?.message || 'AI 助手分析失败'
      setError(message)
      setMessages((prev) => prev.map((item) => (
        item.id === assistantId
          ? { ...item, streaming: false, content: `抱歉，刚才没有成功连上 AI 助手。\n\n${message}` }
          : item
      )))
    } finally {
      setLoading(false)
    }
  }

  const handleKeyDown = (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      if (!loading) submit()
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
          <ClayCard className="relative w-full md:max-w-2xl h-[88vh] md:h-[760px] !p-5 md:!p-7 flex flex-col !overflow-hidden">
            <div className="flex items-start justify-between gap-4 mb-4 shrink-0">
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

            <ClayAlert tone="warning" className="mb-4 shrink-0">
              AI 仅做预诊断，不会承诺退款或替代管理员审核。截图中如果有密钥、订单号等敏感信息，建议先打码。
            </ClayAlert>

            <div
              ref={scrollRef}
              className="flex-1 overflow-y-auto rounded-clay bg-white/35 shadow-clay-inset p-4 mb-4 space-y-4"
            >
              {messages.length === 0 ? (
                <div className="h-full flex items-center justify-center text-center text-clay-faint font-bold leading-7 px-6">
                  像聊天一样告诉我遇到了什么，也可以粘贴错误截图。我会边看边回复。
                </div>
              ) : (
                messages.map((message) => <ChatBubble key={message.id} message={message} />)
              )}
            </div>

            {screenshots.length > 0 && (
              <div className="flex flex-wrap gap-3 mb-3 shrink-0">
                {screenshots.map((item, index) => (
                  <div key={`${item.name}-${index}`} className="relative">
                    <img
                      src={item.data_url}
                      alt="截图预览"
                      className="w-20 h-20 rounded-clay object-cover shadow-clay"
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

            {error && (
              <ClayAlert tone="error" className="mb-3 shrink-0">
                {error}
              </ClayAlert>
            )}

            <textarea
              className="clay-input min-h-[92px] max-h-[160px] resize-y leading-7 mb-3 shrink-0"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              onPaste={onPaste}
              onKeyDown={handleKeyDown}
              placeholder="输入问题，Enter 发送，Shift+Enter 换行..."
            />

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 shrink-0">
              <div className="flex flex-wrap items-center gap-3">
                {config?.allow_screenshot && (
                  <>
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
                    <ClayButton variant="ghost" onClick={() => fileRef.current?.click()} className="!px-5">
                      <ImagePlus className="w-4 h-4" />
                      上传截图
                    </ClayButton>
                  </>
                )}
                <span className="inline-flex items-center gap-2 text-xs text-clay-faint font-bold">
                  <ShieldAlert className="w-4 h-4" />
                  每日最多 {config?.daily_limit || 10} 次 · 当前截图 {(imageTotal / 1024).toFixed(0)}KB
                </span>
              </div>
              <ClayButton variant="primary" onClick={submit} disabled={loading}>
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                {loading ? '回复中' : '发送'}
              </ClayButton>
            </div>
          </ClayCard>
        </div>
      )}
    </>
  )
}
