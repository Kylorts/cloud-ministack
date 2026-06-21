import { useState, useCallback } from 'react'
import PinPromptModal from '../components/PinPromptModal'
import { getPinErrorCode } from '../services/security'

/**
 * Hook reusable untuk aksi yang butuh PIN Transaksi (opsional).
 *
 * Pakai:
 *   const { run, pinModal } = usePinPrompt({ title, description })
 *   run((pin) => createBucket(data, pin)).then(onSuccess).catch(...)
 *   ... render {pinModal}
 *
 * Alur: coba tanpa PIN dulu. Jika backend balas PIN_REQUIRED → munculkan modal,
 * lalu ulangi dengan PIN. PIN_INVALID → tampilkan error di modal.
 */
export function usePinPrompt({ title = 'Konfirmasi PIN', description = 'Masukkan PIN Transaksi untuk melanjutkan.' } = {}) {
  const [open, setOpen] = useState(false)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [attempt, setAttempt] = useState(null) // fungsi attempt(pin)
  const [rejecter, setRejecter] = useState(null) // reject promise saat dibatalkan

  const run = useCallback((fn) => new Promise((resolve, reject) => {
    setRejecter(() => reject)
    const tryOnce = (pin) => {
      setBusy(true)
      Promise.resolve(fn(pin))
        .then((res) => { setBusy(false); setOpen(false); setErr(''); setRejecter(null); resolve(res) })
        .catch((e) => {
          const code = getPinErrorCode(e)
          if (code === 'PIN_REQUIRED' || code === 'PIN_INVALID') {
            setErr(code === 'PIN_INVALID' ? 'PIN Transaksi salah.' : '')
            setAttempt(() => tryOnce)
            setOpen(true)
            setBusy(false)
          } else {
            setBusy(false); setOpen(false); setRejecter(null); reject(e)
          }
        })
    }
    tryOnce(undefined)
  }), [])

  function cancel() {
    setOpen(false); setErr(''); setBusy(false)
    if (rejecter) { rejecter(Object.assign(new Error('PIN dibatalkan'), { pinCancelled: true })); setRejecter(null) }
  }

  const pinModal = (
    <PinPromptModal
      open={open}
      title={title}
      description={description}
      error={err}
      busy={busy}
      onSubmit={(pin) => attempt && attempt(pin)}
      onClose={cancel}
    />
  )

  return { run, pinModal }
}
