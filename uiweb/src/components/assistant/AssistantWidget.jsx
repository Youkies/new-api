import { useEffect, useMemo, useRef, useState } from 'react'
import { Bot, ImagePlus, Loader2, Send, ShieldAlert, Sparkles, Trash2, X } from 'lucide-react'
import ClayCard from '../clay/ClayCard.jsx'
import { useToast } from '../../context/ToastContext.jsx'
import { getAssistantClientConfig, streamAssistantChat } from '../../services/assistant.js'

const TYPEWRITER_INTERVAL_MS = 22

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
        className={`max-w-[84%] md:max-w-[720px] lg:max-w-[760px] rounded-[22px] md:rounded-clay-lg px-4 py-3 md:px-5 md:py-4 ${
          isUser
            ? 'bg-clay-pink-100 text-[#8a4860] shadow-clay'
            : 'bg-white/70 md:bg-white/45 text-clay-ink shadow-clay-sm md:shadow-clay'
        }`}
      >
        {message.screenshots?.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-3">
            {message.screenshots.map((item, index) => (
              <img
                key={`${message.id}-${index}`}
                src={item.data_url}
                alt="截图"
                className="w-16 h-16 md:w-20 md:h-20 rounded-clay object-cover shadow-clay-sm"
              />
            ))}
          </div>
        )}
        <div className="whitespace-pre-wrap leading-7 text-sm md:text-sm font-semibold">
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
  const [openingContent, setOpeningContent] = useState('')
  const [openingStreaming, setOpeningStreaming] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const openingPlayedRef = useRef('')
  const messageBuffersRef = useRef(new Map())
  const messageTimersRef = useRef(new Map())

  const enabled = Boolean(config?.enabled)
  const maxImageBytes = config?.max_image_bytes || 800 * 1024
  const assistantName = config?.assistant_name || 'Youkies 的 AI 分身'
  const openingText = useMemo(() => {
    const configured = String(config?.welcome_message || '').trim()
    return configured || `你好，我是 ${assistantName}。把错误截图和问题发给我，我会先帮你判断是否需要人工处理。`
  }, [assistantName, config?.welcome_message])

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

  useEffect(() => () => {
    messageTimersRef.current.forEach((timer) => window.clearInterval(timer))
    messageTimersRef.current.clear()
    messageBuffersRef.current.clear()
  }, [])

  useEffect(() => {
    if (!open) return
    requestAnimationFrame(() => {
      if (scrollRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight
      }
    })
  }, [messages, open, openingContent])

  useEffect(() => {
    if (!open || !enabled) {
      setOpeningStreaming(false)
      return undefined
    }

    if (openingPlayedRef.current === openingText) {
      setOpeningContent(openingText)
      setOpeningStreaming(false)
      return undefined
    }

    openingPlayedRef.current = openingText
    let index = 1
    setOpeningContent(openingText.slice(0, index))
    setOpeningStreaming(true)

    const timer = window.setInterval(() => {
      index += 1
      setOpeningContent(openingText.slice(0, index))
      if (index >= openingText.length) {
        window.clearInterval(timer)
        setOpeningStreaming(false)
      }
    }, TYPEWRITER_INTERVAL_MS)

    return () => window.clearInterval(timer)
  }, [enabled, open, openingText])

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

  const stopMessageTypewriter = (messageId) => {
    const timer = messageTimersRef.current.get(messageId)
    if (timer) window.clearInterval(timer)
    messageTimersRef.current.delete(messageId)
    messageBuffersRef.current.delete(messageId)
  }

  const appendToMessage = (messageId, content) => {
    if (!content) return
    setMessages((prev) => prev.map((item) => (
      item.id === messageId
        ? { ...item, content: `${item.content}${content}` }
        : item
    )))
  }

  const getTypewriterBatchSize = (length) => {
    if (length > 240) return 8
    if (length > 120) return 5
    if (length > 48) return 3
    if (length > 16) return 2
    return 1
  }

  const scheduleMessageTypewriter = (messageId) => {
    if (messageTimersRef.current.has(messageId)) return
    const timer = window.setInterval(() => {
      const queued = messageBuffersRef.current.get(messageId) || ''
      if (!queued) {
        const activeTimer = messageTimersRef.current.get(messageId)
        if (activeTimer) window.clearInterval(activeTimer)
        messageTimersRef.current.delete(messageId)
        return
      }
      const size = getTypewriterBatchSize(queued.length)
      appendToMessage(messageId, queued.slice(0, size))
      messageBuffersRef.current.set(messageId, queued.slice(size))
    }, TYPEWRITER_INTERVAL_MS)
    messageTimersRef.current.set(messageId, timer)
  }

  const queueMessageTypewriter = (messageId, content) => {
    if (!content) return
    const queued = messageBuffersRef.current.get(messageId) || ''
    messageBuffersRef.current.set(messageId, `${queued}${content}`)
    scheduleMessageTypewriter(messageId)
  }

  const flushMessageTypewriter = (messageId) => {
    const queued = messageBuffersRef.current.get(messageId) || ''
    stopMessageTypewriter(messageId)
    appendToMessage(messageId, queued)
  }

  const waitForMessageTypewriter = (messageId) => new Promise((resolve) => {
    const check = () => {
      const queued = messageBuffersRef.current.get(messageId) || ''
      const active = messageTimersRef.current.has(messageId)
      if (!queued && !active) {
        resolve()
        return
      }
      window.setTimeout(check, TYPEWRITER_INTERVAL_MS)
    }
    check()
  })

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
          queueMessageTypewriter(assistantId, chunk)
        },
      )
      await waitForMessageTypewriter(assistantId)
      setMessages((prev) => prev.map((item) => (
        item.id === assistantId ? { ...item, streaming: false } : item
      )))
    } catch (err) {
      flushMessageTypewriter(assistantId)
      const message = err?.message || 'AI 助手分析失败'
      setError(message)
      setMessages((prev) => prev.map((item) => (
        item.id === assistantId
          ? { ...item, streaming: false, content: `${item.content ? `${item.content}\n\n` : ''}抱歉，刚才没有成功连上 AI 助手。\n\n${message}` }
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
        className="fixed right-5 bottom-[calc(env(safe-area-inset-bottom)+1.25rem)] z-[9990] w-16 h-16 rounded-full bg-clay-pink-100 shadow-clay hover:shadow-clay-hover active:shadow-clay-active transition-all duration-200 ease-clay flex items-center justify-center text-[#8a4860]"
        aria-label={assistantName}
        title={assistantName}
      >
        <Bot className="w-7 h-7" strokeWidth={2.5} />
      </button>

      {open && (
        <div className="fixed inset-0 z-[9999] bg-clay-bg/95 md:bg-clay-bg flex items-stretch justify-center p-0">
          <ClayCard className="relative w-full h-[100dvh] !p-0 flex flex-col !overflow-hidden max-md:!rounded-none max-md:!shadow-none max-md:!border-0 max-md:!bg-clay-bg md:!rounded-none md:!shadow-none md:!border-0 md:!bg-transparent">
            <div className="flex items-center justify-between gap-3 px-4 pt-4 pb-3 md:h-16 md:px-6 md:py-0 md:mb-0 shrink-0">
              <div className="flex items-center gap-3 min-w-0">
                <div className="clay-icon-box !w-10 !h-10 md:!w-9 md:!h-9 text-clay-pink-300 shrink-0">
                  <Sparkles className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <h3 className="text-lg sm:text-xl md:text-base font-black tracking-tight truncate">{assistantName}</h3>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="w-9 h-9 rounded-full bg-clay-bg shadow-clay md:bg-white/35 flex items-center justify-center shrink-0"
                aria-label="关闭"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="mx-4 md:mx-auto md:w-[min(920px,calc(100vw-3rem))] mb-2 md:mb-0 shrink-0 rounded-clay-pill md:rounded-clay-lg bg-clay-yellow-100 text-[#8a6a32] shadow-clay px-3.5 py-2 md:px-5 md:py-3 flex items-start gap-2.5">
              <ShieldAlert className="w-4 h-4 md:w-5 md:h-5 mt-0.5 shrink-0" strokeWidth={2.5} />
              <span className="text-[11px] md:text-sm leading-5 md:leading-6 font-bold">
                AI 仅做预诊断，不承诺退款或替代审核；截图含密钥、订单号请先打码。
              </span>
            </div>

            <div
              ref={scrollRef}
              className="flex-1 overflow-y-auto px-4 py-3 md:px-6 md:pt-10 md:pb-44 md:bg-transparent md:shadow-none space-y-3 md:space-y-0"
            >
              <div className="mx-auto w-full md:max-w-[920px] space-y-3 md:space-y-8">
                <ChatBubble
                  message={{
                    id: 'opening',
                    role: 'assistant',
                    content: openingContent,
                    streaming: openingStreaming,
                  }}
                />
                {messages.map((message) => <ChatBubble key={message.id} message={message} />)}
              </div>
            </div>

            <div className="shrink-0 px-4 pt-2 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] md:absolute md:left-1/2 md:bottom-8 md:w-[min(920px,calc(100vw-3rem))] md:-translate-x-1/2 md:px-0 md:pt-0 md:pb-0">
              {screenshots.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-2">
                  {screenshots.map((item, index) => (
                    <div key={`${item.name}-${index}`} className="relative">
                      <img
                        src={item.data_url}
                        alt="截图预览"
                        className="w-14 h-14 md:w-20 md:h-20 rounded-clay object-cover shadow-clay"
                      />
                      <button
                        type="button"
                        onClick={() => setScreenshots((prev) => prev.filter((_, i) => i !== index))}
                        className="absolute -right-2 -top-2 w-7 h-7 md:w-8 md:h-8 rounded-full bg-clay-bg shadow-clay flex items-center justify-center text-clay-pink-400"
                        aria-label="删除截图"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {error && (
                <div className="mb-2 rounded-clay bg-clay-pink-100 text-[#8a4860] px-4 py-2 text-xs font-bold shadow-clay">
                  {error}
                </div>
              )}

              <div className="rounded-[26px] md:rounded-clay bg-clay-bg md:bg-white/45 shadow-clay border-2 border-white/30 p-3 md:p-5">
                <textarea
                  className="w-full min-h-[56px] md:min-h-[96px] max-h-[128px] md:max-h-[160px] bg-transparent outline-none border-0 resize-none leading-7 text-[16px] md:text-sm font-semibold placeholder:text-clay-faint/70"
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  onPaste={onPaste}
                  onKeyDown={handleKeyDown}
                  placeholder="输入问题，Enter 发送，Shift+Enter 换行..."
                />

                <div className="flex items-center justify-between gap-3 pt-2">
                  <div className="flex items-center gap-2 min-w-0">
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
                        <button
                          type="button"
                          onClick={() => fileRef.current?.click()}
                          className="w-10 h-10 md:w-auto md:px-4 rounded-full bg-clay-bg shadow-clay flex items-center justify-center gap-2 text-clay-faint font-black text-sm"
                          aria-label="上传截图"
                        >
                          <ImagePlus className="w-4 h-4" />
                          <span className="hidden md:inline">上传截图</span>
                        </button>
                      </>
                    )}
                    <span className="truncate text-[11px] md:text-xs text-clay-faint font-bold">
                      {config?.daily_limit || 10} 次/日 · {(imageTotal / 1024).toFixed(0)}KB
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={submit}
                    disabled={loading}
                    className="h-10 px-5 md:px-6 rounded-full bg-clay-blue-100 text-[#43658b] shadow-clay flex items-center justify-center gap-2 font-black disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    <span>{loading ? '回复中' : '发送'}</span>
                  </button>
                </div>
              </div>
            </div>
          </ClayCard>
        </div>
      )}
    </>
  )
}
