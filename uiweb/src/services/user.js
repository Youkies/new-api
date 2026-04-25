import api from './api.js'

export async function self() {
  const res = await api.get('/api/user/self')
  return res.data
}

export async function updateSelf(payload) {
  const res = await api.put('/api/user/self', payload)
  return res.data
}

export async function updateSetting(payload) {
  const res = await api.put('/api/user/setting', payload)
  return res.data
}

export async function deleteSelf() {
  const res = await api.delete('/api/user/self')
  return res.data
}

export async function listBindings() {
  const res = await api.get('/api/user/oauth/bindings')
  return res.data
}

export async function unbind(providerId) {
  const res = await api.delete(`/api/user/oauth/bindings/${providerId}`)
  return res.data
}

export async function getCheckin(month) {
  const qs = month ? `?month=${encodeURIComponent(month)}` : ''
  const res = await api.get(`/api/user/checkin${qs}`)
  return res.data
}

export async function doCheckin() {
  const res = await api.post('/api/user/checkin')
  return res.data
}

export async function uploadAvatar(file) {
  const form = new FormData()
  form.append('avatar', file)
  const res = await api.post('/api/user/avatar', form)
  return res.data
}

export async function deleteAvatar() {
  const res = await api.delete('/api/user/avatar')
  return res.data
}

export async function get2FAStatus() {
  const res = await api.get('/api/user/2fa/status')
  return res.data
}
