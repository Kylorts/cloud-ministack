import { Navigate, Route, Routes } from 'react-router-dom'
import { isAuthenticated, getStoredUser } from './services/auth'
import LandingPage from './pages/LandingPage'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import DashboardPage from './pages/DashboardPage'
import AdminDashboardPage from './pages/AdminDashboardPage'
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
    <Routes>
      <Route path="/login" element={<PublicRoute><LoginPage /></PublicRoute>} />
      <Route path="/register" element={<PublicRoute><RegisterPage /></PublicRoute>} />

      <Route path="/dashboard" element={
        <PrivateRoute><DashboardPage /></PrivateRoute>
      } />

      <Route path="/admin" element={
        <AdminRoute><AdminDashboardPage /></AdminRoute>
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

      <Route path="/storage/buckets/:id" element={
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

      <Route path="/hosting/sites/:id" element={
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
  )
}
