import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Bot,
  Check,
  Copy,
  Layers,
  Loader2,
  Plus,
  RotateCcw,
  Send,
  Settings2,
  SquarePen,
  Trash2,
  X,
  Cpu,
  AlertTriangle,
  Sparkles,
  History,
  ArrowDown,
} from 'lucide-react'
import ClayButton from '../components/clay/ClayButton.jsx'
import ClayInput from '../components/clay/ClayInput.jsx'
import ClayModal from '../components/clay/ClayModal.jsx'
import GlassSelect from '../components/clay/GlassSelect.jsx'
import PlaygroundShell from '../components/layout/PlaygroundShell.jsx'
import { useToast } from '../context/ToastContext.jsx'
import {
  appendServerMessage,
  createServerSession,
  deleteServerSession,
  filterModelsByGroup,
  listPlaygroundGroups,
  listPlaygroundPricing,
  listServerMessages,
  listServerSessions,
  pickChatModels,
  streamPlaygroundChat,
  updateServerSession,
} from '../services/playgroundAI.js'

const CONFIG_KEY = 'uiweb.playground.chat.config'

function useIsMobile() {
  const [m, setM] = useState(() => {
    if (typeof window === 'undefined') return false
    return window.matchMedia('(max-width: 767px)').matches
  })
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
function safeWriteConfig(cfg) { try { window.localStorage.setItem(CONFIG_KEY, JSON.stringify(cfg)) } catch (_) {} }

function formatTime(ts) {
  if (!ts) return ''
  const num = typeof ts === 'number' ? (ts < 1e12 ? ts * 1000 : ts) : new Date(ts).getTime()
  const d = new Date(num)
  const now = new Date()
  const sameDay = d.toDateString() === now.toDateString()
  if (sameDay) return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  return `${d.getMonth() + 1}/${d.getDate()}`
}

// ---- Lightweight markdown ----
function escapeHtml(s) {
  return s.replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]))
}
function renderInline(text) {
  let html = escapeHtml(text)
  html = html.replace(/`([^`]+)`/g, '<code class="rounded bg-black/[0.06] px-1 py-0.5 font-mono text-[0.88em] text-clay-pink-ink">$1</code>')
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong class="font-black">$1</strong>')
  html = html.replace(/(^|\W)\*([^*]+)\*(?=\W|$)/g, '$1<em>$2</em>')
  html = html.replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-clay-pink-ink underline underline-offset-2">$1</a>')
  return html
}
function CodeBlock({ lang, code }) {
  const [copied, setCopied] = useState(false)
  const onCopy = async () => {
    try { await navigator.clipboard.writeText(code); setCopied(true); setTimeout(() => setCopied(false), 1400) } catch (_) {}
  }
  return (
    <div className="my-2.5 overflow-hidden rounded-2xl bg-[#1f2533]">
      <div className="flex items-center justify-between border-b border-white/5 px-3 py-1.5 text-[11px] font-bold text-white/60">
        <span className="font-mono uppercase tracking-wider">{lang || 'code'}</span>
        <button type="button" onClick={onCopy} className="inline-flex items-center gap-1 rounded px-2 py-0.5 font-bold transition hover:bg-white/10" aria-label="复制代码">
          {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
          {copied ? '已复制' : '复制'}
        </button>
      </div>
      <pre className="overflow-x-auto px-3 py-2 text-[12.5px] leading-relaxed text-white/90"><code className="font-mono">{code}</code></pre>
    </div>
  )
}
function MarkdownLite({ text }) {
  const parts = useMemo(() => {
    const out = []
    const re = /```(\w*)\n([\s\S]*?)(?:```|$)/g
    let last = 0; let m
    while ((m = re.exec(text)) !== null) {
      if (m.index > last) out.push({ kind: 'p', text: text.slice(last, m.index) })
      out.push({ kind: 'code', lang: m[1] || '', code: m[2] })
      last = re.lastIndex
    }
    if (last < text.length) out.push({ kind: 'p', text: text.slice(last) })
    return out
  }, [text])
  return (
    <div className="space-y-1 text-[15px] leading-7 text-clay-ink">
      {parts.map((part, i) => {
        if (part.kind === 'code') return <CodeBlock key={i} lang={part.lang} code={part.code} />
        const paragraphs = part.text.split(/\n{2,}/)
        return (
          <Fragment key={i}>
            {paragraphs.map((p, j) => {
              const lines = p.split('\n').map((l) => l.trimEnd()).filter((l) => l.length > 0)
              if (lines.length === 0) return null
              const isBullet = lines.every((l) => /^[-*+]\s+/.test(l))
              const isOrdered = lines.every((l) => /^\d+\.\s+/.test(l))
              if (isBullet) return (
                <ul key={`${i}-${j}`} className="list-inside list-disc space-y-1 pl-1">
                  {lines.map((l, k) => (<li key={k} dangerouslySetInnerHTML={{ __html: renderInline(l.replace(/^[-*+]\s+/, '')) }} />))}
                </ul>
              )
              if (isOrdered) return (
                <ol key={`${i}-${j}`} className="list-inside list-decimal space-y-1 pl-1">
                  {lines.map((l, k) => (<li key={k} dangerouslySetInnerHTML={{ __html: renderInline(l.replace(/^\d+\.\s+/, '')) }} />))}
                </ol>
              )
              if (/^#{1,6}\s+/.test(lines[0])) {
                const level = lines[0].match(/^(#{1,6})\s+/)[1].length
                const Tag = `h${Math.min(level + 1, 6)}`
                const head = lines[0].replace(/^#{1,6}\s+/, '')
                const rest = lines.slice(1).join('\n')
                return (
                  <Fragment key={`${i}-${j}`}>
                    <Tag className="mt-2 text-[17px] font-black" dangerouslySetInnerHTML={{ __html: renderInline(head) }} />
                    {rest && <p dangerouslySetInnerHTML={{ __html: renderInline(rest).replace(/\n/g, '<br />') }} />}
                  </Fragment>
                )
              }
              return <p key={`${i}-${j}`} dangerouslySetInnerHTML={{ __html: renderInline(p).replace(/\n/g, '<br />') }} />
            })}
          </Fragment>
        )
      })}
    </div>
  )
}

// ---- defaults ----
const DEFAULT_PARAMS = {
  temperature: 0.7,
  top_p: 1,
  max_tokens: 4096,
  system_prompt: '',
  enableTemperature: true,
  enableTopP: false,
  enableMaxTokens: false,
}
const SUGGESTIONS = [
  '帮我用三句话解释「黏土设计」的核心',
  '给我写一个 React 防抖 hook',
  '今天适合做点什么轻松的事',
  '帮我把这段中文翻译得自然一些',
]
function normalizeSession(s) {
  if (!s) return null
  return { id: s.id, title: s.title || '新对话', model: s.model || '', groupName: s.group_name || 'auto', config: s.config || '', updatedAt: s.updated_at || 0, createdAt: s.created_at || 0 }
}
function normalizeMessage(m) {
  if (!m) return null
  return { id: m.id, role: m.role, content: m.content || '', reasoning: m.reasoning || '', model: m.model || '', groupName: m.group_name || '', ts: m.created_at || Date.now(), pending: false }
}

export default function PlaygroundChat() {
  const toast = useToast()
  const isMobile = useIsMobile()
  const abortRef = useRef(null)
  const scrollRef = useRef(null)
  const inputRef = useRef(null)
  const composerWrapRef = useRef(null)

  const initialCfg = safeReadConfig() || {}
  const [group, setGroup] = useState(initialCfg.group || 'auto')
  const [model, setModel] = useState(initialCfg.model || '')
  const [params, setParams] = useState({ ...DEFAULT_PARAMS, ...(initialCfg.params || {}) })

  const [groups, setGroups] = useState([])
  const [pricing, setPricing] = useState({})
  const [loadingMeta, setLoadingMeta] = useState(true)

  const [sessions, setSessions] = useState([])
  const [activeId, setActiveId] = useState(0)
  const [messages, setMessages] = useState([])
  const [composer, setComposer] = useState('')
  const [sending, setSending] = useState(false)
  const [loadingSessions, setLoadingSessions] = useState(true)
  const [loadingMsgs, setLoadingMsgs] = useState(false)

  const [sessionsOpen, setSessionsOpen] = useState(false)
  const [paramsOpen, setParamsOpen] = useState(false)
  const [showJumpDown, setShowJumpDown] = useState(false)

  useEffect(() => { safeWriteConfig({ group, model, params }) }, [group, model, params])

  // Scroll behavior — auto scroll on new content unless user scrolled up
  const userScrolledUp = useRef(false)
  useEffect(() => {
    const el = scrollRef.current || window
    const onScroll = () => {
      const sc = scrollRef.current
      const doc = document.documentElement
      const scrollTop = sc ? sc.scrollTop : window.scrollY
      const scrollHeight = sc ? sc.scrollHeight : doc.scrollHeight
      const clientHeight = sc ? sc.clientHeight : window.innerHeight
      const distFromBottom = scrollHeight - scrollTop - clientHeight
      userScrolledUp.current = distFromBottom > 120
      setShowJumpDown(distFromBottom > 240)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])
  useEffect(() => {
    if (userScrolledUp.current) return
    window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'smooth' })
  }, [messages.length, sending])

  // Load groups + pricing
  useEffect(() => {
    let cancelled = false
    setLoadingMeta(true)
    Promise.all([listPlaygroundGroups(), listPlaygroundPricing()])
      .then(([gs, pr]) => {
        if (cancelled) return
        setGroups(gs); setPricing(pr)
        if (!group || !gs.some((g) => g.name === group)) setGroup(gs[0]?.name || 'auto')
      })
      .catch((e) => { if (!cancelled) toast(e?.response?.data?.message || e?.message || '模型/分组加载失败', 'error') })
      .finally(() => { if (!cancelled) setLoadingMeta(false) })
    return () => { cancelled = true }
  }, [])

  // Load server sessions
  useEffect(() => {
    let cancelled = false
    setLoadingSessions(true)
    listServerSessions('chat')
      .then((items) => {
        if (cancelled) return
        const list = items.map(normalizeSession).filter(Boolean)
        setSessions(list)
        if (list.length && !activeId) setActiveId(list[0].id)
      })
      .catch((e) => { if (!cancelled && e?.status !== 401 && e?.response?.status !== 401) console.warn('listServerSessions failed', e) })
      .finally(() => { if (!cancelled) setLoadingSessions(false) })
    return () => { cancelled = true }
  }, [])

  // Load messages on session change
  useEffect(() => {
    if (!activeId) { setMessages([]); return }
    let cancelled = false
    setLoadingMsgs(true)
    listServerMessages(activeId)
      .then((items) => { if (!cancelled) setMessages(items.map(normalizeMessage).filter(Boolean)) })
      .catch((e) => { if (!cancelled) console.warn('listServerMessages failed', e) })
      .finally(() => { if (!cancelled) setLoadingMsgs(false) })
    return () => { cancelled = true }
  }, [activeId])

  const chatModels = useMemo(() => pickChatModels(pricing), [pricing])
  const availableModels = useMemo(() => filterModelsByGroup(chatModels, group), [chatModels, group])
  useEffect(() => {
    if (!availableModels.length) return
    if (!model || !availableModels.some((m) => m.name === model)) setModel(availableModels[0].name)
  }, [availableModels, model])

  const ensureSession = useCallback(async (titleHint) => {
    if (activeId) return activeId
    try {
      const s = await createServerSession({ kind: 'chat', title: (titleHint || '新对话').slice(0, 60), model, groupName: group })
      if (s?.id) {
        const norm = normalizeSession(s)
        setSessions((prev) => [norm, ...prev])
        setActiveId(norm.id)
        return norm.id
      }
    } catch (e) { toast(e?.response?.data?.message || e?.message || '创建会话失败', 'error') }
    return 0
  }, [activeId, group, model, toast])

  const startNewSession = useCallback(() => {
    setActiveId(0); setMessages([]); setSessionsOpen(false)
    inputRef.current?.focus()
  }, [])
  const switchSession = useCallback((id) => { setActiveId(id); setSessionsOpen(false) }, [])
  const removeSession = useCallback(async (id) => {
    try {
      await deleteServerSession(id)
      setSessions((prev) => prev.filter((s) => s.id !== id))
      if (id === activeId) { setActiveId(0); setMessages([]) }
      toast('已删除会话', 'info')
    } catch (e) { toast(e?.response?.data?.message || e?.message || '删除失败', 'error') }
  }, [activeId, toast])

  const stopGenerating = useCallback(() => {
    if (abortRef.current) { abortRef.current.abort(); abortRef.current = null }
  }, [])

  const updateSessionTitleIfNew = useCallback(async (sid, firstUserText) => {
    const sess = sessions.find((s) => s.id === sid)
    if (!sess || (sess.title && sess.title !== '新对话')) return
    const newTitle = firstUserText.slice(0, 24) || '新对话'
    setSessions((prev) => prev.map((s) => (s.id === sid ? { ...s, title: newTitle, updatedAt: Date.now() / 1000 } : s)))
    try { await updateServerSession(sid, { title: newTitle }) } catch (_) {}
  }, [sessions])

  const handleSend = useCallback(async (overrideText) => {
    const text = (overrideText ?? composer).trim()
    if (!text) return
    if (!model) { toast('请先选择模型', 'error'); return }
    if (sending) return

    const sid = await ensureSession(text)
    if (!sid) return

    const userMsg = { role: 'user', content: text, ts: Date.now(), model, groupName: group, pending: false }
    const assistantMsg = { role: 'assistant', content: '', reasoning: '', ts: Date.now(), model, groupName: group, pending: true }
    const baseMessages = [...messages, userMsg, assistantMsg]
    setMessages(baseMessages); setComposer(''); setSending(true)
    userScrolledUp.current = false
    void updateSessionTitleIfNew(sid, text)

    const payload = {
      model, group,
      messages: [
        ...(params.system_prompt?.trim() ? [{ role: 'system', content: params.system_prompt.trim() }] : []),
        ...baseMessages.slice(0, -1).filter((m) => m.role === 'user' || m.role === 'assistant').map((m) => ({ role: m.role, content: m.content })),
      ],
    }
    if (params.enableTemperature && params.temperature !== '') payload.temperature = Number(params.temperature)
    if (params.enableTopP && params.top_p !== '') payload.top_p = Number(params.top_p)
    if (params.enableMaxTokens && params.max_tokens !== '') payload.max_tokens = Number(params.max_tokens)

    const ctrl = new AbortController()
    abortRef.current = ctrl
    let acc = '', reasoning = '', rafScheduled = false
    const flush = () => {
      rafScheduled = false
      setMessages((prev) => {
        if (!prev.length) return prev
        const next = prev.slice(); const last = { ...next[next.length - 1] }
        last.content = acc; last.reasoning = reasoning; last.pending = true
        next[next.length - 1] = last
        return next
      })
    }
    let aborted = false; let errorMsg = ''
    try {
      await streamPlaygroundChat({
        payload, signal: ctrl.signal,
        onChunk: (c) => { acc += c; if (!rafScheduled) { rafScheduled = true; requestAnimationFrame(flush) } },
        onReasoning: (c) => { reasoning += c; if (!rafScheduled) { rafScheduled = true; requestAnimationFrame(flush) } },
      })
    } catch (e) {
      aborted = e?.name === 'AbortError'
      errorMsg = aborted ? '用户中止' : (e?.message || '请求失败')
      if (!aborted) toast(errorMsg, 'error')
    } finally { abortRef.current = null }

    setMessages((prev) => {
      if (!prev.length) return prev
      const next = prev.slice(); const last = { ...next[next.length - 1] }
      last.content = acc; last.reasoning = reasoning; last.pending = false
      if (errorMsg) last.error = errorMsg
      next[next.length - 1] = last
      return next
    })
    setSending(false)
    try {
      await appendServerMessage(sid, { role: 'user', content: text, model, groupName: group })
      await appendServerMessage(sid, { role: 'assistant', content: acc, reasoning, model, groupName: group, extra: errorMsg ? JSON.stringify({ error: errorMsg }) : '' })
    } catch (e) { console.warn('append messages failed', e) }
    setSessions((prev) => {
      const idx = prev.findIndex((s) => s.id === sid); if (idx < 0) return prev
      const item = { ...prev[idx], updatedAt: Date.now() / 1000 }
      const next = prev.slice(); next.splice(idx, 1)
      return [item, ...next]
    })
    inputRef.current?.focus()
  }, [composer, ensureSession, group, messages, model, params, sending, toast, updateSessionTitleIfNew])

  const handleRegenerate = useCallback(() => {
    let lastUser = -1
    for (let i = messages.length - 1; i >= 0; i--) { if (messages[i].role === 'user') { lastUser = i; break } }
    if (lastUser < 0) return
    const userText = messages[lastUser].content
    setMessages(messages.slice(0, lastUser))
    setTimeout(() => handleSend(userText), 0)
  }, [handleSend, messages])

  const handleCopyMessage = useCallback(async (text) => {
    try { await navigator.clipboard.writeText(text); toast('已复制', 'success') } catch (_) { toast('复制失败', 'error') }
  }, [toast])

  const groupOptions = useMemo(() => groups.map((g) => ({
    value: g.name,
    label: g.name === 'auto' ? '自动' : `${g.name}${g.ratio !== undefined ? ` · ${g.ratio}x` : ''}`,
  })), [groups])
  const modelOptions = useMemo(() => availableModels.map((m) => ({
    value: m.name,
    label: m.vendor ? `${m.vendor} · ${m.name}` : m.name,
  })), [availableModels])

  const onComposerKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault()
      handleSend()
    }
  }

  const headerActions = (
    <>
      <GlassIconBtn onClick={() => setSessionsOpen(true)} aria-label="会话" title="会话">
        <History className="h-4 w-4" strokeWidth={2.8} />
      </GlassIconBtn>
      <GlassIconBtn onClick={() => setParamsOpen(true)} aria-label="参数" title="参数">
        <Settings2 className="h-4 w-4" strokeWidth={2.8} />
      </GlassIconBtn>
      <GlassIconBtn onClick={startNewSession} aria-label="新对话" title="新对话">
        <SquarePen className="h-4 w-4" strokeWidth={2.8} />
      </GlassIconBtn>
    </>
  )

  const footer = (
    <div
      ref={composerWrapRef}
      className="fixed bottom-3 left-1/2 z-20 w-full max-w-4xl -translate-x-1/2 px-3 sm:bottom-5 sm:px-6"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0)' }}
    >
      <div className="rounded-3xl border border-white/55 bg-white/55 px-3 py-3 shadow-[0_18px_60px_-18px_rgba(0,0,0,0.22)] ring-1 ring-black/[0.04] backdrop-blur-2xl sm:px-4 sm:py-3.5">
        {/* Chips row */}
        <div className="clay-scrollbar-none -mx-1 flex flex-nowrap items-center gap-1.5 overflow-x-auto px-1 pb-2 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
          <GlassSelect
            icon={<Cpu className="h-3 w-3" strokeWidth={2.8} />}
            value={model}
            onChange={setModel}
            options={modelOptions.length ? modelOptions : [{ value: '', label: loadingMeta ? '加载中…' : '无可用模型' }]}
            disabled={loadingMeta || !modelOptions.length}
            placeholder="选择模型"
            tone="pink"
            minWidth={200}
          />
          <GlassSelect
            icon={<Layers className="h-3 w-3" strokeWidth={2.8} />}
            value={group}
            onChange={setGroup}
            options={groupOptions.length ? groupOptions : [{ value: 'auto', label: '自动' }]}
            disabled={loadingMeta}
            placeholder="分组"
            tone="purple"
            minWidth={140}
          />
          {params.enableTemperature && (
            <button
              type="button"
              onClick={() => setParamsOpen(true)}
              className="inline-flex h-7 shrink-0 items-center gap-1 rounded-full border border-white/60 bg-white/55 px-2.5 text-[11.5px] font-bold text-clay-faint ring-1 ring-black/[0.04] transition hover:bg-white/80"
              title="调整温度"
            >
              T {Number(params.temperature).toFixed(1)}
            </button>
          )}
          {params.enableMaxTokens && (
            <button
              type="button"
              onClick={() => setParamsOpen(true)}
              className="inline-flex h-7 shrink-0 items-center gap-1 rounded-full border border-white/60 bg-white/55 px-2.5 text-[11.5px] font-bold text-clay-faint ring-1 ring-black/[0.04] transition hover:bg-white/80"
              title="调整 max tokens"
            >
              max {params.max_tokens}
            </button>
          )}
          {params.system_prompt && (
            <button
              type="button"
              onClick={() => setParamsOpen(true)}
              className="inline-flex h-7 shrink-0 items-center gap-1 rounded-full border border-white/60 bg-clay-yellow-100/70 px-2.5 text-[11.5px] font-bold text-[#8a6a32] ring-1 ring-amber-200/50 transition hover:brightness-105"
              title={params.system_prompt}
            >
              <Sparkles className="h-3 w-3" strokeWidth={2.8} />
              System
            </button>
          )}
        </div>
        {/* textarea */}
        <textarea
          ref={inputRef}
          value={composer}
          onChange={(e) => setComposer(e.target.value)}
          onKeyDown={onComposerKeyDown}
          placeholder={model ? '输入消息，Enter 发送，Shift+Enter 换行' : '请先选择模型'}
          rows={isMobile ? 2 : 3}
          disabled={!model || sending}
          className="block max-h-48 w-full resize-none border-0 bg-transparent px-1 py-1.5 text-[15px] font-medium text-clay-ink placeholder:font-bold placeholder:text-clay-faint/70 focus:outline-none disabled:opacity-50"
          style={{ minHeight: 44 }}
        />
        {/* footer */}
        <div className="flex items-center justify-between gap-2 pt-1.5">
          <div className="truncate text-[11px] font-bold text-clay-faint">
            {composer.length > 0 && <span>{composer.length} chars</span>}
          </div>
          <div className="flex items-center gap-2">
            {sending ? (
              <button
                type="button"
                onClick={stopGenerating}
                className="inline-flex h-9 items-center gap-1.5 rounded-full border border-clay-pink-200/60 bg-clay-pink-100/80 px-4 text-[12.5px] font-black text-clay-pink-ink shadow-[0_4px_14px_-4px_rgba(255,143,179,0.5)] ring-1 ring-clay-pink-200/40 transition hover:bg-clay-pink-100 active:scale-95"
              >
                <X className="h-3.5 w-3.5" strokeWidth={2.8} />
                停止
              </button>
            ) : (
              <button
                type="button"
                onClick={() => handleSend()}
                disabled={!model || !composer.trim()}
                className="inline-flex h-9 items-center gap-1.5 rounded-full border border-clay-pink-300/60 bg-gradient-to-br from-clay-pink-200 to-clay-pink-300 px-4 text-[12.5px] font-black text-white shadow-[0_6px_18px_-4px_rgba(255,106,136,0.5)] ring-1 ring-white/40 transition hover:brightness-105 active:scale-95 disabled:!from-white/70 disabled:!to-white/70 disabled:!text-clay-faint disabled:!shadow-none disabled:!ring-black/5 disabled:cursor-not-allowed"
              >
                <Send className="h-3.5 w-3.5" strokeWidth={2.8} />
                发送
              </button>
            )}
          </div>
        </div>
      </div>
      {showJumpDown && (
        <button
          type="button"
          onClick={() => { userScrolledUp.current = false; window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'smooth' }) }}
          className="absolute -top-12 right-3 inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/60 bg-white/85 text-clay-pink-ink shadow-[0_8px_22px_-6px_rgba(0,0,0,0.18)] ring-1 ring-black/[0.04] backdrop-blur"
          aria-label="回到最新"
        >
          <ArrowDown className="h-4 w-4" strokeWidth={2.8} />
        </button>
      )}
    </div>
  )

  return (
    <PlaygroundShell tab="chat" actions={headerActions} footer={footer}>
      {/* Messages */}
      <div ref={scrollRef} className="pt-4">
        {loadingMsgs ? (
          <div className="flex h-40 items-center justify-center text-sm font-bold text-clay-faint">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> 加载消息中…
          </div>
        ) : messages.length === 0 ? (
          <EmptyHint
            isMobile={isMobile}
            onPick={(t) => handleSend(t)}
            hasSessions={sessions.length > 0}
            onOpenSessions={() => setSessionsOpen(true)}
          />
        ) : (
          <div className="space-y-5 py-2">
            {messages.map((m, idx) => (
              <MessageBubble
                key={m.id || idx}
                msg={m}
                isLast={idx === messages.length - 1}
                sending={sending}
                onCopy={() => handleCopyMessage(m.content)}
                onRegenerate={handleRegenerate}
              />
            ))}
          </div>
        )}
      </div>

      {/* Sessions Modal */}
      <ClayModal
        open={sessionsOpen}
        onClose={() => setSessionsOpen(false)}
        title="历史会话"
        size="md"
        footer={(
          <ClayButton type="button" onClick={startNewSession}>
            <Plus className="h-4 w-4" strokeWidth={2.8} />
            新建会话
          </ClayButton>
        )}
      >
        {loadingSessions ? (
          <div className="flex h-32 items-center justify-center text-sm font-bold text-clay-faint">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> 加载中…
          </div>
        ) : sessions.length === 0 ? (
          <div className="rounded-2xl bg-clay-bg px-5 py-7 text-center text-sm font-bold text-clay-faint">
            还没有会话
          </div>
        ) : (
          <div className="-mx-1 max-h-[60vh] space-y-1 overflow-y-auto px-1">
            {sessions.map((s) => (
              <div
                key={s.id}
                className={`group flex items-center gap-2 rounded-2xl px-3 py-2.5 transition ${
                  s.id === activeId ? 'bg-clay-pink-100/70' : 'hover:bg-clay-bg/80'
                }`}
              >
                <button type="button" onClick={() => switchSession(s.id)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
                  <Bot className="h-4 w-4 shrink-0 text-clay-pink-ink" strokeWidth={2.8} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-black">{s.title || '新对话'}</div>
                    <div className="truncate text-[11px] font-bold text-clay-faint">
                      {formatTime(s.updatedAt)}
                      {s.model ? ` · ${s.model}` : ''}
                    </div>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => removeSession(s.id)}
                  className="opacity-0 group-hover:opacity-100 inline-flex h-7 w-7 items-center justify-center rounded-full text-clay-faint transition hover:bg-clay-pink-100 hover:text-clay-pink-ink sm:opacity-100"
                  aria-label="删除"
                  title="删除"
                >
                  <Trash2 className="h-3.5 w-3.5" strokeWidth={2.8} />
                </button>
              </div>
            ))}
          </div>
        )}
      </ClayModal>

      {/* Params Modal */}
      <ClayModal
        open={paramsOpen}
        onClose={() => setParamsOpen(false)}
        title="对话参数"
        size="md"
        footer={(<ClayButton type="button" onClick={() => setParamsOpen(false)}>完成</ClayButton>)}
      >
        <div className="space-y-4">
          <label className="block">
            <span className="mb-1.5 block text-sm font-black">System Prompt</span>
            <textarea
              className="clay-input min-h-24 resize-none text-sm"
              value={params.system_prompt}
              onChange={(e) => setParams((p) => ({ ...p, system_prompt: e.target.value }))}
              placeholder="设定助手的身份/风格，例如：你是一个简洁友好的助手。"
              maxLength={2000}
            />
          </label>
          <ParamRow label="Temperature" enabled={params.enableTemperature} onToggle={(v) => setParams((p) => ({ ...p, enableTemperature: v }))} value={params.temperature} onChange={(v) => setParams((p) => ({ ...p, temperature: v }))} min={0} max={2} step={0.1} hint="0 更稳定，>1 更发散" />
          <ParamRow label="Top-p" enabled={params.enableTopP} onToggle={(v) => setParams((p) => ({ ...p, enableTopP: v }))} value={params.top_p} onChange={(v) => setParams((p) => ({ ...p, top_p: v }))} min={0} max={1} step={0.05} hint="核采样阈值" />
          <ParamRow label="Max Tokens" enabled={params.enableMaxTokens} onToggle={(v) => setParams((p) => ({ ...p, enableMaxTokens: v }))} value={params.max_tokens} onChange={(v) => setParams((p) => ({ ...p, max_tokens: v }))} min={1} max={32000} step={64} hint="思考型模型建议关闭" integer />
        </div>
      </ClayModal>
    </PlaygroundShell>
  )
}

function GlassIconBtn({ children, onClick, title, 'aria-label': ariaLabel }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={ariaLabel}
      className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/60 bg-white/60 text-clay-ink ring-1 ring-black/[0.04] backdrop-blur transition hover:bg-white/85 active:scale-95"
    >
      {children}
    </button>
  )
}

function ParamRow({ label, enabled, onToggle, value, onChange, min, max, step, hint, integer }) {
  return (
    <div className="rounded-2xl bg-clay-bg p-3">
      <div className="mb-2 flex items-center justify-between">
        <div>
          <div className="text-sm font-black text-clay-ink">{label}</div>
          {hint && <div className="text-[11px] font-bold text-clay-faint">{hint}</div>}
        </div>
        <button
          type="button"
          onClick={() => onToggle(!enabled)}
          className={`inline-flex h-6 w-11 items-center rounded-full transition ${enabled ? 'bg-clay-pink-300' : 'bg-clay-bg shadow-clay-inset-sm'}`}
          aria-pressed={enabled}
        >
          <span className={`ml-0.5 inline-block h-5 w-5 rounded-full bg-white shadow-clay-sm transition ${enabled ? 'translate-x-5' : ''}`} />
        </button>
      </div>
      <ClayInput
        type="number"
        value={value}
        onChange={(e) => {
          const v = e.target.value
          if (v === '') { onChange(''); return }
          const n = integer ? parseInt(v, 10) : parseFloat(v)
          if (!Number.isNaN(n)) onChange(n)
        }}
        min={min} max={max} step={step}
        disabled={!enabled}
      />
    </div>
  )
}

function EmptyHint({ isMobile, onPick, hasSessions, onOpenSessions }) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-5 px-2 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-clay-pink-100 text-clay-pink-ink shadow-clay-sm">
        <Bot className="h-6 w-6" strokeWidth={2.6} />
      </div>
      <div>
        <h3 className="text-lg font-black sm:text-xl">开始一段新对话</h3>
        <p className="mt-1 text-[13px] font-bold text-clay-faint">直接使用你的账号分组与模型</p>
      </div>
      <div className={`flex w-full max-w-2xl ${isMobile ? 'flex-col' : 'flex-wrap justify-center'} gap-2`}>
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => onPick(s)}
            className="min-h-10 rounded-2xl bg-white/60 px-4 py-2 text-left text-sm font-bold text-clay-ink shadow-clay-sm transition hover:bg-clay-pink-100 hover:text-clay-pink-ink active:scale-[0.98]"
          >
            {s}
          </button>
        ))}
      </div>
      {hasSessions && (
        <button
          type="button"
          onClick={onOpenSessions}
          className="mt-1 inline-flex items-center gap-1 text-xs font-bold text-clay-faint hover:text-clay-pink-ink"
        >
          <History className="h-3.5 w-3.5" strokeWidth={2.8} />
          打开历史会话
        </button>
      )}
    </div>
  )
}

function MessageBubble({ msg, isLast, sending, onCopy, onRegenerate }) {
  const isUser = msg.role === 'user'
  return (
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
      <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white shadow-clay-sm ${
        isUser ? 'bg-clay-blue-200' : 'bg-gradient-to-br from-clay-pink-200 to-clay-pink-300'
      }`}>
        {isUser ? <SquarePen className="h-3.5 w-3.5" strokeWidth={2.8} /> : <Bot className="h-3.5 w-3.5" strokeWidth={2.8} />}
      </div>
      <div className={`flex min-w-0 max-w-[88%] flex-col sm:max-w-[78%] ${isUser ? 'items-end' : 'items-start'}`}>
        <div className={`break-words rounded-2xl px-3.5 py-2.5 ${
          isUser
            ? 'bg-clay-blue-100/80 text-[#1f3754]'
            : 'bg-white/85 text-clay-ink shadow-clay-sm'
        }`}>
          {msg.reasoning ? (
            <div className="mb-2 rounded-xl bg-clay-bg/70 px-2.5 py-1.5 text-[12.5px] font-medium text-clay-faint">
              <div className="mb-1 inline-flex items-center gap-1 text-[10.5px] font-black text-[#6b4d83]">
                <Sparkles className="h-2.5 w-2.5" strokeWidth={2.8} /> 思考过程
              </div>
              <div className="whitespace-pre-wrap leading-6">{msg.reasoning}</div>
            </div>
          ) : null}
          {msg.error ? (
            <div className="inline-flex items-center gap-1.5 rounded-xl bg-clay-pink-100/60 px-2.5 py-1 text-[12.5px] font-bold text-clay-pink-ink">
              <AlertTriangle className="h-3.5 w-3.5" strokeWidth={2.8} />
              {msg.error}
            </div>
          ) : msg.content ? (
            isUser ? (
              <div className="whitespace-pre-wrap break-words text-[15px] font-medium leading-7">{msg.content}</div>
            ) : (
              <MarkdownLite text={msg.content} />
            )
          ) : msg.pending ? (
            <div className="inline-flex items-center gap-2 text-sm font-bold text-clay-faint">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> 生成中…
            </div>
          ) : null}
        </div>
        <div className={`mt-1 flex items-center gap-2 px-1 text-[11px] font-bold text-clay-faint ${isUser ? 'flex-row-reverse' : ''}`}>
          {msg.ts ? <span>{formatTime(msg.ts)}</span> : null}
          {!isUser && msg.model ? <span className="hidden sm:inline">· {msg.model}</span> : null}
          {!isUser && msg.content && !msg.pending && (
            <button type="button" onClick={onCopy} className="inline-flex h-6 w-6 items-center justify-center rounded-full hover:bg-clay-bg hover:text-clay-pink-ink" title="复制" aria-label="复制">
              <Copy className="h-3 w-3" strokeWidth={2.8} />
            </button>
          )}
          {!isUser && isLast && !msg.pending && !sending && (
            <button type="button" onClick={onRegenerate} className="inline-flex h-6 w-6 items-center justify-center rounded-full hover:bg-clay-bg hover:text-clay-pink-ink" title="重试" aria-label="重试">
              <RotateCcw className="h-3 w-3" strokeWidth={2.8} />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
