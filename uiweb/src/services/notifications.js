import api from './api.js'

export async function listNotifications({
  p = 1,
  size = 20,
  category = '',
  unread = false,
} = {}) {
  const qs = new URLSearchParams({ p: String(p), size: String(size) })
  if (category) qs.set('category', category)
  if (unread) qs.set('unread', 'true')
  const res = await api.get(`/api/ui/notifications?${qs.toString()}`)
  return res.data
}

export async function getNotificationUnreadCount() {
  const res = await api.get('/api/ui/notifications/unread-count')
  return res.data
}

export async function markNotificationRead(id) {
  const res = await api.post(`/api/ui/notifications/${id}/read`)
  return res.data
}

export async function ackNotification(id) {
  const res = await api.post(`/api/ui/notifications/${id}/ack`)
  return res.data
}

export async function markAllNotificationsRead() {
  const res = await api.post('/api/ui/notifications/read-all')
  return res.data
}

export async function adminListNotifications({
  p = 1,
  size = 50,
  category = '',
  target_type = '',
  keyword = '',
  enabled = '',
} = {}) {
  const qs = new URLSearchParams({ p: String(p), size: String(size) })
  if (category) qs.set('category', category)
  if (target_type) qs.set('target_type', target_type)
  if (keyword) qs.set('keyword', keyword)
  if (enabled !== '') qs.set('enabled', String(enabled))
  const res = await api.get(`/api/ui/admin/notifications?${qs.toString()}`)
  return res.data
}

export async function adminGetNotificationSettings() {
  const res = await api.get('/api/ui/admin/notifications/settings')
  return res.data
}

export async function adminSaveNotificationSettings(payload) {
  const res = await api.put('/api/ui/admin/notifications/settings', payload)
  return res.data
}

export async function adminCreateNotification(payload) {
  const res = await api.post('/api/ui/admin/notifications', payload)
  return res.data
}

export async function adminUpdateNotification(id, payload) {
  const res = await api.put(`/api/ui/admin/notifications/${id}`, payload)
  return res.data
}

export async function adminPatchNotification(id, payload) {
  const res = await api.patch(`/api/ui/admin/notifications/${id}`, payload)
  return res.data
}

export async function adminDeleteNotification(id) {
  const res = await api.delete(`/api/ui/admin/notifications/${id}`)
  return res.data
}
