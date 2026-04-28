import axios from 'axios'
import { isDebugMode, mockApiResponse } from '../utils/debugMode.js'

const realAdapter = axios.getAdapter(axios.defaults.adapter)

const api = axios.create({
  baseURL: '',
  withCredentials: true,
  timeout: 30_000,
})

api.defaults.adapter = async (config) => {
  if (isDebugMode()) {
    const mocked = await mockApiResponse(config)
    if (mocked) {
      return {
        data: mocked.data,
        status: mocked.status ?? 200,
        statusText: mocked.statusText ?? 'OK',
        headers: mocked.headers ?? {},
        config,
        request: null,
      }
    }
  }
  return realAdapter(config)
}

// Attach New-API-User header if we know the user id.
api.interceptors.request.use((config) => {
  try {
    const raw = localStorage.getItem('user')
    if (raw) {
      const u = JSON.parse(raw)
      if (u && u.id) config.headers['New-API-User'] = String(u.id)
    }
  } catch (_) {
    /* ignore */
  }
  return config
})

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (!isDebugMode() && err?.response?.status === 401) {
      try {
        localStorage.removeItem('user')
      } catch (_) {}
    }
    return Promise.reject(err)
  },
)

export default api
