import api from './api.js'

export async function getAssistantClientConfig() {
  const res = await api.get('/api/ui/assistant/config')
  return res.data
}

export async function analyzeAssistant(payload) {
  const res = await api.post('/api/ui/assistant/analyze', payload)
  return res.data
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
