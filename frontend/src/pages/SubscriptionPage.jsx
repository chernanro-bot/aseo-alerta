import { useState, useEffect } from 'react'
import { Check, Gift, Zap, Shield, Bell, Calendar, Sparkles, Rocket } from 'lucide-react'
import { api } from '../lib/api'
import toast from 'react-hot-toast'
import Button from '../components/Button'
import Card from '../components/Card'

const FEATURES = [
  { icon: Calendar, text: 'Sincronización automática de calendarios Airbnb' },
  { icon: Bell,     text: 'Alertas WhatsApp al encargado de aseo' },
  { icon: Zap,      text: 'Propiedades ilimitadas' },
  { icon: Shield,   text: 'Soporte prioritario' },
]

function ActivePlan({ subscription }) {
  const startDate = subscription.started_at
    ? new Date(subscription.started_at).toLocaleDateString('es-CL', {
        day: 'numeric', month: 'long', year: 'numeric'
      })
    : '—'

  return (
    <div className="space-y-4">
      <Card className="p-5 border-brand-200 bg-brand-50">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-brand-600 rounded-xl flex items-center justify-center">
            <Check size={20} className="text-white" strokeWidth={3} />
          </div>
          <div>
            <p className="font-bold text-brand-800">Plan activo</p>
            <p className="text-xs text-brand-600">Acceso gratuito de lanzamiento</p>
          </div>
        </div>
        <div className="flex items-baseline gap-1 mb-3">
          <span className="text-3xl font-extrabold text-brand-800">Gratis</span>
          <span className="text-brand-600 text-sm">por tiempo limitado</span>
        </div>
        <p className="text-xs text-brand-600">
          Activo desde: <strong>{startDate}</strong>
        </p>
      </Card>

      <Card className="p-4">
        <h3 className="font-semibold text-gray-900 mb-3">Tu plan incluye</h3>
        <div className="space-y-2.5">
          {FEATURES.map(({ icon: Icon, text }) => (
            <div key={text} className="flex items-center gap-2.5">
              <div className="w-5 h-5 bg-brand-100 rounded-full flex items-center justify-center flex-shrink-0">
                <Check size={12} className="text-brand-600" strokeWidth={3} />
              </div>
              <span className="text-sm text-gray-700">{text}</span>
            </div>
          ))}
        </div>
      </Card>

      <Card className="p-4 bg-brand-50 border-brand-100">
        <div className="flex items-start gap-2.5">
          <Sparkles size={16} className="text-brand-600 mt-0.5 flex-shrink-0" />
          <p className="text-xs text-brand-700">
            Estás entre los primeros usuarios de Aseo Alerta. Disfruta de todas las funciones gratis durante el período de lanzamiento.
          </p>
        </div>
      </Card>
    </div>
  )
}

function ActivateFreePlan({ onSuccess }) {
  const [loading, setLoading] = useState(false)

  const handleActivate = async () => {
    setLoading(true)
    try {
      await api.subscription.create({ email: '' })
      toast.success('Plan activado con éxito')
      onSuccess()
    } catch (err) {
      toast.error(err.message || 'Error al activar el plan')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-5">
      <Card className="p-5">
        <div className="flex items-center justify-between mb-2">
          <p className="font-bold text-gray-900 text-lg">Plan Lanzamiento</p>
          <span className="text-xs font-semibold bg-green-100 text-green-700 px-2.5 py-1 rounded-full">
            100% Gratis
          </span>
        </div>
        <div className="flex items-baseline gap-1 mb-1">
          <span className="text-4xl font-extrabold text-gray-900">$0</span>
          <span className="text-gray-500">/mes</span>
        </div>
        <p className="text-xs text-gray-400 mb-4">
          <span className="line-through">$9.990/mes</span> — Gratis por tiempo limitado
        </p>
        <div className="space-y-2.5">
          {FEATURES.map(({ icon: Icon, text }) => (
            <div key={text} className="flex items-center gap-2.5">
              <div className="w-5 h-5 bg-brand-100 rounded-full flex items-center justify-center flex-shrink-0">
                <Check size={12} className="text-brand-600" strokeWidth={3} />
              </div>
              <span className="text-sm text-gray-700">{text}</span>
            </div>
          ))}
        </div>
      </Card>

      <Card className="p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Gift size={18} className="text-brand-600" />
          <h3 className="font-bold text-gray-900">Oferta de lanzamiento</h3>
        </div>
        <div className="bg-green-50 border border-green-200 rounded-xl p-3.5 text-xs text-green-800">
          <p className="font-semibold mb-1">Acceso anticipado gratuito</p>
          <p>Sé de los primeros en usar Aseo Alerta. Todas las funciones incluidas, sin tarjeta de crédito, sin compromiso.</p>
        </div>
        <Button onClick={handleActivate} loading={loading} fullWidth size="lg">
          {loading ? 'Activando...' : 'Activar plan gratis'}
        </Button>
        <p className="text-xs text-center text-gray-400">
          Sin tarjeta de crédito · Sin compromiso
        </p>
      </Card>
    </div>
  )
}

export default function SubscriptionPage() {
  const [subscription, setSubscription] = useState(null)
  const [loading, setLoading]           = useState(true)

  const fetchSubscription = async () => {
    try {
      const data = await api.subscription.get()
      setSubscription(data)
    } catch {
      setSubscription(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchSubscription() }, [])

  if (loading) {
    return (
      <div className="space-y-4 animate-pulse">
        <div className="h-8 bg-gray-200 rounded-xl w-40" />
        <div className="h-52 bg-white rounded-2xl border border-gray-100" />
      </div>
    )
  }

  const hasActive = subscription?.status === 'active'

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-extrabold text-gray-900">Tu Plan</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          {hasActive ? 'Tu plan está activo' : 'Activa Aseo Alerta gratis'}
        </p>
      </div>

      {hasActive
        ? <ActivePlan subscription={subscription} />
        : <ActivateFreePlan onSuccess={fetchSubscription} />
      }
    </div>
  )
}
