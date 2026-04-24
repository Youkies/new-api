import api from './api.js'

export async function getUserLogs({
  p = 1,
  size = 20,
  type,
  start_timestamp,
  end_timestamp,
  model_name,
  token_name,
  group,
  request_id,
} = {}) {
  const qs = new URLSearchParams({ p: String(p), size: String(size) })
  if (type) qs.set('type', String(type))
  if (start_timestamp) qs.set('start_timestamp', String(start_timestamp))
  if (end_timestamp) qs.set('end_timestamp', String(end_timestamp))
  if (model_name) qs.set('model_name', model_name)
  if (token_name) qs.set('token_name', token_name)
  if (group) qs.set('group', group)
  if (request_id) qs.set('request_id', request_id)
  const res = await api.get(`/api/log/self?${qs.toString()}`)
  return res.data
}

export async function getUserLogsStat() {
  const res = await api.get('/api/log/self/stat')
  return res.data
}
