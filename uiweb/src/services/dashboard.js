import api from './api.js'

export async function selfUsage(startTs, endTs, defaultTime = 'hour') {
  const res = await api.get(
    `/api/data/self/?start_timestamp=${startTs}&end_timestamp=${endTs}&default_time=${defaultTime}`,
  )
  return res.data
}

export async function uptimeStatus() {
  const res = await api.get('/api/uptime/status')
  return res.data
}
