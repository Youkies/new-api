import axios from 'axios'

const api = axios.create({
  baseURL: '',
  withCredentials: true,
  timeout: 30_000,
})

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
    if (err?.response?.status === 401) {
      try {
        localStorage.removeItem('user')
      } catch (_) {}
    }
    return Promise.reject(err)
  },
)

export default api
