import api from './api.js'

export async function getPricing() {
  const res = await api.get('/api/pricing')
  return res.data
}
