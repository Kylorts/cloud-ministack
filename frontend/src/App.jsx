import { useEffect } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { isAuthenticated, getStoredUser } from './services/auth'
import LandingPage from './pages/LandingPage'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import LupaSandiPage from './pages/LupaSandiPage'
import ResetSandiPage from './pages/ResetSandiPage'
import DashboardPage from './pages/DashboardPage'
import AdminDashboardPage from './pages/AdminDashboardPage'
import AdminUsersPage from './pages/AdminUsersPage'
import AdminUserDetailPage from './pages/AdminUserDetailPage'
import AdminSubscriptionsPage from './pages/AdminSubscriptionsPage'
import AdminSubscriptionDetailPage from './pages/AdminSubscriptionDetailPage'
import AdminTransactionsPage from './pages/AdminTransactionsPage'
import AdminMonitoringPage from './pages/AdminMonitoringPage'
import AdminStorageBucketsPage from './pages/AdminStorageBucketsPage'
import AdminBucketDetailPage from './pages/AdminBucketDetailPage'
import AdminHostingSitesPage from './pages/AdminHostingSitesPage'
import AdminSystemLogsPage from './pages/AdminSystemLogsPage'
import AdminAuditLogPage from './pages/AdminAuditLogPage'
import AdminAccessKeysGlobalPage from './pages/AdminAccessKeysGlobalPage'
import AdminIamPage from './pages/AdminIamPage'
import PaketPage from './pages/PaketPage'
import LanggananPage from './pages/LanggananPage'
import StoragePage from './pages/StoragePage'
import BucketDetailPage from './pages/BucketDetailPage'
import KuotaPage from './pages/KuotaPage'
import AktivitasPage from './pages/AktivitasPage'
import HostingPage from './pages/HostingPage'
import SiteDetailPage from './pages/SiteDetailPage'
import AccessKeysPage from './pages/AccessKeysPage'
import KeamananPage from './pages/KeamananPage'

// Judul tab per halaman (tanpa simbol). Path tak dikenal → "JadeStack".
const PAGE_TITLES = [
  [/^\/login$/, 'Masuk'],
  [/^\/register$/, 'Daftar'],
  [/^\/lupa-sandi$/, 'Lupa Kata Sandi'],
  [/^\/reset-sandi$/, 'Atur Ulang Kata Sandi'],
  [/^\/dashboard$/, 'Dashboard'],
  [/^\/paket$/, 'Paket Langganan'],
  [/^\/langganan$/, 'Langganan'],
  [/^\/storage$/, 'Penyimpanan'],
  [/^\/storage\/buckets\/[^/]+$/, 'Detail Bucket'],
  [/^\/kuota$/, 'Kuota'],
  [/^\/aktivitas$/, 'Aktivitas'],
  [/^\/hosting$/, 'Hosting'],
  [/^\/hosting\/sites\/[^/]+$/, 'Detail Situs'],
  [/^\/access-keys$/, 'Access Key'],
  [/^\/keamanan$/, 'Keamanan'],
  [/^\/admin$/, 'Dashboard Admin'],
  [/^\/admin\/pengguna$/, 'Manajemen Pengguna'],
  [/^\/admin\/pengguna\/[^/]+$/, 'Detail Pengguna'],
  [/^\/admin\/langganan$/, 'Langganan'],
  [/^\/admin\/langganan\/[^/]+$/, 'Detail Langganan'],
  [/^\/admin\/transaksi$/, 'Riwayat Langganan'],
  [/^\/admin\/monitoring$/, 'Monitoring Sumber Daya'],
  [/^\/admin\/monitoring\/storage$/, 'Bucket'],
  [/^\/admin\/monitoring\/storage\/[^/]+$/, 'Detail Bucket'],
  [/^\/admin\/monitoring\/hosting$/, 'Situs Hosting'],
  [/^\/admin\/logs$/, 'Log Sistem'],
  [/^\/admin\/audit$/, 'Audit Admin'],
  [/^\/admin\/keys$/, 'Access Key Global'],
  [/^\/admin\/iam$/, 'Policy IAM'],
]

function TitleManager() {
  const { pathname } = useLocation()
  useEffect(() => {
    const match = PAGE_TITLES.find(([re]) => re.test(pathname))
    document.title = match ? match[1] : 'JadeStack'
  }, [pathname])
  return null
}

function PrivateRoute({ children }) {
  return isAuthenticated() ? children : <Navigate to="/login" replace />
}

