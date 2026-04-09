import { useEffect, useState } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { supabase } from './lib/supabase'
import LandingPage from './pages/LandingPage'
import LoginPage from './pages/LoginPage'
import DashboardPage from './pages/DashboardPage'
import NewPropertyPage from './pages/NewPropertyPage'
import PropertyDetailPage from './pages/PropertyDetailPage'
import SubscriptionPage from './pages/SubscriptionPage'
import SettingsPage from './pages/SettingsPage'
import AuthCallbackPage from './pages/AuthCallbackPage'
import Layout from './components/Layout'

function PrivateRoute({ children, session }) {
  if (session === undefined) {
    // Cargando sesión
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-3">🧹</div>
          <p className="text-gray-500 text-sm">Cargando...</p>
        </div>
      </div>
    )
  }
  return session ? children : <Navigate to="/login" replace />
}

export default function App() {
  const [session, setSession] = useState(undefined)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })

    return () => subscription.unsubscribe()
  }, [])

  return (
    <Routes>
      {/* Páginas públicas */}
      <Route path="/" element={
        session ? <Navigate to="/dashboard" replace /> : <LandingPage />
      } />
      <Route path="/login" element={
        session ? <Navigate to="/dashboard" replace /> : <LoginPage />
      } />
      <Route path="/auth/callback" element={<AuthCallbackPage />} />

      {/* Páginas privadas */}
      <Route element={
        <PrivateRoute session={session}>
          <Layout session={session} />
        </PrivateRoute>
      }>
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="propiedades/nueva" element={<NewPropertyPage />} />
        <Route path="propiedades/:id" element={<PropertyDetailPage />} />
        <Route path="suscripcion" element={<SubscriptionPage />} />
        <Route path="configuracion" element={<SettingsPage />} />
      </Route>

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
