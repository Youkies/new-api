import api from './api.js'

export async function getPageConfig() {
  const res = await api.get('/api/ui/page-config')
  return res.data
}

export async function adminGetPageConfig() {
  const res = await api.get('/api/ui/admin/page-config')
  return res.data
}

export async function adminSavePageConfig(payload) {
  const res = await api.put('/api/ui/admin/page-config', payload)
  return res.data
}
