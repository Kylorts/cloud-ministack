import api from './api'
import { pinHeader } from './security'

export const getHostingUsage = () => api.get('/hosting/usage')
export const getSites = () => api.get('/hosting/sites')
export const createSite = (siteName) => api.post('/hosting/sites', { site_name: siteName })
export const getSite = (id) => api.get(`/hosting/sites/${id}`)
export const deleteSite = (id, pin) => api.delete(`/hosting/sites/${id}`, pinHeader(pin))

export const deploySite = (siteId, file, prefix = '') => {
  const formData = new FormData()
  formData.append('file', file)
  if (prefix) formData.append('prefix', prefix)
  return api.post(`/hosting/sites/${siteId}/deploy`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
}

export const rollbackDeployment = (siteId, deploymentId) =>
  api.post(`/hosting/sites/${siteId}/deployments/${deploymentId}/rollback`)

export const deleteDeployment = (siteId, deploymentId) =>
  api.delete(`/hosting/sites/${siteId}/deployments/${deploymentId}`)
