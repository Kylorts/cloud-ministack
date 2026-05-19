import { Navigate, Route, Routes } from 'react-router-dom'
import { isAuthenticated, getStoredUser } from './services/auth'
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import AdminDashboardPage from './pages/AdminDashboardPage'

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

      <Route path="/dashboard" element={
        <PrivateRoute><DashboardPage /></PrivateRoute>
      } />

      <Route path="/admin" element={
        <PrivateRoute><AdminDashboardPage /></PrivateRoute>
      } />

      {/* Root redirects based on role */}
      <Route path="/" element={<RoleRoute />} />
    </Routes>
  )
}
