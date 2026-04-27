import api from './api.js'

export async function topupInfo() {
  const res = await api.get('/api/user/topup/info')
  return res.data
}

export async function quoteAmount(payload) {
  const res = await api.post('/api/user/amount', payload)
  return res.data
}

export async function redeem(key) {
  const res = await api.post('/api/user/topup', { key })
  return res.data
}

export async function requestPay(payload) {
  const res = await api.post('/api/user/pay', payload)
  return res.data
}

export async function affInfo() {
  const res = await api.get('/api/user/aff')
  return res.data
}

export async function affTransfer(payload) {
  const res = await api.post('/api/user/aff_transfer', payload)
  return res.data
}

export async function listSubscriptionPlans() {
  const res = await api.get('/api/subscription/plans')
  return res.data
}

export async function currentSubscription() {
  const res = await api.get('/api/subscription/self')
  return res.data
}
