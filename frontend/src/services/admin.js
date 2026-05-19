import api from './api'

export async function fetchAdminStats() {
  const { data } = await api.get('/admin/stats')
  return data
}
