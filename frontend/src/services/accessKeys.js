import api from './api'
import { pinHeader } from './security'

export const getAccessKeys = (category = 'storage') =>
  api.get('/access-keys', { params: { category } })

export const createAccessKey = (category, data) =>
  api.post('/access-keys', data, { params: { category } })

export const getKeyPolicies = (category = 'storage') =>
  api.get('/access-keys/policies', { params: { category } })

export const revokeAccessKey = (keyId, pin) =>
  api.post(`/access-keys/${keyId}/revoke`, null, pinHeader(pin))
