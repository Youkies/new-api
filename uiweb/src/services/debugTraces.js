import api from './api.js'

export async function listDebugTraces({ p = 1, size = 50, status = '', keyword = '', requestId = '' } = {}) {
  const qs = new URLSearchParams({ p: String(p), size: String(size) })
  if (status) qs.set('status', status)
  if (keyword) qs.set('keyword', keyword)
  if (requestId) qs.set('request_id', requestId)
  const res = await api.get(`/api/ui/admin/debug-traces?${qs.toString()}`)
  return res.data
}

export async function getDebugTrace(id) {
  const res = await api.get(`/api/ui/admin/debug-traces/${id}`)
  return res.data
}

export async function downloadDebugTraceLog(id) {
  const res = await api.get(`/api/ui/admin/debug-traces/${id}/download`, { responseType: 'blob' })
  return res.data
}

export async function deleteDebugTrace(id) {
  const res = await api.delete(`/api/ui/admin/debug-traces/${id}`)
  return res.data
}

export async function getDebugConnectivitySettings() {
  const res = await api.get('/api/ui/admin/debug-traces/settings')
  return res.data
}

export async function saveDebugConnectivitySettings(payload) {
  const res = await api.put('/api/ui/admin/debug-traces/settings', payload)
  return res.data
}
