import api from './api.js'

export async function listTokens({ p = 1, size = 50, keyword = '' } = {}) {
  const qs = new URLSearchParams({ p: String(p), size: String(size) })
  if (keyword) qs.set('keyword', keyword)
  const res = await api.get(`/api/token/?${qs.toString()}`)
  return res.data
}

export async function searchTokens({ p = 1, size = 50, keyword = '', token = '' } = {}) {
  const qs = new URLSearchParams({ p: String(p), size: String(size) })
  if (keyword) qs.set('keyword', keyword)
  if (token) qs.set('token', token)
  const res = await api.get(`/api/token/search?${qs.toString()}`)
  return res.data
}

export async function getToken(id) {
  const res = await api.get(`/api/token/${id}`)
  return res.data
}

export async function getTokenKey(id) {
  const res = await api.post(`/api/token/${id}/key`)
  return res.data
}

export async function getTokenKeysBatch(ids) {
  const res = await api.post('/api/token/batch/keys', { ids })
  return res.data
}

export async function addToken(payload) {
  const res = await api.post('/api/token/', payload)
  return res.data
}

export async function updateToken(payload) {
  const res = await api.put('/api/token/', payload)
  return res.data
}

export async function updateTokenStatus(payload) {
  const res = await api.put('/api/token/?status_only=true', payload)
  return res.data
}

export async function deleteToken(id) {
  const res = await api.delete(`/api/token/${id}`)
  return res.data
}

export async function deleteTokenBatch(ids) {
  const res = await api.post('/api/token/batch', { ids })
  return res.data
}

export async function listEnabledKeys() {
  try {
    const res = await api.get('/api/token/')
    const items = res?.data?.data?.items ?? res?.data?.data ?? []
    return items
      .filter((t) => t.status === 1 || t.Status === 1)
      .map((t) => t.key ?? t.Key)
      .filter(Boolean)
  } catch (_) {
    return []
  }
}
