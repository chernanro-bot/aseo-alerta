import { Outlet, useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Home, Settings, Gift, LogOut } from 'lucide-react'

export default function Layout({ session }) {
  const navigate = useNavigate()
  const location = useLocation()

  const handleLogout = async () => {
    await supabase.auth.signOut()
    navigate('/login')
  }

  const navItems = [
    { path: '/dashboard',    icon: Home,       label: 'Inicio' },
    { path: '/suscripcion',  icon: Gift,       label: 'Plan' },
    { path: '/configuracion',icon: Settings,   label: 'Ajustes' },
  ]

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-40 safe-top">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl">🧹</span>
            <span className="font-bold text-gray-900 text-lg tracking-tight">Aseo Alerta</span>
          </div>
          <button
            onClick={handleLogout}
            className="p-2 text-gray-400 hover:text-gray-700 rounded-xl transition-colors"
            aria-label="Cerrar sesión"
          >
            <LogOut size={20} />
          </button>
        </div>
      </header>

      {/* Contenido principal */}
      <main className="flex-1 max-w-lg mx-auto w-full px-4 py-6 pb-28">
        <Outlet />
      </main>

      {/* Navegación inferior (mobile) */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 z-40 safe-bottom">
        <div className="max-w-lg mx-auto flex">
          {navItems.map(({ path, icon: Icon, label }) => {
            const active = location.pathname.startsWith(path)
            return (
              <button
                key={path}
                onClick={() => navigate(path)}
                className={`flex-1 flex flex-col items-center gap-1 py-3 transition-colors ${
                  active ? 'text-brand-600' : 'text-gray-400'
                }`}
              >
                <Icon size={22} strokeWidth={active ? 2.5 : 1.8} />
                <span className={`text-xs font-medium ${active ? 'text-brand-600' : 'text-gray-400'}`}>
                  {label}
                </span>
              </button>
            )
          })}
        </div>
      </nav>
    </div>
  )
}
