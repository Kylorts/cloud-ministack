import api from './api'

// Helper: build config with optional Transaction PIN header
export const pinHeader = (pin) =>
  pin ? { headers: { 'X-Transaction-PIN': pin } } : {}

// Helper: extract PIN-related error code from an axios error.
// Backend returns detail: { code: 'PIN_REQUIRED' | 'PIN_INVALID', message }
export const getPinErrorCode = (err) => {
  const d = err?.response?.data?.detail
  if (d && typeof d === 'object' && d.code) return d.code
  return null
}

// ── Ganti Password ──
export const changePassword = (current_password, new_password, pin) =>
  api.post('/auth/change-password', { current_password, new_password }, pinHeader(pin))

// ── PIN Transaksi ──
export const getPinStatus = () => api.get('/auth/pin/status')
export const setPin = (password, pin) => api.post('/auth/pin', { password, pin })
export const verifyPin = (pin) => api.post('/auth/pin/verify', { pin })
export const removePin = (password) =>
  api.delete('/auth/pin', { data: { password } })
