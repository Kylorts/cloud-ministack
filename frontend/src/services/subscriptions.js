import api from './api'

export const getMySubscription = () => api.get('/subscriptions/me')
export const subscribe = (planId) => api.post('/subscriptions', { plan_id: planId })
export const cancelSubscription = () => api.delete('/subscriptions/me')
