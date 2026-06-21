import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:8000',
  headers: { 'Content-Type': 'application/json' },
})

// Token bisa di sessionStorage (login tanpa "ingat perangkat") atau localStorage (ingat).
function readToken() {
  return sessionStorage.getItem('access_token') || localStorage.getItem('access_token')
}
function clearAuthStorage() {
  for (const s of [sessionStorage, localStorage]) {
    s.removeItem('access_token'); s.removeItem('user')
  }
}

// Attach JWT token on every request if available
api.interceptors.request.use((config) => {
  const token = readToken()
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Auto-logout on 401 — KECUALI untuk endpoint login/register (biar errornya
// ditangani inline oleh halaman, tidak memicu redirect/halaman putih).
api.interceptors.response.use(
  (res) => res,
  (err) => {
    const url = err.config?.url || ''
    const isAuthAttempt = url.includes('/auth/login') || url.includes('/auth/register')
    if (err.response?.status === 401 && !isAuthAttempt) {
      clearAuthStorage()
      if (window.location.pathname !== '/login') {
        window.location.href = '/login'
      }
    }
    return Promise.reject(err)
  }
)

export default api
