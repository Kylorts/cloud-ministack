import api from './api'
import { pinHeader } from './security'

export const getMySubscription = (category = 'storage') =>
  api.get('/subscriptions/me', { params: { category } })
export const subscribe = (planId) => api.post('/subscriptions', { plan_id: planId })
export const cancelSubscription = (category = 'storage', pin) =>
  api.delete('/subscriptions/me', { params: { category }, ...pinHeader(pin) })

// Riwayat langganan (semua status & kategori) — dipakai untuk membedakan
// "belum pernah berlangganan" vs "dorman" (pernah, tapi tidak aktif).
export const getSubscriptionHistory = () => api.get('/subscriptions/history')

const ACTIVE_LIKE = ['active', 'over_quota', 'suspended', 'past_due', 'pending_payment']

// State per kategori dari riwayat: 'active' | 'dormant' | 'none'
export function categoryState(history, category) {
  const recs = (history || []).filter((s) => s.category === category)
  if (recs.some((s) => ACTIVE_LIKE.includes(s.status))) return 'active'
  if (recs.length > 0) return 'dormant'
  return 'none'
}

// Pernah berlangganan apa pun (aktif maupun dorman)?
export const everSubscribed = (history) => (history || []).length > 0
