import { useEffect, useState } from 'react'
import Navbar from '../components/Navbar'
import PinInput from '../components/PinInput'
import PinPromptModal from '../components/PinPromptModal'
import {
  changePassword, getPinStatus, setPin as apiSetPin,
  removePin as apiRemovePin, getPinErrorCode,
} from '../services/security'
import './KeamananPage.css'

/* ── util: kekuatan password ── */
function passwordStrength(pw) {
  if (!pw) return { score: 0, label: '', cls: '' }
  let score = 0
  if (pw.length >= 8) score++
  if (pw.length >= 12) score++
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++
  if (/\d/.test(pw)) score++
  if (/[^a-zA-Z0-9]/.test(pw)) score++
  const levels = [
    { label: 'Sangat lemah', cls: 'vweak' },
    { label: 'Lemah', cls: 'weak' },
    { label: 'Cukup', cls: 'fair' },
    { label: 'Kuat', cls: 'good' },
    { label: 'Sangat kuat', cls: 'strong' },
  ]
  const idx = Math.min(score, 5) - 1
  return idx < 0 ? { score: 0, label: '', cls: '' } : { score: idx + 1, ...levels[idx] }
}

function EyeIcon({ off }) {
  return off ? (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 10 8 10 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24M1 1l22 22M6.61 6.61A18.5 18.5 0 0 0 2 12s3 8 10 8a9.12 9.12 0 0 0 5.39-1.61" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/></svg>
  ) : (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M2 12s3-8 10-8 10 8 10 8-3 8-10 8-10-8-10-8Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round"/><circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.7"/></svg>
  )
}
function LockIcon() {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><rect x="4" y="10" width="16" height="11" rx="2.5" stroke="currentColor" strokeWidth="1.8"/><path d="M8 10V7a4 4 0 0 1 8 0v3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>
}
function ShieldIcon() {
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/><path d="M9 12l2 2 4-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/></svg>
}

