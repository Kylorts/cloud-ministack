import api from './api'

export async function fetchAdminStats() {
  const { data } = await api.get('/admin/stats')
  return data
}

export const getAdminStats = () => api.get('/admin/stats')
export const getAdminResources = () => api.get('/admin/resources')
export const getAdminAccessKeys = () => api.get('/admin/access-keys')

// Fase B — pengguna
export const getAdminUsers = () => api.get('/admin/users')
export const getAdminUser = (id) => api.get(`/admin/users/${id}`)
export const setUserStatus = (id, status) => api.post(`/admin/users/${id}/status`, { status })

// Fase C — paket
export const getAdminPlans = () => api.get('/admin/plans')
export const createAdminPlan = (data) => api.post('/admin/plans', data)
export const updateAdminPlan = (id, data) => api.put(`/admin/plans/${id}`, data)
export const deleteAdminPlan = (id) => api.delete(`/admin/plans/${id}`)

// Fase D — langganan
export const getAdminSubscriptions = (status = 'all') =>
  api.get('/admin/subscriptions', { params: { status } })
export const getAdminSubscription = (id) => api.get(`/admin/subscriptions/${id}`)
export const adminChangePlan = (id, planId) =>
  api.post(`/admin/subscriptions/${id}/change-plan`, { plan_id: planId })

// Fase E — transaksi (dummy/simulasi)
export const getAdminTransactions = () => api.get('/admin/transactions')
export const getAdminTransaction = (id) => api.get(`/admin/transactions/${id}`)

// Fase F — monitoring sumber daya
export const getAdminMonitoring = () => api.get('/admin/monitoring')
export const getAdminStorageBuckets = (q = '') => api.get('/admin/storage-buckets', { params: { q } })
export const getAdminBucketDetail = (id) => api.get(`/admin/storage-buckets/${id}`)
export const getAdminHostingSites = (q = '') => api.get('/admin/hosting-sites', { params: { q } })
