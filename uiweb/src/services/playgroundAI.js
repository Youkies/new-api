import api from './api.js'

const TEXT_ENDPOINTS = new Set([
  'openai',
  'openai-response',
  'openai-response-compact',
  'anthropic',
  'gemini',
])
const IMAGE_ENDPOINTS = new Set(['image-generation'])

export async function listPlaygroundGroups() {
  const res = await api.get('/api/user/self/groups')
  const raw = res?.data?.data || {}
  const items = Object.entries(raw).map(([name, info]) => ({
    name,
    ratio: info?.ratio,
    desc: info?.desc || '',
  }))
  items.sort((a, b) => {
    if (a.name === 'auto') return -1
    if (b.name === 'auto') return 1
    return a.name.localeCompare(b.name)
  })
  return items
}

export async function listPlaygroundPricing() {
  const res = await api.get('/api/pricing')
  return res?.data || {}
}

export function pickChatModels(pricing) {
  const items = Array.isArray(pricing?.data) ? pricing.data : []
  return items
    .filter((p) => {
      const eps = Array.isArray(p?.supported_endpoint_types) ? p.supported_endpoint_types : []
      return eps.some((e) => TEXT_ENDPOINTS.has(e))
    })
    .map((p) => ({
      name: p.model_name,
      vendor: p.vendor_name || '',
      enableGroups: Array.isArray(p.enable_groups) ? p.enable_groups : [],
      modelRatio: p.model_ratio,
      modelPrice: p.model_price,
      quotaType: p.quota_type,
    }))
}

export function pickImageModels(pricing) {
  const items = Array.isArray(pricing?.data) ? pricing.data : []
  return items
    .filter((p) => {
      const eps = Array.isArray(p?.supported_endpoint_types) ? p.supported_endpoint_types : []
      return eps.some((e) => IMAGE_ENDPOINTS.has(e))
    })
    .map((p) => ({
      name: p.model_name,
      vendor: p.vendor_name || '',
      enableGroups: Array.isArray(p.enable_groups) ? p.enable_groups : [],
      modelPrice: p.model_price,
      quotaType: p.quota_type,
    }))
}

export function filterModelsByGroup(models, group) {
  if (!group || group === 'auto') return models
  return models.filter((m) => {
    if (!m.enableGroups?.length) return true
    return m.enableGroups.includes('all') || m.enableGroups.includes(group)
  })
}

function getUserHeader() {
  try {
    const raw = localStorage.getItem('user')
    if (!raw) return null
    const u = JSON.parse(raw)
    return u && u.id ? String(u.id) : null
  } catch (_) {
    return null
  }
}

export async function streamPlaygroundChat({ payload, signal, onChunk, onReasoning }) {
  const headers = { 'Content-Type': 'application/json' }
  const uid = getUserHeader()
  if (uid) headers['New-API-User'] = uid

  const res = await fetch('/pg/chat/completions', {
    method: 'POST',
    credentials: 'include',
    headers,
    body: JSON.stringify({ ...payload, stream: true }),
    signal,
  })

  if (!res.ok || !res.body) {
    let message = `HTTP ${res.status}`
    try {
      const j = await res.json()
      message = j?.error?.message || j?.message || message
    } catch (_) {}
    const err = new Error(message)
    err.status = res.status
    throw err
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder('utf-8')
  let buf = ''
  let finishReason = ''
  let usage = null

  while (true) {
    const { value, done } = await reader.read()
    if (done) break
    buf += decoder.decode(value, { stream: true })

    // Split SSE events
    let idx
    while ((idx = buf.indexOf('\n\n')) >= 0) {
      const chunk = buf.slice(0, idx)
      buf = buf.slice(idx + 2)
      const lines = chunk.split('\n')
      for (const line of lines) {
        if (!line.startsWith('data:')) continue
        const data = line.slice(5).trim()
        if (!data) continue
        if (data === '[DONE]') {
          finishReason = finishReason || 'stop'
          continue
        }
        try {
          const obj = JSON.parse(data)
          if (obj?.usage) usage = obj.usage
          const choice = obj?.choices?.[0]
          if (!choice) continue
          if (choice.finish_reason) finishReason = choice.finish_reason
          const delta = choice.delta || {}
          if (delta.reasoning_content && onReasoning) onReasoning(delta.reasoning_content)
          if (delta.content && onChunk) onChunk(delta.content)
          if (typeof delta.content !== 'string' && typeof delta === 'string') onChunk(delta)
        } catch (_) {
          // ignore non-JSON keep-alive lines
        }
      }
    }
  }

  return { finishReason, usage }
}

// Local session storage helpers (P1 -- P2 will replace with server API)
const SESSIONS_KEY = 'uiweb.playground.chat.sessions'
const MESSAGES_KEY_PREFIX = 'uiweb.playground.chat.messages.'

export function loadLocalSessions() {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(SESSIONS_KEY)
    if (!raw) return []
    const arr = JSON.parse(raw)
    return Array.isArray(arr) ? arr : []
  } catch (_) {
    return []
  }
}

