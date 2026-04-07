import { useState, useEffect } from 'react'
import { Check, CreditCard, Zap, Shield, Bell, Calendar } from 'lucide-react'
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

function ActiveSubscription({ subscription, onCancel, canceling }) {
  const nextBilling = subscription.current_period_end
    ? new Date(subscription.current_period_end * 1000).toLocaleDateString('es-CL', {
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
            <p className="text-xs text-brand-600">Precio de lanzamiento</p>
          </div>
        </div>
        <div className="flex items-baseline gap-1 mb-3">
          <span className="text-3xl font-extrabold text-brand-800">$9.990</span>
          <span className="text-brand-600 text-sm">/mes</span>
        </div>
        <p className="text-xs text-brand-600">
          Próximo cobro: <strong>{nextBilling}</strong>
        </p>
      </Card>

      <Card className="p-4">
        <h3 className="font-semibold text-gray-900 mb-3">Estado de tu plan</h3>
        <div className="space-y-2">
          {[
            ['Estado', subscription.status === 'active' ? '✅ Activo' : '⚠️ ' + subscription.status],
            ['Plan', 'Lanzamiento'],
            ['Precio', '$9.990 CLP/mes'],
          ].map(([label, value]) => (
            <div key={label} className="flex justify-between text-sm">
              <span className="text-gray-500">{label}</span>
              <span className="font-medium text-gray-900">{value}</span>
            </div>
          ))}
        </div>
      </Card>

      <button
        onClick={onCancel}
        disabled={canceling}
        className="w-full text-sm text-red-500 text-center py-2 disabled:opacity-50"
      >
        {canceling ? 'Cancelando...' : 'Cancelar suscripción'}
      </button>
    </div>
  )
}

function CheckoutForm({ onSuccess }) {
  const [loading, setLoading] = useState(false)
  const [email, setEmail] = useState('')

  const handleSubscribe = async () => {
    if (!email) {
      toast.error('Ingresa tu email de pago')
      return
    }
    setLoading(true)
    try {
      const { checkout_url } = await api.subscription.create({ email })
      if (checkout_url) {
        window.location.href = checkout_url
      } else {
        toast.success('Suscripción activada')
        onSuccess()
      }
    } catch (err) {
      toast.error(err.message || 'Error al procesar el pago')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-5">
      {/* Precio */}
      <Card className="p-5">
        <div className="flex items-center justify-between mb-2">
          <p className="font-bold text-gray-900 text-lg">Plan Lanzamiento</p>
          <span className="text-xs font-semibold bg-brand-100 text-brand-700 px-2.5 py-1 rounded-full">
            🎉 Precio especial
          </span>
        </div>
        <div className="flex items-baseline gap-1 mb-4">
          <span className="text-4xl font-extrabold text-gray-900">$9.990</span>
          <span className="text-gray-500">/mes</span>
        </div>
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

      {/* Pago */}
      <Card className="p-5 space-y-4">
        <div className="flex items-center gap-2">
          <CreditCard size={18} className="text-brand-600" />
          <h3 className="font-bold text-gray-900">Datos de pago</h3>
        </div>
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-3.5 text-xs text-yellow-800">
          <p className="font-semibold mb-1">⚡ Procesado por Toku</p>
          <p>Pago seguro con tarjeta de crédito o débito. Puedes cancelar cuando quieras.</p>
        </div>
        <div>
          <label className="text-sm font-semibold text-gray-700 block mb-1.5">Email de facturación *</label>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="tu@email.com"
            className="w-full border border-gray-200 rounded-2xl px-4 py-3.5 text-base focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
          />
        </div>
        <Button onClick={handleSubscribe} loading={loading} fullWidth size="lg">
          {loading ? 'Procesando...' : 'Suscribirme — $9.990/mes'}
        </Button>
        <p className="text-xs text-center text-gray-400">
          🔒 Pago 100% seguro · Cancela cuando quieras
        </p>
      </Card>
    </div>
  )
}

export default function SubscriptionPage() {
  const [subscription, setSubscription] = useState(null)
  const [loading, setLoading]           = useState(true)
  const [canceling, setCanceling]       = useState(false)

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

  const handleCancel = async () => {
    if (!window.confirm('¿Seguro que quieres cancelar tu suscripción? Perderás el acceso al finalizar el período.')) return
    setCanceling(true)
    try {
      await api.subscription.cancel()
      toast.success('Suscripción cancelada')
      fetchSubscription()
    } catch (err) {
      toast.error('Error al cancelar')
    } finally {
      setCanceling(false)
    }
  }

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
        <h1 className="text-2xl font-extrabold text-gray-900">Suscripción</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          {hasActive ? 'Tu plan está activo' : 'Activa Aseo Alerta para tu propiedad'}
        </p>
      </div>

      {hasActive
        ? <ActiveSubscription subscription={subscription} onCancel={handleCancel} canceling={canceling} />
        : <CheckoutForm onSuccess={fetchSubscription} />
      }
    </div>
  )
}
