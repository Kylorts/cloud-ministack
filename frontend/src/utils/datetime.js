// Backend mengirim timestamp dalam UTC TANPA penanda zona, mis. "2026-06-20T10:04:06".
// Tanpa penanda, `new Date(...)` di browser menganggapnya waktu LOKAL → meleset sebesar
// offset zona (mis. 8 jam untuk WITA). Helper ini memaksa string diperlakukan sebagai UTC,
// sehingga saat diformat via toLocale* otomatis tampil di zona waktu pengguna (mis. WITA).
export function parseUTC(s) {
  if (s == null || s === '') return new Date(NaN)
  if (s instanceof Date) return s
  const str = String(s)
  // Sudah punya info zona (Z atau ±hh[:]mm) → biarkan apa adanya.
  if (/[zZ]$|[+-]\d{2}:?\d{2}$/.test(str)) return new Date(str)
  // Naif → anggap UTC dengan menambahkan 'Z' (dukung pemisah spasi maupun 'T').
  return new Date(str.replace(' ', 'T') + 'Z')
}
