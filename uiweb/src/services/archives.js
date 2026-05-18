import api from './api.js'

export async function listArchives() {
  const res = await api.get('/api/archive/')
  return res.data
}

export async function getArchive(id) {
  const res = await api.get(`/api/archive/${id}`)
  return res.data
}

export async function createArchive(payload) {
  const res = await api.post('/api/archive/', payload)
  return res.data
}

export async function updateArchive(id, payload) {
  const res = await api.put(`/api/archive/${id}`, payload)
  return res.data
}

export async function deleteArchive(id) {
  const res = await api.delete(`/api/archive/${id}`)
  return res.data
}

export async function enableArchiveShare(id) {
  const res = await api.post(`/api/archive/${id}/share`)
  return res.data
}

export async function disableArchiveShare(id) {
  const res = await api.delete(`/api/archive/${id}/share`)
  return res.data
}

export async function createAlias(archiveId, payload) {
  const res = await api.post(`/api/archive/${archiveId}/aliases`, payload)
  return res.data
}

export async function updateAlias(archiveId, aliasId, payload) {
  const res = await api.put(`/api/archive/${archiveId}/aliases/${aliasId}`, payload)
  return res.data
}

export async function deleteAlias(archiveId, aliasId) {
  const res = await api.delete(`/api/archive/${archiveId}/aliases/${aliasId}`)
  return res.data
}

export async function getArchiveOptions() {
  const res = await api.get('/api/archive/options')
  return res.data
}

export async function getSharedArchivePreview(code) {
  const res = await api.get(`/api/archive/share/${code}`)
  return res.data
}

export async function importSharedArchive(code, payload) {
  const res = await api.post(`/api/archive/share/${code}/import`, payload || {})
  return res.data
}
