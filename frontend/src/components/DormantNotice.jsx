import { useNavigate } from 'react-router-dom'
import './DormantNotice.css'

/**
 * Panel "layanan dorman" — ditampilkan saat user PERNAH berlangganan kategori
 * ini tapi langganannya sudah dihentikan. Resource lama tidak ditampilkan
 * (disimpan, akan aktif lagi setelah berlangganan).
 *
 * Props: serviceName, paketPath
 */
export default function DormantNotice({ serviceName = 'layanan ini', paketPath = '/paket' }) {
  const navigate = useNavigate()
  return (
    <div className="dormant-notice">
      <div className="dormant-icon">
        <svg width="40" height="40" viewBox="0 0 24 24" fill="none">
          <path d="M12 2v6m0 8v6M4.93 4.93l4.24 4.24m5.66 5.66l4.24 4.24M2 12h6m8 0h6M4.93 19.07l4.24-4.24m5.66-5.66l4.24-4.24"
            stroke="#9ca3af" strokeWidth="1.5" strokeLinecap="round" opacity="0.5"/>
          <circle cx="12" cy="12" r="3.5" stroke="#6b7280" strokeWidth="1.6"/>
        </svg>
      </div>
      <h2 className="dormant-title">Langganan Dihentikan</h2>
      <p className="dormant-desc">
        Layanan <strong>{serviceName}</strong> Anda saat ini <strong>nonaktif (dorman)</strong>.
        Data Anda tetap tersimpan dan akan dapat diakses kembali setelah Anda berlangganan lagi.
      </p>
      <button className="dormant-btn" onClick={() => navigate(paketPath)}>
        Berlangganan Lagi
      </button>
    </div>
  )
}
