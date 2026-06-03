import api from './api'

// Usage
export const getStorageUsage = () => api.get('/storage/usage')

// Buckets
export const getBuckets = () => api.get('/storage/buckets')
export const createBucket = (data) => api.post('/storage/buckets', data)
export const getBucket = (id) => api.get(`/storage/buckets/${id}`)
export const deleteBucket = (id) => api.delete(`/storage/buckets/${id}`)

// Objects
export const getObjects = (bucketId) => api.get(`/storage/buckets/${bucketId}/objects`)

export const uploadFile = (bucketId, file) => {
  const formData = new FormData()
  formData.append('file', file)
  return api.post(`/storage/buckets/${bucketId}/objects`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
}

export const downloadFile = (bucketId, objectId, filename) =>
  api
    .get(`/storage/buckets/${bucketId}/objects/${objectId}/download`, { responseType: 'blob' })
    .then((res) => {
      const url = window.URL.createObjectURL(new Blob([res.data]))
      const a = document.createElement('a')
      a.href = url
      a.setAttribute('download', filename)
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(url)
    })

export const deleteFile = (bucketId, objectId) =>
  api.delete(`/storage/buckets/${bucketId}/objects/${objectId}`)
