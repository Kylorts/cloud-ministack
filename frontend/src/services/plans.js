import api from './api'

export const getPlans = () => api.get('/plans')
export const getPlan = (id) => api.get(`/plans/${id}`)
