import api from './api.js'

export async function getStatus() {
  const res = await api.get('/api/status')
  return res.data?.data ?? null
}

export async function login({ username, password, turnstile }) {
  const qs = turnstile ? `?turnstile=${encodeURIComponent(turnstile)}` : ''
  const res = await api.post(`/api/user/login${qs}`, { username, password })
  return res.data
}

export async function register({ username, password, password2, email, verification_code, turnstile }) {
  const qs = turnstile ? `?turnstile=${encodeURIComponent(turnstile)}` : ''
  const res = await api.post(`/api/user/register${qs}`, {
    username,
    password,
    password2,
    email,
    verification_code,
  })
  return res.data
}

export async function requestVerificationCode({ email, turnstile }) {
  const qs = turnstile ? `&turnstile=${encodeURIComponent(turnstile)}` : ''
  const res = await api.get(`/api/verification?email=${encodeURIComponent(email)}${qs}`)
  return res.data
}

export async function sendResetEmail({ email, turnstile }) {
  const qs = turnstile ? `&turnstile=${encodeURIComponent(turnstile)}` : ''
  const res = await api.get(`/api/reset_password?email=${encodeURIComponent(email)}${qs}`)
  return res.data
}

export async function confirmReset({ email, token }) {
  const res = await api.post('/api/user/reset', { email, token })
  return res.data
}

export async function logout() {
  const res = await api.get('/api/user/logout')
  try {
    localStorage.removeItem('user')
  } catch (_) {}
  return res.data
}

export async function self() {
  const res = await api.get('/api/user/self')
  return res.data
}

export async function getSetupState() {
  const res = await api.get('/api/setup')
  return res.data
}

export async function submitSetup(payload) {
  const res = await api.post('/api/setup', payload)
  return res.data
}

export async function oauthExchange(provider, { code, state }) {
  const res = await api.get(`/api/oauth/${provider}?code=${encodeURIComponent(code ?? '')}&state=${encodeURIComponent(state ?? '')}`)
  return res.data
}