// Hanya admin. User biasa → dilempar ke dashboard. Belum login → ke login.
function AdminRoute({ children }) {
  if (!isAuthenticated()) return <Navigate to="/login" replace />
  return getStoredUser()?.role === 'admin'
    ? children
    : <Navigate to="/dashboard" replace />
}

// Halaman publik (login/register): kalau sudah login, arahkan ke beranda.
function PublicRoute({ children }) {
  return isAuthenticated() ? <Navigate to="/" replace /> : children
}

// Beranda: tamu → Landing Page; sudah login → dashboard/admin.
function RootRoute() {
  if (!isAuthenticated()) return <LandingPage />
  return getStoredUser()?.role === 'admin'
    ? <Navigate to="/admin" replace />
    : <Navigate to="/dashboard" replace />
}

export default function App() {
  return (
    <>
      <TitleManager />
      <Routes>
      <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
      <Route path="/register" element={<PublicRoute><RegisterPage /></PublicRoute>} />
      <Route path="/lupa-sandi" element={<LupaSandiPage />} />
      <Route path="/reset-sandi" element={<ResetSandiPage />} />

      <Route path="/dashboard" element={
        <PrivateRoute><DashboardPage /></PrivateRoute>
      } />

      <Route path="/admin" element={
        <AdminRoute><AdminDashboardPage /></AdminRoute>
      } />
      <Route path="/admin/pengguna" element={
        <AdminRoute><AdminUsersPage /></AdminRoute>
      } />
      <Route path="/admin/pengguna/:id" element={
        <AdminRoute><AdminUserDetailPage /></AdminRoute>
      } />
      <Route path="/admin/langganan" element={
        <AdminRoute><AdminSubscriptionsPage /></AdminRoute>
      } />
      <Route path="/admin/langganan/:id" element={
        <AdminRoute><AdminSubscriptionDetailPage /></AdminRoute>
      } />
      <Route path="/admin/transaksi" element={
        <AdminRoute><AdminTransactionsPage /></AdminRoute>
      } />
      <Route path="/admin/monitoring" element={
        <AdminRoute><AdminMonitoringPage /></AdminRoute>
      } />
      <Route path="/admin/monitoring/storage" element={
        <AdminRoute><AdminStorageBucketsPage /></AdminRoute>
      } />
      <Route path="/admin/monitoring/storage/:id" element={
        <AdminRoute><AdminBucketDetailPage /></AdminRoute>
      } />
      <Route path="/admin/monitoring/hosting" element={
        <AdminRoute><AdminHostingSitesPage /></AdminRoute>
      } />
      <Route path="/admin/logs" element={
        <AdminRoute><AdminSystemLogsPage /></AdminRoute>
      } />
      <Route path="/admin/audit" element={
        <AdminRoute><AdminAuditLogPage /></AdminRoute>
      } />
      <Route path="/admin/keys" element={
        <AdminRoute><AdminAccessKeysGlobalPage /></AdminRoute>
      } />
      <Route path="/admin/iam" element={
        <AdminRoute><AdminIamPage /></AdminRoute>
      } />

      <Route path="/paket" element={
        <PrivateRoute><PaketPage /></PrivateRoute>
      } />

      <Route path="/langganan" element={
        <PrivateRoute><LanggananPage /></PrivateRoute>
      } />

      <Route path="/storage" element={
        <PrivateRoute><StoragePage /></PrivateRoute>
      } />

      <Route path="/storage/buckets/:name" element={
        <PrivateRoute><BucketDetailPage /></PrivateRoute>
      } />

      <Route path="/kuota" element={
        <PrivateRoute><KuotaPage /></PrivateRoute>
      } />

      <Route path="/aktivitas" element={
        <PrivateRoute><AktivitasPage /></PrivateRoute>
      } />

      <Route path="/hosting" element={
        <PrivateRoute><HostingPage /></PrivateRoute>
      } />

      <Route path="/hosting/sites/:slug" element={
        <PrivateRoute><SiteDetailPage /></PrivateRoute>
      } />

      <Route path="/access-keys" element={
        <PrivateRoute><AccessKeysPage /></PrivateRoute>
      } />

      <Route path="/keamanan" element={
        <PrivateRoute><KeamananPage /></PrivateRoute>
      } />

      <Route path="/" element={<RootRoute />} />

      {/* Catch-all: rute tak dikenal → arahkan ke beranda (login/dashboard), bukan halaman putih */}
      <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  )
}
