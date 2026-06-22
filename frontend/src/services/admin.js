import api from './api'

export async function fetchAdminStats() {
  const { data } = await api.get('/admin/stats')
  return data
}

export const getAdminStats = () => api.get('/admin/stats')
export const getAdminResources = () => api.get('/admin/resources')
export const getAdminAccessKeys = (params) => api.get('/admin/access-keys', { params })

// Fase B — pengguna
export const getAdminUsers = (params) => api.get('/admin/users', { params })
export const getAdminUser = (id) => api.get(`/admin/users/${id}`)
export const setUserStatus = (id, status) => api.post(`/admin/users/${id}/status`, { status })

// Fase C — paket: katalog paket TIDAK dikelola admin (read-only, di luar wewenang admin).

// Fase D — langganan
export const getAdminSubscriptions = (status = 'all', params = {}) =>
  api.get('/admin/subscriptions', { params: { status, ...params } })
export const getAdminSubscription = (id) => api.get(`/admin/subscriptions/${id}`)
export const adminFastForward = (id) => api.post(`/admin/subscriptions/${id}/fast-forward`)
export const adminSuspendSub = (id) => api.post(`/admin/subscriptions/${id}/suspend`)
export const adminUnsuspendSub = (id) => api.post(`/admin/subscriptions/${id}/unsuspend`)
export const adminExpireGrace = (id) => api.post(`/admin/subscriptions/${id}/expire-grace`)
export const adminMarkPastDue = (id) => api.post(`/admin/subscriptions/${id}/mark-past-due`)
export const adminRepairSubscription = (id) => api.post(`/admin/subscriptions/${id}/repair`)

// Riwayat langganan (event berhasil dari activity log; menggantikan "transaksi")
export const getAdminSubscriptionHistory = (params) => api.get('/admin/subscription-history', { params })

// Fase F — monitoring sumber daya
export const getAdminMonitoring = () => api.get('/admin/monitoring')
export const getAdminStorageBuckets = (q = '', params = {}) => api.get('/admin/storage-buckets', { params: { q, ...params } })
export const getAdminBucketDetail = (id) => api.get(`/admin/storage-buckets/${id}`)
export const adminRepairBucket = (id) => api.post(`/admin/storage-buckets/${id}/repair`)
export const getAdminHostingSites = (q = '', params = {}) => api.get('/admin/hosting-sites', { params: { q, ...params } })

// Fase G — keamanan & log
export const getAdminLogs = (params) => api.get('/admin/logs', { params })
export const getAdminAudit = (params) => api.get('/admin/audit', { params })
export const adminRevokeKey = (id) => api.post(`/admin/access-keys/${id}/revoke`)
export const getIamPolicies = () => api.get('/admin/iam-policies')
export const createIamPolicy = (data) => api.post('/admin/iam-policies', data)
export const updateIamPolicy = (id, data) => api.put(`/admin/iam-policies/${id}`, data)
export const deleteIamPolicy = (id) => api.delete(`/admin/iam-policies/${id}`)
