import api from './api.js'

export async function getModelReviewRankings() {
  const res = await api.get('/api/ui/model-reviews/rankings')
  return res.data
}

export async function listModelReviews(params = {}) {
  const res = await api.get('/api/ui/model-reviews', { params })
  return res.data
}

export async function getModelReviewEligibility(modelName) {
  const res = await api.get('/api/ui/model-reviews/eligibility', {
    params: { model_name: modelName },
  })
  return res.data
}

export async function saveModelReview(payload) {
  const res = await api.post('/api/ui/model-reviews', payload)
  return res.data
}

export async function markModelReviewHelpful(id) {
  const res = await api.post(`/api/ui/model-reviews/${id}/helpful`)
  return res.data
}

export async function getModelReviewPoints() {
  const res = await api.get('/api/ui/model-reviews/points')
  return res.data
}

export async function redeemModelReviewPoints(points) {
  const res = await api.post('/api/ui/model-reviews/points/redeem', { points })
  return res.data
}

export async function adminGetModelReviewSettings() {
  const res = await api.get('/api/ui/admin/model-reviews/settings')
  return res.data
}

export async function adminSaveModelReviewSettings(payload) {
  const res = await api.put('/api/ui/admin/model-reviews/settings', payload)
  return res.data
}

export async function adminListModelReviews(params = {}) {
  const res = await api.get('/api/ui/admin/model-reviews', { params })
  return res.data
}

export async function adminPatchModelReview(id, payload) {
  const res = await api.patch(`/api/ui/admin/model-reviews/${id}`, payload)
  return res.data
}
