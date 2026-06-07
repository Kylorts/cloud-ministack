import api from './api'
import { pinHeader } from './security'

export const getMySubscription = (category = 'storage') =>
  api.get('/subscriptions/me', { params: { category } })
export const subscribe = (planId) => api.post('/subscriptions', { plan_id: planId })
export const cancelSubscription = (category = 'storage', pin) =>
  api.delete('/subscriptions/me', { params: { category }, ...pinHeader(pin) })
