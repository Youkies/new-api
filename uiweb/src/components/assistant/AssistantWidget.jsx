import { useEffect, useMemo, useRef, useState } from 'react'
import { Bot, ChevronDown, History, ImagePlus, Loader2, MessageSquare, Plus, Send, ShieldAlert, Sparkles, Trash2, X } from 'lucide-react'
import ClayCard from '../clay/ClayCard.jsx'
import { useToast } from '../../context/ToastContext.jsx'
import {
  createAssistantConversation,
  deleteAssistantConversation,
  getAssistantClientConfig,
  getAssistantConversationMessages,
  getAssistantModels,
  listAssistantConversations,
  streamAssistantChat,
} from '../../services/assistant.js'

const TYPEWRITER_INTERVAL_MS = 22
const FREE_LIMIT_CODE = 'assistant_free_limit_exceeded'

function getDataSize(dataURL) {
  const raw = String(dataURL || '')
  const comma = raw.indexOf(',')
  if (comma < 0) return 0
  return Math.floor((raw.length - comma - 1) * 0.75)
}

function makeId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function takeTagSuffix(value, tag) {
  const lower = value.toLowerCase()
  for (let length = Math.min(tag.length - 1, value.length); length > 0; length -= 1) {
    if (tag.startsWith(lower.slice(-length))) return length
  }
  return 0
}

function feedThinkingParser(state, chunk) {
  let data = `${state.pending || ''}${chunk || ''}`
  const result = { answer: '', reasoning: '', thinkingStarted: false, thinkingDone: false }
  state.pending = ''

  while (data) {
    const lower = data.toLowerCase()
    if (state.mode === 'think') {
      const closeIndex = lower.indexOf('</think>')
      if (closeIndex < 0) {
        const keep = takeTagSuffix(data, '</think>')
        result.reasoning += keep > 0 ? data.slice(0, -keep) : data
        state.pending = keep > 0 ? data.slice(-keep) : ''
        data = ''
      } else {
        result.reasoning += data.slice(0, closeIndex)
        data = data.slice(closeIndex + '</think>'.length)
        state.mode = 'answer'
        result.thinkingDone = true
      }
      continue
    }

    const openIndex = lower.indexOf('<think>')
    if (openIndex < 0) {
      const keep = takeTagSuffix(data, '<think>')
      result.answer += keep > 0 ? data.slice(0, -keep) : data
      state.pending = keep > 0 ? data.slice(-keep) : ''
      data = ''
    } else {
      result.answer += data.slice(0, openIndex)
      data = data.slice(openIndex + '<think>'.length)
      state.mode = 'think'
      result.thinkingStarted = true
    }
  }

  return result
}

function flushThinkingParser(state) {
  const pending = state.pending || ''
  state.pending = ''
  if (!pending) return { answer: '', reasoning: '' }
  if (state.mode === 'think') return { answer: '', reasoning: pending }
  return { answer: pending, reasoning: '' }
}

function formatAssistantTime(timestamp) {
  const value = Number(timestamp) || 0
  if (!value) return ''
  const date = new Date(value * 1000)
  return date.toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
}

function normalizeModelList(data) {
  const source = data?.data || data || []
  const names = new Set()
  if (Array.isArray(source)) {
    source.forEach((item) => {
      const name = typeof item === 'string' ? item : item?.id || item?.model_name
      if (name) names.add(name)
    })
  } else if (source && typeof source === 'object') {
    Object.values(source).forEach((value) => {
      if (!Array.isArray(value)) return
      value.forEach((name) => {
        if (name) names.add(String(name))
      })
    })
  }
  return [...names].sort((a, b) => a.localeCompare(b))
}

function normalizeModelGroups(data) {
  const source = data?.data || data || {}
  const groups = Array.isArray(source?.groups) ? source.groups : []
  if (groups.length > 0) {
    return groups
      .map((group) => {
        const name = String(group?.name || '').trim()
        if (!name) return null
        return {
          name,
          desc: String(group?.desc || name),
          ratio: group?.ratio,
          models: normalizeModelList(group?.models || []),
        }
      })
      .filter(Boolean)
  }

  const models = normalizeModelList(source)
  return models.length > 0 ? [{ name: 'default', desc: '默认分组', ratio: 1, models }] : []
}

