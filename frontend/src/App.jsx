import { Navigate, Route, Routes } from 'react-router-dom'
import { isAuthenticated, getStoredUser } from './services/auth'
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

function RoleRoute() {
  const user = getStoredUser()
  if (!isAuthenticated()) return <Navigate to="/login" replace />
  return user?.role === 'admin'
    ? <Navigate to="/admin" replace />
    : <Navigate to="/dashboard" replace />
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />

      <Route path="/dashboard" element={
        <PrivateRoute><DashboardPage /></PrivateRoute>
      } />

      <Route path="/admin" element={
        <PrivateRoute><AdminDashboardPage /></PrivateRoute>
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

      <Route path="/" element={<RoleRoute />} />
    </Routes>
  )
}
