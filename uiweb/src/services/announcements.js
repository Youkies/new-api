import api from './api.js'

export async function listAnnouncements({ p = 1, size = 20 } = {}) {
  const qs = new URLSearchParams({ p: String(p), size: String(size) })
  const res = await api.get(`/api/ui/announcements?${qs.toString()}`)
  return res.data
}

export async function listActiveAnnouncements() {
  const res = await api.get('/api/ui/announcements/active')
  return res.data
}

export async function ackAnnouncement(id, payload = {}) {
  const res = await api.post(`/api/ui/announcement_acks/${id}`, payload)
  return res.data
}

export async function adminListAnnouncements({
  p = 1,
  size = 20,
  keyword = '',
  enabled = '',
} = {}) {
  const qs = new URLSearchParams({ p: String(p), size: String(size) })
  if (keyword) qs.set('keyword', keyword)
  if (enabled !== '') qs.set('enabled', String(enabled))
  const res = await api.get(`/api/ui/admin/announcements?${qs.toString()}`)
  return res.data
}

export async function adminCreateAnnouncement(payload) {
  const res = await api.post('/api/ui/admin/announcements', payload)
  return res.data
}

export async function adminUpdateAnnouncement(id, payload) {
  const res = await api.put(`/api/ui/admin/announcements/${id}`, payload)
  return res.data
}

export async function adminPatchAnnouncement(id, payload) {
  const res = await api.patch(`/api/ui/admin/announcements/${id}`, payload)
  return res.data
}

export async function adminDeleteAnnouncement(id) {
  const res = await api.delete(`/api/ui/admin/announcements/${id}`)
  return res.data
}