function getGroupModels(groups, groupName) {
  return groups.find((group) => group.name === groupName)?.models || []
}

function pickDefaultModelGroup(payload, groups) {
  const preferred = payload?.default_group
  if (preferred && getGroupModels(groups, preferred).length > 0) return preferred
  const defaultGroup = groups.find((group) => group.name === 'default' && group.models.length > 0)
  if (defaultGroup) return defaultGroup.name
  return groups.find((group) => group.models.length > 0)?.name || groups[0]?.name || ''
}

function makeConversationTitle(text, hasScreenshots = false) {
  const normalized = String(text || '')
    .replace(/\s+/g, ' ')
    .replace(/[<>#`*_~|{}[\]()]/g, '')
    .trim()
  const fallback = hasScreenshots ? '截图问题排查' : '新的对话'
  if (!normalized) return fallback
  const chars = [...normalized]
  return chars.length > 18 ? `${chars.slice(0, 18).join('')}…` : normalized
}

function AssistantClaySelect({ label, value, onChange, options, disabled, placeholder = '暂无可选', align = 'left' }) {
  const [open, setOpen] = useState(false)
  const wrapperRef = useRef(null)
  const selected = options.find((option) => option.value === value)
  const displayLabel = selected?.label || placeholder
  const popupAlignClass = align === 'right' ? 'right-0' : 'left-0'

  useEffect(() => {
    if (!open) return undefined
    const closeOnOutside = (event) => {
      if (!wrapperRef.current?.contains(event.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('pointerdown', closeOnOutside)
    return () => document.removeEventListener('pointerdown', closeOnOutside)
  }, [open])

  return (
    <div ref={wrapperRef} className="relative min-w-0">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
        className="w-full min-w-0 rounded-full bg-clay-bg/85 md:bg-clay-bg shadow-clay-sm border border-white/40 px-3 py-2 flex items-center gap-2 text-left disabled:opacity-60 disabled:cursor-not-allowed"
      >
        <span className="text-[10px] md:text-[11px] font-black text-clay-faint shrink-0">{label}</span>
        <span className="min-w-0 flex-1 truncate text-xs font-black text-clay-ink">{displayLabel}</span>
        <ChevronDown className={`w-3.5 h-3.5 shrink-0 text-clay-faint transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className={`absolute ${popupAlignClass} bottom-[calc(100%+0.5rem)] z-50 w-[min(82vw,28rem)] md:w-full md:min-w-64 max-h-64 overflow-y-auto rounded-[22px] bg-clay-bg/95 shadow-clay border-2 border-white/40 p-1.5 backdrop-blur-xl`}>
          {options.length === 0 && (
            <div className="px-3 py-2 text-xs font-bold text-clay-faint">{placeholder}</div>
          )}
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              disabled={option.disabled}
              onClick={() => {
                if (option.disabled) return
                onChange(option.value)
                setOpen(false)
              }}
              className={`w-full rounded-[16px] px-3 py-2 text-left text-xs font-black leading-5 transition-colors disabled:opacity-45 disabled:cursor-not-allowed ${
                option.value === value
                  ? 'bg-clay-pink-100 text-clay-pink-ink shadow-clay-sm'
                  : 'text-clay-ink hover:bg-white/50'
              }`}
            >
              <span className="block break-all">{option.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function ChatBubble({ message, onUseBalance, onToggleReasoning, disabled }) {
  const isUser = message.role === 'user'
  const hasReasoning = !isUser && String(message.reasoning || '').trim()
  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[84%] md:max-w-[720px] lg:max-w-[760px] rounded-[22px] md:rounded-clay-lg px-4 py-3 md:px-5 md:py-4 ${
          isUser
            ? 'bg-clay-pink-100 text-clay-pink-ink shadow-clay'
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
        {hasReasoning && (
          <div className="mb-3 rounded-[18px] bg-clay-bg/60 shadow-clay-sm overflow-hidden">
            <button
              type="button"
              onClick={() => onToggleReasoning?.(message.id)}
              className="w-full px-3 py-2 flex items-center justify-between gap-2 text-[11px] font-black text-clay-faint"
            >
              <span>{message.reasoningDone ? '思考过程' : '正在思考'}</span>
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${message.reasoningOpen ? 'rotate-180' : ''}`} />
            </button>
            {message.reasoningOpen && (
              <div className="px-3 pb-3 whitespace-pre-wrap leading-6 text-xs font-semibold text-clay-faint/90">
                {message.reasoning}
              </div>
            )}
          </div>
        )}
        {message.screenshotCount > 0 && !message.screenshots?.length && (
          <div className="mb-2 text-[11px] font-bold text-clay-faint">
            已附 {message.screenshotCount} 张截图
          </div>
        )}
        <div className="whitespace-pre-wrap leading-7 text-sm md:text-sm font-semibold">
          {message.content || (message.streaming ? '正在思考…' : '')}
          {message.streaming && <span className="inline-block w-2 h-4 ml-1 align-middle bg-clay-blue-200 animate-pulse rounded-full" />}
        </div>
        {message.action === 'use_balance' && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => onUseBalance?.(message)}
              disabled={disabled}
              className="rounded-clay-pill bg-clay-blue-100 px-4 py-2 text-xs font-black text-clay-blue-ink shadow-clay disabled:opacity-60 disabled:cursor-not-allowed"
            >
              使用余额继续
            </button>
            <span className="text-[11px] font-bold text-clay-faint">
              将按你当前可用模型正常扣费
            </span>
          </div>
        )}
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
  const [conversationId, setConversationId] = useState(0)
  const [conversations, setConversations] = useState([])
  const [historyOpen, setHistoryOpen] = useState(false)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyError, setHistoryError] = useState('')
  const [modelGroups, setModelGroups] = useState([])
  const [selectedPaidGroup, setSelectedPaidGroup] = useState('default')
  const [selectedPaidModel, setSelectedPaidModel] = useState('')
  const [balanceMode, setBalanceMode] = useState(false)
  const [openingContent, setOpeningContent] = useState('')
  const [openingStreaming, setOpeningStreaming] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const openingPlayedRef = useRef('')
  const messageBuffersRef = useRef(new Map())
  const messageTimersRef = useRef(new Map())
  const messageParsersRef = useRef(new Map())

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
    messageParsersRef.current.clear()
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

  useEffect(() => {
    if (!open || !enabled) return
    let mounted = true
    setHistoryError('')
    setHistoryLoading(true)
    listAssistantConversations({ p: 1, size: 30 })
      .then((res) => {
        if (!mounted) return
        if (res?.success === false) {
          setHistoryError(res?.message || '历史对话读取失败')
          setConversations([])
          return
        }
        const items = res?.data?.items || res?.items || []
        setConversations(Array.isArray(items) ? items : [])
      })
      .catch((err) => {
        if (mounted) setHistoryError(err?.message || '历史对话读取失败')
      })
      .finally(() => {
        if (mounted) setHistoryLoading(false)
      })
    getAssistantModels()
      .then((res) => {
        if (!mounted) return
        const payload = res?.data || res || {}
        const groups = normalizeModelGroups(res)
        const nextGroup = pickDefaultModelGroup(payload, groups)
        const nextModels = getGroupModels(groups, nextGroup)
        setModelGroups(groups)
        setSelectedPaidGroup((current) => (
          current && getGroupModels(groups, current).length > 0 ? current : nextGroup
        ))
        setSelectedPaidModel((current) => (
          current && nextModels.includes(current) ? current : nextModels[0] || config?.model_name || ''
        ))
      })
      .catch(() => {})
    return () => {
      mounted = false
    }
  }, [config?.model_name, enabled, open])

  const imageTotal = useMemo(
    () => screenshots.reduce((sum, item) => sum + getDataSize(item.data_url), 0),
    [screenshots],
  )
  const freeLimit = Number(config?.daily_limit) || 8
  const freeUsed = Math.min(Number(config?.daily_used) || 0, freeLimit)
  const freeModelLabel = `免费 · ${config?.model_name || '后台模型'} (${freeUsed}/${freeLimit})`
  const currentUsageLabel = balanceMode
    ? `余额续聊 · ${selectedPaidGroup || 'default'} · ${selectedPaidModel || '请选择模型'}`
    : freeModelLabel
  const selectedGroupModels = useMemo(() => getGroupModels(modelGroups, selectedPaidGroup), [modelGroups, selectedPaidGroup])
  const groupOptions = useMemo(() => modelGroups.map((group) => ({
    value: group.name,
    label: group.models.length > 0 ? group.name : `${group.name} · 无模型`,
    disabled: group.models.length === 0,
  })), [modelGroups])
  const modelOptions = useMemo(() => selectedGroupModels.map((name) => ({
    value: name,
    label: name,
  })), [selectedGroupModels])

  useEffect(() => {
    if (modelGroups.length === 0) return
    const currentGroup = modelGroups.find((group) => group.name === selectedPaidGroup && group.models.length > 0)
      || modelGroups.find((group) => group.models.length > 0)
      || modelGroups[0]
    if (!currentGroup) return
    if (currentGroup.name !== selectedPaidGroup) {
      setSelectedPaidGroup(currentGroup.name)
      return
    }
    if (!currentGroup.models.includes(selectedPaidModel)) {
      setSelectedPaidModel(currentGroup.models[0] || '')
    }
  }, [modelGroups, selectedPaidGroup, selectedPaidModel])

  const refreshConversations = async () => {
    try {
      setHistoryError('')
      const res = await listAssistantConversations({ p: 1, size: 30 })
      if (res?.success === false) {
        setHistoryError(res?.message || '历史对话读取失败')
        return
      }
      const items = res?.data?.items || res?.items || []
      setConversations(Array.isArray(items) ? items : [])
    } catch (err) {
      setHistoryError(err?.message || '历史对话读取失败')
    }
  }

  const ensureConversationBeforeSend = async (userMessage) => {
    if (conversationId) return Number(conversationId) || 0
    try {
      const res = await createAssistantConversation({
        title: makeConversationTitle(userMessage?.content, (userMessage?.screenshots || []).length > 0),
      })
      if (res?.success === false) return 0
      const id = Number(res?.data?.id || res?.id) || 0
      if (id > 0) {
        setConversationId(id)
        refreshConversations()
      }
      return id
    } catch (err) {
      setHistoryError(err?.message || '历史对话创建失败')
      return 0
    }
  }

  const startNewConversation = () => {
    setConversationId(0)
    setMessages([])
    setQuestion('')
    setScreenshots([])
    setError('')
    setHistoryOpen(false)
    messageTimersRef.current.forEach((timer) => window.clearInterval(timer))
    messageTimersRef.current.clear()
    messageParsersRef.current.clear()
    messageBuffersRef.current.clear()
  }

  const openConversation = async (conversation) => {
    if (!conversation?.id) return
    setHistoryLoading(true)
    try {
      const res = await getAssistantConversationMessages(conversation.id)
      const items = res?.data?.items || res?.items || []
      setConversationId(Number(conversation.id) || 0)
      setMessages((Array.isArray(items) ? items : []).map((item) => ({
        id: `history-${item.id}`,
        role: item.role,
        content: item.content || '',
        reasoning: item.reasoning || '',
        reasoningDone: Boolean(item.reasoning),
        reasoningOpen: false,
        screenshotCount: item.screenshot_count || item.screenshotCount || 0,
      })))
      setQuestion('')
      setScreenshots([])
      setError('')
      setHistoryOpen(false)
    } catch (err) {
      toast(err?.message || '历史对话读取失败', 'error')
    } finally {
      setHistoryLoading(false)
    }
  }

  const removeConversation = async (event, conversation) => {
    event.stopPropagation()
    if (!conversation?.id) return
    try {
      await deleteAssistantConversation(conversation.id)
      if (Number(conversationId) === Number(conversation.id)) startNewConversation()
      await refreshConversations()
    } catch (err) {
      toast(err?.message || '删除历史对话失败', 'error')
    }
  }

  const toggleReasoning = (messageId) => {
    setMessages((prev) => prev.map((item) => (
      item.id === messageId ? { ...item, reasoningOpen: !item.reasoningOpen } : item
    )))
  }

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

  const appendMessageReasoning = (messageId, content, patch = {}) => {
    if (!content && Object.keys(patch).length === 0) return
    setMessages((prev) => prev.map((item) => (
      item.id === messageId
        ? { ...item, ...patch, reasoning: `${item.reasoning || ''}${content || ''}` }
        : item
    )))
  }

  const queueAssistantChunk = (messageId, chunk) => {
    const parser = messageParsersRef.current.get(messageId) || { mode: 'answer', pending: '' }
    const parsed = feedThinkingParser(parser, chunk)
    messageParsersRef.current.set(messageId, parser)
    if (parsed.thinkingStarted) {
      appendMessageReasoning(messageId, '', { reasoningOpen: true, reasoningDone: false })
    }
    if (parsed.reasoning) {
      appendMessageReasoning(messageId, parsed.reasoning)
    }
    if (parsed.thinkingDone) {
      appendMessageReasoning(messageId, '', { reasoningOpen: false, reasoningDone: true })
    }
    if (parsed.answer) {
      queueMessageTypewriter(messageId, parsed.answer)
    }
  }

  const flushAssistantParser = (messageId) => {
    const parser = messageParsersRef.current.get(messageId)
    if (!parser) return
    const parsed = flushThinkingParser(parser)
    if (parsed.reasoning) {
      appendMessageReasoning(messageId, parsed.reasoning, { reasoningOpen: false, reasoningDone: true })
    }
    if (parsed.answer) {
      queueMessageTypewriter(messageId, parsed.answer)
    }
    messageParsersRef.current.delete(messageId)
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

  const submit = async ({ useBalance = false, pendingMessage = null, assistantId: retryAssistantId = null, historyMessages = null } = {}) => {
    const trimmed = question.trim()
    const effectiveUseBalance = useBalance || balanceMode
    if (!pendingMessage && !trimmed && screenshots.length === 0) {
      toast('请先描述问题或上传截图', 'warning')
      return
    }
    if (effectiveUseBalance && (!selectedPaidGroup || !selectedPaidModel)) {
      toast('请先选择可用分组和模型', 'warning')
      return
    }
    const userMessage = pendingMessage || {
      id: makeId(),
      role: 'user',
      content: trimmed || '请帮我看一下截图里的问题。',
      screenshots,
    }
    const assistantId = retryAssistantId || makeId()
    const baseMessages = historyMessages || messages
    if (retryAssistantId) {
      setMessages((prev) => prev.map((item) => (
        item.id === retryAssistantId
          ? { ...item, content: '', reasoning: '', reasoningDone: false, reasoningOpen: false, streaming: true, action: null, pendingMessage: null, historyMessages: null }
          : item
      )))
    } else {
      const assistantMessage = {
        id: assistantId,
        role: 'assistant',
        content: '',
        reasoning: '',
        reasoningDone: false,
        reasoningOpen: false,
        streaming: true,
      }
      setMessages([...messages, userMessage, assistantMessage])
      setQuestion('')
      setScreenshots([])
    }
    setLoading(true)
    setError('')
    try {
      const nextConversationId = await ensureConversationBeforeSend(userMessage)
      const result = await streamAssistantChat(
        {
          conversation_id: nextConversationId || conversationId || 0,
          group: effectiveUseBalance ? selectedPaidGroup : '',
          model_name: effectiveUseBalance ? selectedPaidModel : '',
          page_path: window.location.pathname,
          use_balance: effectiveUseBalance,
          messages: [...baseMessages, userMessage].map((item) => ({
            role: item.role,
            content: item.content,
          })),
          screenshots: (userMessage.screenshots || []).map((item) => ({ data_url: item.data_url })),
        },
        (chunk) => {
          queueAssistantChunk(assistantId, chunk)
        },
      )
      flushAssistantParser(assistantId)
      await waitForMessageTypewriter(assistantId)
      setMessages((prev) => prev.map((item) => (
        item.id === assistantId ? { ...item, streaming: false } : item
      )))
      if (result?.conversationId) setConversationId(Number(result.conversationId) || 0)
      if (!effectiveUseBalance) {
        setConfig((prev) => prev ? { ...prev, daily_used: Math.min((Number(prev.daily_used) || 0) + 1, Number(prev.daily_limit) || 8) } : prev)
      }
      refreshConversations()
    } catch (err) {
      flushAssistantParser(assistantId)
      flushMessageTypewriter(assistantId)
      const message = err?.message || 'AI 助手分析失败'
      if (err?.data?.conversation_id) setConversationId(Number(err.data.conversation_id) || 0)
      if (err?.code === FREE_LIMIT_CODE) {
        const limit = err?.data?.free_daily_limit || config?.daily_limit || 8
        const used = err?.data?.used || limit
        const prompt = `今天的 ${limit} 次免费 AI 助手对话已经用完了。你可以使用账户余额继续这次对话，后续会按你当前可用模型正常扣费。\n\n当前免费使用：${used}/${limit}`
        setMessages((prev) => prev.map((item) => (
          item.id === assistantId
            ? {
                ...item,
                streaming: false,
                content: prompt,
                action: 'use_balance',
                pendingMessage: userMessage,
                historyMessages: baseMessages,
              }
            : item
        )))
        return
      }
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

  const continueWithBalance = (message) => {
    if (!message?.pendingMessage) return
    setBalanceMode(true)
    submit({
      useBalance: true,
      pendingMessage: message.pendingMessage,
      assistantId: message.id,
      historyMessages: message.historyMessages || [],
    })
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
        className="assistant-widget-toggle fixed right-5 bottom-[calc(env(safe-area-inset-bottom)+1.25rem)] z-[9990] w-16 h-16 rounded-full bg-clay-pink-100 shadow-clay hover:shadow-clay-hover active:shadow-clay-active transition-all duration-200 ease-clay flex items-center justify-center text-clay-pink-ink"
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
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={startNewConversation}
                  className="w-9 h-9 rounded-full bg-clay-bg shadow-clay md:bg-white/35 flex items-center justify-center shrink-0"
                  aria-label="新建对话"
                  title="新建对话"
                >
                  <Plus className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setHistoryOpen((value) => !value)}
                  className="w-9 h-9 rounded-full bg-clay-bg shadow-clay md:bg-white/35 flex items-center justify-center shrink-0"
                  aria-label="历史对话"
                  title="历史对话"
                >
                  <History className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  className="w-9 h-9 rounded-full bg-clay-bg shadow-clay md:bg-white/35 flex items-center justify-center shrink-0"
                  aria-label="关闭"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="mx-4 md:mx-auto md:w-[min(920px,calc(100vw-3rem))] mb-2 md:mb-0 shrink-0 rounded-clay-pill md:rounded-clay-lg bg-clay-yellow-100 text-clay-yellow-ink shadow-clay px-3.5 py-2 md:px-5 md:py-3 flex items-start gap-2.5">
              <ShieldAlert className="w-4 h-4 md:w-5 md:h-5 mt-0.5 shrink-0" strokeWidth={2.5} />
              <span className="text-[11px] md:text-sm leading-5 md:leading-6 font-bold">
                AI 仅做预诊断，不承诺退款或替代审核；截图含密钥、订单号请先打码。
              </span>
            </div>

            {historyOpen && (
              <div className="absolute left-4 right-4 top-[7.25rem] bottom-[9.5rem] md:left-6 md:right-auto md:top-24 md:bottom-8 md:w-80 z-20 rounded-clay bg-clay-bg/95 shadow-clay border-2 border-white/35 p-3 overflow-hidden flex flex-col">
                <div className="flex items-center justify-between gap-2 mb-3">
                  <div className="flex items-center gap-2 font-black text-clay-ink">
                    <MessageSquare className="w-4 h-4 text-clay-pink-300" />
                    历史对话
                  </div>
                  <button
                    type="button"
                    onClick={startNewConversation}
                    className="h-8 px-3 rounded-full bg-clay-pink-100 text-clay-pink-ink shadow-clay text-xs font-black"
                  >
                    新建
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto space-y-2 pr-1">
                  {historyLoading && (
                    <div className="text-xs font-bold text-clay-faint px-2 py-4">正在读取...</div>
                  )}
                  {!historyLoading && historyError && (
                    <div className="rounded-[18px] bg-clay-pink-100/80 px-3 py-3 text-xs font-bold leading-5 text-clay-pink-ink shadow-clay-sm">
                      {historyError}
                    </div>
                  )}
                  {!historyLoading && !historyError && conversations.length === 0 && (
                    <div className="text-xs font-bold text-clay-faint px-2 py-4">还没有历史对话</div>
                  )}
                  {conversations.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => openConversation(item)}
                      className={`w-full text-left rounded-[18px] px-3 py-3 shadow-clay-sm ${
                        Number(conversationId) === Number(item.id) ? 'bg-clay-pink-100 text-clay-pink-ink' : 'bg-white/45 text-clay-ink'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-black">{item.title || '新的对话'}</div>
                          <div className="mt-1 line-clamp-2 text-[11px] leading-5 font-bold opacity-75">
                            {item.last_message || '暂无回复'}
                          </div>
                          <div className="mt-1 text-[10px] font-bold opacity-55">{formatAssistantTime(item.updated_at)}</div>
                        </div>
                        <span
                          role="button"
                          tabIndex={0}
                          onClick={(event) => removeConversation(event, item)}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter' || event.key === ' ') removeConversation(event, item)
                          }}
                          className="w-7 h-7 rounded-full bg-clay-bg/80 shadow-clay-sm flex items-center justify-center shrink-0"
                          aria-label="删除历史对话"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div
              ref={scrollRef}
              className="flex-1 min-h-0 overflow-y-auto px-4 pt-3 pb-4 md:px-6 md:pt-10 md:pb-6 md:bg-transparent md:shadow-none space-y-3 md:space-y-0"
            >
              <div className="mx-auto w-full md:max-w-[920px] min-h-full flex flex-col justify-end gap-3 md:gap-8">
                {messages.length === 0 && (
                  <ChatBubble
                    message={{
                      id: 'opening',
                      role: 'assistant',
                      content: openingContent,
                      streaming: openingStreaming,
                    }}
                  />
                )}
                {messages.map((message) => (
                  <ChatBubble
                    key={message.id}
                    message={message}
                    onUseBalance={continueWithBalance}
                    onToggleReasoning={toggleReasoning}
                    disabled={loading}
                  />
                ))}
              </div>
            </div>

            <div className="relative z-30 shrink-0 mx-auto w-full px-4 pt-2 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] md:w-[min(920px,calc(100vw-3rem))] md:px-0 md:pt-2 md:pb-8">
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
                <div className="mb-2 rounded-clay bg-clay-pink-100 text-clay-pink-ink px-4 py-2 text-xs font-bold shadow-clay">
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

                <div className="mb-2 grid grid-cols-2 gap-2 md:flex md:items-center md:justify-end">
                  <AssistantClaySelect
                    label="余额分组"
                    value={selectedPaidGroup}
                    onChange={setSelectedPaidGroup}
                    options={groupOptions}
                    disabled={loading || groupOptions.length === 0}
                  />
                  <AssistantClaySelect
                    label="余额模型"
                    value={selectedPaidModel}
                    onChange={setSelectedPaidModel}
                    options={modelOptions}
                    disabled={loading || modelOptions.length === 0}
                    align="right"
                  />
                </div>
                {balanceMode && (
                  <div className="mb-2 rounded-clay-pill bg-clay-blue-100/70 px-3 py-1.5 text-[11px] font-black text-clay-blue-ink shadow-clay-sm">
                    已确认使用余额续聊，本次打开后不再重复提醒。
                  </div>
                )}

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
                      {currentUsageLabel} · 截图 {(imageTotal / 1024).toFixed(0)}KB
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => submit()}
                    disabled={loading}
                    className="h-12 md:h-10 min-w-[112px] md:min-w-0 shrink-0 px-5 md:px-6 rounded-full bg-clay-blue-100 text-clay-blue-ink shadow-clay flex items-center justify-center gap-2 font-black whitespace-nowrap leading-none disabled:opacity-60 disabled:cursor-not-allowed"
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
