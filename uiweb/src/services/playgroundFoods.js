import api from './api.js'

function foodFormData(payload = {}) {
  const data = new FormData()
  for (const key of ['name', 'description', 'category', 'icon', 'review_note']) {
    if (payload[key] !== undefined && payload[key] !== null) data.append(key, payload[key])
  }
  if (payload.image) data.append('image', payload.image)
  return data
}

export async function listPlaygroundFoods() {
  const res = await api.get('/api/ui/playground/foods')
  return res.data
}

export async function submitPlaygroundFood(payload) {
  const res = await api.post('/api/ui/playground/foods/submissions', foodFormData(payload))
  return res.data
}

export async function createPrivatePlaygroundFood(payload) {
  const res = await api.post('/api/ui/playground/foods/private', foodFormData(payload))
  return res.data
}

export async function deletePrivatePlaygroundFood(id) {
  const res = await api.delete(`/api/ui/playground/foods/private/${id}`)
  return res.data
}

export async function adminListPlaygroundFoods({
  p = 1,
  size = 50,
  status = '',
  keyword = '',
} = {}) {
  const qs = new URLSearchParams({ p: String(p), size: String(size) })
  if (status) qs.set('status', status)
  if (keyword) qs.set('keyword', keyword)
  const res = await api.get(`/api/ui/admin/playground-foods?${qs.toString()}`)
  return res.data
}

export async function adminUpdatePlaygroundFood(id, payload) {
  const res = await api.put(`/api/ui/admin/playground-foods/${id}`, foodFormData(payload))
  return res.data
}

export async function adminApprovePlaygroundFood(id, payload) {
  const res = await api.post(`/api/ui/admin/playground-foods/${id}/approve`, foodFormData(payload))
  return res.data
}

export async function adminRejectPlaygroundFood(id, payload) {
  const res = await api.post(`/api/ui/admin/playground-foods/${id}/reject`, payload)
  return res.data
}

export async function adminDeletePlaygroundFood(id) {
  const res = await api.delete(`/api/ui/admin/playground-foods/${id}`)
  return res.data
}