export function saveLocalSessions(list) {
  try {
    window.localStorage.setItem(SESSIONS_KEY, JSON.stringify(list.slice(0, 100)))
  } catch (_) {}
}

export function loadLocalMessages(sessionId) {
  if (!sessionId) return []
  try {
    const raw = window.localStorage.getItem(MESSAGES_KEY_PREFIX + sessionId)
    if (!raw) return []
    const arr = JSON.parse(raw)
    return Array.isArray(arr) ? arr : []
  } catch (_) {
    return []
  }
}

export function saveLocalMessages(sessionId, messages) {
  if (!sessionId) return
  try {
    window.localStorage.setItem(
      MESSAGES_KEY_PREFIX + sessionId,
      JSON.stringify(messages.slice(-200)),
    )
  } catch (_) {}
}

export function dropLocalMessages(sessionId) {
  if (!sessionId) return
  try {
    window.localStorage.removeItem(MESSAGES_KEY_PREFIX + sessionId)
  } catch (_) {}
}

// ---- Server-side session/message APIs ----

export async function listServerSessions(kind = 'chat') {
  const res = await api.get('/api/ui/playground/sessions', { params: { kind } })
  const items = res?.data?.data?.items || []
  return Array.isArray(items) ? items : []
}

export async function createServerSession({ kind = 'chat', title = '新对话', model = '', groupName = 'auto', config = '' } = {}) {
  const res = await api.post('/api/ui/playground/sessions', {
    kind,
    title,
    model,
    group_name: groupName,
    config,
  })
  return res?.data?.data || res?.data
}

export async function updateServerSession(id, patch) {
  const body = {}
  if (patch.title !== undefined) body.title = patch.title
  if (patch.model !== undefined) body.model = patch.model
  if (patch.groupName !== undefined) body.group_name = patch.groupName
  if (patch.config !== undefined) body.config = patch.config
  const res = await api.put(`/api/ui/playground/sessions/${id}`, body)
  return res?.data
}

export async function deleteServerSession(id) {
  const res = await api.delete(`/api/ui/playground/sessions/${id}`)
  return res?.data
}

export async function listServerMessages(sessionId) {
  const res = await api.get(`/api/ui/playground/sessions/${sessionId}/messages`)
  const items = res?.data?.data?.items || []
  return Array.isArray(items) ? items : []
}

export async function appendServerMessage(sessionId, { role, content = '', reasoning = '', model = '', groupName = '', extra = '' }) {
  const res = await api.post(`/api/ui/playground/sessions/${sessionId}/messages`, {
    role,
    content,
    reasoning,
    model,
    group_name: groupName,
    extra,
  })
  return res?.data?.data || res?.data
}

export async function clearServerMessages(sessionId) {
  const res = await api.delete(`/api/ui/playground/sessions/${sessionId}/messages`)
  return res?.data
}

export async function deleteServerMessage(messageId) {
  const res = await api.delete(`/api/ui/playground/messages/${messageId}`)
  return res?.data
}

// ---- Image generation ----

export async function generatePlaygroundImage({ payload, signal }) {
  const headers = { 'Content-Type': 'application/json' }
  const uid = getUserHeader()
  if (uid) headers['New-API-User'] = uid

  const res = await fetch('/pg/images/generations', {
    method: 'POST',
    credentials: 'include',
    headers,
    body: JSON.stringify(payload),
    signal,
  })

  const text = await res.text()
  let json
  try { json = text ? JSON.parse(text) : null } catch (_) { json = null }

  if (!res.ok) {
    const message = json?.error?.message || json?.message || `HTTP ${res.status}`
    const err = new Error(message)
    err.status = res.status
    throw err
  }
  return json
}

export async function savePlaygroundImage(payload) {
  const res = await api.post('/api/ui/playground/images', payload)
  return res?.data?.data || res?.data
}

export async function listSavedPlaygroundImages(limit = 60) {
  const res = await api.get('/api/ui/playground/images', { params: { limit } })
  const items = res?.data?.data?.items || []
  return Array.isArray(items) ? items : []
}

export async function deleteSavedPlaygroundImage(id) {
  const res = await api.delete(`/api/ui/playground/images/${id}`)
  return res?.data
}
