import { useState } from 'react'
import { Link } from 'react-router-dom'
import './LandingPage.css'

/* ── Icons (SVG inline, sesuai tema) ── */
function CloudIcon() {
  return <svg width="26" height="26" viewBox="0 0 24 24" fill="none"><path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9z" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/></svg>
}
function GlobeIcon() {
  return <svg width="26" height="26" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.7"/><path d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18" stroke="currentColor" strokeWidth="1.7"/></svg>
}
function ShieldIcon() {
  return <svg width="26" height="26" viewBox="0 0 24 24" fill="none"><path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3Z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round"/><path d="M9 12l2 2 4-4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"/></svg>
}
function CheckIcon() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
}
function ArrowRight() {
  return <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
}

const FEATURES = [
  {
    icon: CloudIcon,
    title: 'Object Storage',
    desc: 'Penyimpanan data S3-compatible berbasis MiniStack — kelola bucket dan file dengan kuota per paket.',
    points: ['Bucket & file per paket', 'Akses via mc / boto3 (Access Key)'],
  },
  {
    icon: GlobeIcon,
    title: 'Static Hosting',
    desc: 'Deploy situs statis langsung dari ZIP, tersaji di URL khusus dengan rollback antar versi.',
    points: ['Deploy via ZIP', 'Rollback versi deployment'],
  },
  {
    icon: ShieldIcon,
    title: 'Keamanan',
    desc: 'PIN Transaksi untuk aksi sensitif, ganti kata sandi, dan kredensial akses yang disimpan ter-hash.',
    points: ['PIN Transaksi & ganti sandi', 'Access Key + Secret (hash)'],
  },
]

const PLANS = [
  {
    name: 'Storage Lite', price: 'Rp 5.000', tag: '',
    blurb: 'Untuk eksplorasi awal & proyek kecil.',
    points: ['1 GB Object Storage', '1 Bucket', 'Maks. 50 MB / file'],
    popular: false,
  },
  {
    name: 'Storage Basic', price: 'Rp 10.000', tag: 'POPULER',
    blurb: 'Langkah tepat untuk kebutuhan harian.',
    points: ['2 GB Object Storage', '2 Bucket', 'Maks. 100 MB / file'],
    popular: true,
  },
  {
    name: 'Storage Plus', price: 'Rp 20.000', tag: '',
    blurb: 'Kapasitas lebih untuk proyek berkembang.',
    points: ['3 GB Object Storage', '3 Bucket', 'Maks. 250 MB / file'],
    popular: false,
  },
]

export default function LandingPage() {
  const [imgOk, setImgOk] = useState(true)

  return (
    <div className="lp">
      {/* Navbar */}
      <nav className="lp-nav">
        <div className="lp-nav-left">
          <span className="lp-brand">JADESTACK</span>
          <div className="lp-nav-links">
            <a href="#features">Fitur</a>
            <a href="#pricing">Harga</a>
          </div>
        </div>
        <Link to="/login" className="lp-btn lp-btn--primary lp-btn--sm">Masuk Portal</Link>
      </nav>

      <main className="lp-main">
        {/* Hero */}
        <section className="lp-hero">
          <div className="lp-hero-inner">
            <h1 className="lp-hero-title">Infrastruktur Awan Lokal, Cepat &amp; Aman.</h1>
            <p className="lp-hero-sub">
              Simulasikan dan kelola object storage serta static hosting dengan mudah melalui MiniStack —
              platform lokal untuk penyimpanan S3-compatible dan hosting situs statis.
            </p>
            <div className="lp-hero-cta">
              <Link to="/register" className="lp-btn lp-btn--primary lp-btn--lg">Mulai Gratis Sekarang</Link>
              <a href="#features" className="lp-btn lp-btn--outline lp-btn--lg">Pelajari Lebih Lanjut</a>
            </div>
          </div>
          <div className="lp-hero-media">
            {imgOk ? (
              <img src="/hero.png" alt="Ilustrasi dashboard JADESTACK"
                className="lp-hero-img" onError={() => setImgOk(false)} />
            ) : (
              <div className="lp-hero-placeholder">
                <CloudIcon />
                <span>Letakkan gambar di <code>frontend/public/hero.png</code></span>
              </div>
            )}
          </div>
        </section>

        {/* Features */}
        <section className="lp-section" id="features">
          <div className="lp-section-head">
            <h2 className="lp-section-title">Layanan Kami</h2>
            <span className="lp-section-rule" />
          </div>
          <div className="lp-grid">
            {FEATURES.map((f) => {
              const Icon = f.icon
              return (
                <div key={f.title} className="lp-card">
                  <div className="lp-card-icon"><Icon /></div>
                  <h3 className="lp-card-title">{f.title}</h3>
                  <p className="lp-card-desc">{f.desc}</p>
                  <ul className="lp-card-points">
                    {f.points.map((p) => (
                      <li key={p}><span className="lp-check"><CheckIcon /></span>{p}</li>
                    ))}
                  </ul>
                </div>
              )
            })}
          </div>
        </section>

        {/* Pricing */}
        <section className="lp-section" id="pricing">
          <div className="lp-section-head">
            <h2 className="lp-section-title">Pilih Paket Anda</h2>
            <p className="lp-section-sub">Mulai kecil, tingkatkan kapan saja sesuai kebutuhan.</p>
          </div>
          <div className="lp-grid">
            {PLANS.map((p) => (
              <div key={p.name} className={`lp-plan ${p.popular ? 'lp-plan--popular' : ''}`}>
                {p.tag && <span className="lp-plan-tag">{p.tag}</span>}
                <span className="lp-plan-name">{p.name}</span>
                <div className="lp-plan-price">
                  <span className="lp-plan-amount">{p.price}</span>
                  <span className="lp-plan-period">/bulan</span>
                </div>
                <p className="lp-plan-blurb">{p.blurb}</p>
                <ul className="lp-plan-points">
                  {p.points.map((pt) => (
                    <li key={pt}><span className="lp-check"><CheckIcon /></span>{pt}</li>
                  ))}
                </ul>
                <Link to="/register" className={`lp-plan-btn ${p.popular ? 'lp-plan-btn--popular' : ''}`}>
                  Pilih Paket
                </Link>
              </div>
            ))}
          </div>
          <p className="lp-pricing-note">Tersedia juga paket Static Hosting (Lite / Basic / Plus). Lihat semua setelah masuk portal.</p>
        </section>

        {/* Final CTA */}
        <section className="lp-cta-wrap">
          <div className="lp-cta">
            <h2 className="lp-cta-title">Siap Mengudara di Awan?</h2>
            <p className="lp-cta-sub">
              Daftar gratis dan mulai kelola object storage serta static hosting Anda dalam hitungan menit.
            </p>
            <Link to="/register" className="lp-btn lp-btn--primary lp-btn--lg lp-cta-btn">
              Daftar Akun Sekarang <ArrowRight />
            </Link>
          </div>
        </section>
      </main>

      <footer className="lp-footer">
        <span>© 2026 JADESTACK.</span>
        <div className="lp-footer-links">
          <a href="#">Dokumentasi</a><a href="#">Privasi</a><a href="#">Syarat &amp; Ketentuan</a>
        </div>
      </footer>
    </div>
  )
}