/* ════════ Ubah Kata Sandi ════════ */
function PasswordSection() {
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [show, setShow] = useState(false)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState(null) // {type, text}
  // PIN step-up
  const [pinOpen, setPinOpen] = useState(false)
  const [pinErr, setPinErr] = useState('')

  const strength = passwordStrength(next)

  function reset() {
    setCurrent(''); setNext(''); setConfirm('')
  }

  async function submit(pin) {
    setMsg(null)
    if (next.length < 8) { setMsg({ type: 'err', text: 'Kata sandi baru minimal 8 karakter.' }); return }
    if (next !== confirm) { setMsg({ type: 'err', text: 'Konfirmasi kata sandi tidak cocok.' }); return }
    setBusy(true)
    try {
      await changePassword(current, next, pin)
      setPinOpen(false); setPinErr('')
      reset()
      setMsg({ type: 'ok', text: 'Kata sandi berhasil diubah.' })
    } catch (err) {
      const code = getPinErrorCode(err)
      if (code === 'PIN_REQUIRED') { setPinOpen(true); setPinErr(''); setBusy(false); return }
      if (code === 'PIN_INVALID') { setPinErr('PIN Transaksi salah.'); setBusy(false); return }
      const d = err.response?.data?.detail
      const text = Array.isArray(d) ? d[0]?.msg : (typeof d === 'string' ? d : 'Gagal mengubah kata sandi.')
      if (pinOpen) { setPinErr(text) } else { setMsg({ type: 'err', text }) }
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="km-card">
      <div className="km-card-head">
        <div className="km-card-icon"><LockIcon /></div>
        <div>
          <h2 className="km-card-title">Ubah Kata Sandi</h2>
          <p className="km-card-sub">Perbarui kata sandi akun Anda secara berkala untuk keamanan.</p>
        </div>
      </div>

      <form className="km-form" onSubmit={(e) => { e.preventDefault(); submit() }}>
        <div className="km-field">
          <label className="km-label">Kata Sandi Saat Ini</label>
          <div className="km-input-wrap">
            <input className="km-input" type={show ? 'text' : 'password'} value={current}
              onChange={(e) => setCurrent(e.target.value)} placeholder="••••••••" autoComplete="current-password" />
          </div>
        </div>

        <div className="km-field">
          <label className="km-label">Kata Sandi Baru</label>
          <div className="km-input-wrap">
            <input className="km-input" type={show ? 'text' : 'password'} value={next}
              onChange={(e) => setNext(e.target.value)} placeholder="Minimal 8 karakter" autoComplete="new-password" />
            <button type="button" className="km-eye" onClick={() => setShow((v) => !v)} aria-label="Tampilkan sandi">
              <EyeIcon off={show} />
            </button>
          </div>
          {next && (
            <div className="km-strength">
              <div className="km-strength-bar">
                {[1, 2, 3, 4, 5].map((i) => (
                  <span key={i} className={`km-strength-seg ${i <= strength.score ? `km-strength-seg--${strength.cls}` : ''}`} />
                ))}
              </div>
              <span className={`km-strength-label km-strength-label--${strength.cls}`}>{strength.label}</span>
            </div>
          )}
        </div>

        <div className="km-field">
          <label className="km-label">Konfirmasi Kata Sandi Baru</label>
          <div className="km-input-wrap">
            <input className="km-input" type="password" value={confirm}
              onChange={(e) => setConfirm(e.target.value)} placeholder="Ulangi kata sandi baru" autoComplete="new-password" />
          </div>
          {confirm && confirm !== next && <span className="km-field-err">Tidak cocok dengan kata sandi baru.</span>}
        </div>

        {msg && <div className={`km-msg km-msg--${msg.type}`}>{msg.text}</div>}

        <button type="submit" className="km-submit" disabled={busy || !current || !next || !confirm}>
          {busy ? 'Menyimpan...' : 'Ubah Kata Sandi'}
        </button>
      </form>

      <PinPromptModal
        open={pinOpen}
        title="Konfirmasi Ubah Kata Sandi"
        description="Anda mengaktifkan PIN Transaksi. Masukkan PIN untuk mengonfirmasi perubahan kata sandi."
        error={pinErr}
        busy={busy}
        onSubmit={(pin) => submit(pin)}
        onClose={() => { setPinOpen(false); setPinErr('') }}
      />
    </section>
  )
}

/* ════════ PIN Transaksi ════════ */
function PinSection({ hasPin, onChanged }) {
  const [mode, setMode] = useState(null) // null | 'set' | 'remove'
  const [password, setPassword] = useState('')
  const [pin, setPin] = useState('')
  const [pin2, setPin2] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState(null)

  function cancel() {
    setMode(null); setPassword(''); setPin(''); setPin2(''); setMsg(null)
  }

  async function submitSet(e) {
    e.preventDefault()
    setMsg(null)
    if (pin.length !== 6) { setMsg({ type: 'err', text: 'PIN harus 6 digit.' }); return }
    if (pin !== pin2) { setMsg({ type: 'err', text: 'Konfirmasi PIN tidak cocok.' }); return }
    setBusy(true)
    try {
      await apiSetPin(password, pin)
      cancel()
      onChanged()
    } catch (err) {
      const d = err.response?.data?.detail
      setMsg({ type: 'err', text: Array.isArray(d) ? d[0]?.msg : (d || 'Gagal menyimpan PIN.') })
    } finally { setBusy(false) }
  }

  async function submitRemove(e) {
    e.preventDefault()
    setMsg(null); setBusy(true)
    try {
      await apiRemovePin(password)
      cancel()
      onChanged()
    } catch (err) {
      const d = err.response?.data?.detail
      setMsg({ type: 'err', text: Array.isArray(d) ? d[0]?.msg : (d || 'Gagal menonaktifkan PIN.') })
    } finally { setBusy(false) }
  }

  return (
    <section className="km-card">
      <div className="km-card-head">
        <div className="km-card-icon"><ShieldIcon /></div>
        <div>
          <h2 className="km-card-title">PIN Transaksi</h2>
          <p className="km-card-sub">
            PIN 6 digit untuk mengonfirmasi aksi sensitif (cabut access key, hapus situs,
            batalkan langganan, ubah kata sandi). Bersifat opsional.
          </p>
        </div>
        <span className={`km-pin-status ${hasPin ? 'km-pin-status--on' : 'km-pin-status--off'}`}>
          {hasPin ? '● Aktif' : '○ Nonaktif'}
        </span>
      </div>

      {/* Default view */}
      {mode === null && (
        <div className="km-pin-actions">
          {hasPin ? (
            <>
              <button className="km-submit" onClick={() => setMode('set')}>Ubah PIN</button>
              <button className="km-btn-danger" onClick={() => setMode('remove')}>Nonaktifkan PIN</button>
            </>
          ) : (
            <button className="km-submit" onClick={() => setMode('set')}>Aktifkan PIN</button>
          )}
        </div>
      )}

      {/* Set / change PIN */}
      {mode === 'set' && (
        <form className="km-form" onSubmit={submitSet}>
          <div className="km-field">
            <label className="km-label">Kata Sandi Akun</label>
            <input className="km-input" type="password" value={password}
              onChange={(e) => setPassword(e.target.value)} placeholder="Verifikasi dengan kata sandi" autoComplete="current-password" />
            <span className="km-hint">Diperlukan untuk memverifikasi identitas Anda.</span>
          </div>
          <div className="km-field">
            <label className="km-label">{hasPin ? 'PIN Baru' : 'PIN (6 digit)'}</label>
            <PinInput value={pin} onChange={setPin} disabled={busy} />
          </div>
          <div className="km-field">
            <label className="km-label">Konfirmasi PIN</label>
            <PinInput value={pin2} onChange={setPin2} disabled={busy} />
          </div>
          {msg && <div className={`km-msg km-msg--${msg.type}`}>{msg.text}</div>}
          <div className="km-pin-actions">
            <button type="submit" className="km-submit" disabled={busy || !password || pin.length !== 6 || pin2.length !== 6}>
              {busy ? 'Menyimpan...' : (hasPin ? 'Simpan PIN Baru' : 'Aktifkan PIN')}
            </button>
            <button type="button" className="km-btn-cancel" onClick={cancel} disabled={busy}>Batal</button>
          </div>
        </form>
      )}

      {/* Remove PIN */}
      {mode === 'remove' && (
        <form className="km-form" onSubmit={submitRemove}>
          <div className="km-warn">
            Menonaktifkan PIN berarti aksi sensitif tidak lagi memerlukan konfirmasi PIN.
          </div>
          <div className="km-field">
            <label className="km-label">Kata Sandi Akun</label>
            <input className="km-input" type="password" value={password}
              onChange={(e) => setPassword(e.target.value)} placeholder="Verifikasi dengan kata sandi" autoComplete="current-password" />
          </div>
          {msg && <div className={`km-msg km-msg--${msg.type}`}>{msg.text}</div>}
          <div className="km-pin-actions">
            <button type="submit" className="km-btn-danger" disabled={busy || !password}>
              {busy ? 'Memproses...' : 'Nonaktifkan PIN'}
            </button>
            <button type="button" className="km-btn-cancel" onClick={cancel} disabled={busy}>Batal</button>
          </div>
        </form>
      )}
    </section>
  )
}

/* ════════ Page ════════ */
export default function KeamananPage() {
  const [hasPin, setHasPin] = useState(false)
  const [loading, setLoading] = useState(true)

  function loadPin() {
    return getPinStatus()
      .then((r) => setHasPin(r.data.has_pin))
      .catch(() => setHasPin(false))
      .finally(() => setLoading(false))
  }

  useEffect(() => { loadPin() }, [])

  return (
    <div className="km-page">
      <Navbar breadcrumbs={[
        { label: 'Ringkasan', path: '/dashboard' },
        { label: 'Keamanan & MFA' },
      ]} />

      <main className="km-main">
        <div className="km-header">
          <h1 className="km-title">Keamanan &amp; MFA</h1>
          <p className="km-subtitle">Kelola kata sandi dan PIN Transaksi untuk melindungi akun Anda.</p>
        </div>

        {loading ? (
          <div className="km-loading">Memuat...</div>
        ) : (
          <div className="km-grid">
            <PasswordSection />
            <PinSection hasPin={hasPin} onChanged={loadPin} />
          </div>
        )}
      </main>

      <footer className="km-footer">
        <span>© 2026 INI AWAN</span>
        <div className="km-footer-links"><a href="#">Dokumentasi</a><a href="#">Privasi</a><a href="#">Syarat &amp; Ketentuan</a></div>
      </footer>
    </div>
  )
}
