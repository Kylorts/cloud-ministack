import api from './api'

export const getActivityLogs = (limit = 50, offset = 0) =>
  api.get('/activity-logs', { params: { limit, offset } })
