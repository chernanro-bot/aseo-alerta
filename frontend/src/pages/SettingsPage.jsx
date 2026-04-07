import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { User, Mail, LogOut, Bell, Moon, ChevronRight } from 'lucide-react'
import toast from 'react-hot-toast'
import Card from '../components/Card'
import { useNavigate } from 'react-router-dom'

export default function SettingsPage() {
  const navigate = useNavigate()
  const [user, setUser] = useState(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => setUser(user))
  }, [])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    navigate('/login')
  }

  const menuItems = [
    {
      section: 'Cuenta',
      items: [
        {
          icon: Mail,
          label: 'Email',
          value: user?.email,
          action: null,
        },
      ]
    },
    {
      section: 'Notificaciones',
      items: [
        {
          icon: Bell,
          label: 'Alertas WhatsApp',
          value: 'Activadas',
          action: null,
        },
      ]
    },
    {
      section: 'Sesión',
      items: [
        {
          icon: LogOut,
          label: 'Cerrar sesión',
          value: null,
          action: handleLogout,
          danger: true,
        },
      ]
    },
  ]

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-extrabold text-gray-900">Configuración</h1>
      </div>

      {/* Avatar */}
      <div className="flex items-center gap-4">
        <div className="w-16 h-16 bg-brand-100 rounded-2xl flex items-center justify-center">
          <User size={28} className="text-brand-600" />
        </div>
        <div>
          <p className="font-bold text-gray-900">{user?.email?.split('@')[0]}</p>
          <p className="text-sm text-gray-500">{user?.email}</p>
        </div>
      </div>

      {/* Menu items */}
      {menuItems.map(({ section, items }) => (
        <div key={section}>
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 px-1">{section}</p>
          <Card className="overflow-hidden divide-y divide-gray-50">
            {items.map(({ icon: Icon, label, value, action, danger }) => (
              <button
                key={label}
                onClick={action || undefined}
                disabled={!action}
                className={`w-full flex items-center gap-3 px-4 py-3.5 text-left transition-colors ${
                  action ? 'active:bg-gray-50' : 'cursor-default'
                } ${danger ? 'text-red-500' : ''}`}
              >
                <Icon size={18} className={danger ? 'text-red-500' : 'text-gray-400'} />
                <div className="flex-1">
                  <p className={`text-sm font-medium ${danger ? 'text-red-500' : 'text-gray-800'}`}>{label}</p>
                  {value && <p className="text-xs text-gray-400">{value}</p>}
                </div>
                {action && !danger && <ChevronRight size={16} className="text-gray-300" />}
              </button>
            ))}
          </Card>
        </div>
      ))}

      {/* Version */}
      <p className="text-center text-xs text-gray-300 pb-4">
        Aseo Alerta v1.0 · Acceso gratuito de lanzamiento 🚀
      </p>
    </div>
  )
}
