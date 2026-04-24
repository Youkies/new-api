import api from './api.js'

export async function getCheckinStatus(month) {
  const qs = month ? `?month=${encodeURIComponent(month)}` : ''
  const res = await api.get(`/api/user/checkin${qs}`)
  return res.data
}

export async function doCheckin() {
  const res = await api.post('/api/user/checkin')
  return res.data
}
