import api from './api'

export const getPlans = (category) =>
  api.get('/plans', { params: category ? { category } : {} })
export const getPlan = (id) => api.get(`/plans/${id}`)
