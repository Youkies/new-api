import api from './api.js'

export async function getAssistantClientConfig() {
  const res = await api.get('/api/ui/assistant/config')
  return res.data
}

export async function analyzeAssistant(payload) {
  const res = await api.post('/api/ui/assistant/analyze', payload)
  return res.data
}

function getUserHeader() {
  try {
    const raw = localStorage.getItem('user')
    if (!raw) return {}
    const user = JSON.parse(raw)
    return user?.id ? { 'New-API-User': String(user.id) } : {}
  } catch (_) {
    return {}
  }
}

async function readErrorMessage(res) {
  try {
    const data = await res.json()
    return data?.message || data?.error?.message || `请求失败：HTTP ${res.status}`
  } catch (_) {
    return `请求失败：HTTP ${res.status}`
  }
}

export async function streamAssistantChat(payload, onChunk) {
  const res = await fetch('/api/ui/assistant/chat', {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...getUserHeader(),
    },
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    throw new Error(await readErrorMessage(res))
  }
  if (!res.body) return ''
  const reader = res.body.getReader()
  const decoder = new TextDecoder('utf-8')
  let fullText = ''
  while (true) {
    const { value, done } = await reader.read()
    if (done) break
    const chunk = decoder.decode(value, { stream: true })
    if (!chunk) continue
    fullText += chunk
    onChunk?.(chunk)
  }
  const tail = decoder.decode()
  if (tail) {
    fullText += tail
    onChunk?.(tail)
  }
  return fullText
}

export async function adminGetAssistantConfig() {
  const res = await api.get('/api/ui/admin/assistant/config')
  return res.data
}

export async function adminSaveAssistantConfig(payload) {
  const res = await api.put('/api/ui/admin/assistant/config', payload)
  return res.data
}

export async function adminListAssistantDocuments() {
  const res = await api.get('/api/ui/admin/assistant/documents')
  return res.data
}

export async function adminCreateAssistantDocument(payload) {
  const res = await api.post('/api/ui/admin/assistant/documents', payload)
  return res.data
}

export async function adminUpdateAssistantDocument(id, payload) {
  const res = await api.put(`/api/ui/admin/assistant/documents/${id}`, payload)
  return res.data
}

export async function adminDeleteAssistantDocument(id) {
  const res = await api.delete(`/api/ui/admin/assistant/documents/${id}`)
  return res.data
}

export async function adminListAssistantSessions({ p = 1, size = 20 } = {}) {
  const qs = new URLSearchParams({ p: String(p), size: String(size) })
  const res = await api.get(`/api/ui/admin/assistant/sessions?${qs.toString()}`)
  return res.data
}
