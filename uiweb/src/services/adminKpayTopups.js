import api from './api.js'

export async function adminListKPayTopUps({
  p = 1,
  size = 20,
  status = '',
  keyword = '',
} = {}) {
  const qs = new URLSearchParams({ p: String(p), page_size: String(size) })
  if (status) qs.set('status', status)
  if (keyword) qs.set('keyword', keyword)
  const res = await api.get(`/api/ui/admin/topups/kpay?${qs.toString()}`)
  return res.data
}

export async function adminReplayKPayTopUp(tradeNo) {
  const res = await api.post(`/api/ui/admin/topups/kpay/${encodeURIComponent(tradeNo)}/replay`)
  return res.data
}
