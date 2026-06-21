import api from './api'

const TOKEN_KEY = 'access_token'
const USER_KEY = 'user'

// "Ingat perangkat ini" → localStorage (bertahan walau tab/browser ditutup).
// Tidak diingat → sessionStorage (hilang saat tab ditutup).
function persist(data, remember) {
  const store = remember ? localStorage : sessionStorage
  const other = remember ? sessionStorage : localStorage
  store.setItem(TOKEN_KEY, data.access_token)
  store.setItem(USER_KEY, JSON.stringify(data.user))
  other.removeItem(TOKEN_KEY)
  other.removeItem(USER_KEY)
}

export async function login(email, password, remember = false) {
  const { data } = await api.post('/auth/login', { email, password })
  persist(data, remember)
  return data
}

export async function register(name, email, password) {
  const { data } = await api.post('/auth/register', { name, email, password })
  persist(data, true) // akun baru → auto-login & diingat
  return data
}

export async function forgotPassword(email) {
  const { data } = await api.post('/auth/forgot-password', { email })
  return data
}

export async function resetPassword(token, newPassword) {
  const { data } = await api.post('/auth/reset-password', { token, new_password: newPassword })
  return data
}

export function logout() {
  for (const s of [localStorage, sessionStorage]) {
    s.removeItem(TOKEN_KEY)
    s.removeItem(USER_KEY)
  }
}

export function getToken() {
  return sessionStorage.getItem(TOKEN_KEY) || localStorage.getItem(TOKEN_KEY)
}

export function getStoredUser() {
  try {
    return JSON.parse(sessionStorage.getItem(USER_KEY) || localStorage.getItem(USER_KEY))
  } catch {
    return null
  }
}

export function isAuthenticated() {
  return !!getToken()
}
