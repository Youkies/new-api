import api from './api.js'

export async function getRefundCandidates() {
  const res = await api.get('/api/ui/refund-appeals/candidates')
  return res.data
}

export async function createRefundAppeal(payload = {}) {
  const res = await api.post('/api/ui/refund-appeals', payload)
  return res.data
}

export async function listMyRefundAppeals({ p = 1, size = 10 } = {}) {
  const qs = new URLSearchParams({ p: String(p), size: String(size) })
  const res = await api.get(`/api/ui/refund-appeals/self?${qs.toString()}`)
  return res.data
}

export async function adminListRefundAppeals({
  p = 1,
  size = 20,
  status = '',
  keyword = '',
} = {}) {
  const qs = new URLSearchParams({ p: String(p), size: String(size) })
  if (status) qs.set('status', status)
  if (keyword) qs.set('keyword', keyword)
  const res = await api.get(`/api/ui/admin/refund-appeals?${qs.toString()}`)
  return res.data
}

export async function adminGetRefundAppeal(id) {
  const res = await api.get(`/api/ui/admin/refund-appeals/${id}`)
  return res.data
}

export async function adminApproveRefundAppeal(id, payload = {}) {
  const res = await api.post(`/api/ui/admin/refund-appeals/${id}/approve`, payload)
  return res.data
}

export async function adminApproveAllRefundAppeals(payload = {}) {
  const res = await api.post('/api/ui/admin/refund-appeals/approve-all', payload)
  return res.data
}

export async function adminRejectRefundAppeal(id, payload = {}) {
  const res = await api.post(`/api/ui/admin/refund-appeals/${id}/reject`, payload)
  return res.data
}
