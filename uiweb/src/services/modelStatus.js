import api from './api.js'

export async function getModelStatus(window = '1h') {
  const res = await api.get('/api/model-status', { params: { window } })
  return res.data
}
