import api from './api'

export const getMySubscription = (category = 'storage') =>
  api.get('/subscriptions/me', { params: { category } })
export const subscribe = (planId) => api.post('/subscriptions', { plan_id: planId })
export const cancelSubscription = (category = 'storage') =>
  api.delete('/subscriptions/me', { params: { category } })
